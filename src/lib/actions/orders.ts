'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { OrderStatus, ServiceType } from '@/types'
import type { Json } from '@/types/database'
import { createNotificationsForAction } from './notifications'
import { sendNotificationEmail } from '@/lib/email'
import { calculateBoosterPayout } from '@/lib/payout'
import { checkPaymentVelocity } from '@/lib/utils/anomaly-detection'
import { flagUser } from '@/lib/actions/flags'

// ─── Slug → DB service-type map ───────────────────────────────────────────────

const SLUG_TO_SERVICE_TYPE: Record<string, ServiceType> = {
  'rank-boost':       'rank_boost',
  'win-boost':        'win_boost',
  'placements-boost': 'placement_matches',
  'unrated-boost':    'unrated_matches',
}

// ─── Mock checkout — bypasses payment gateway ─────────────────────────────────

export async function createOrderAction(params: {
  serviceSlug:  string
  price:        number
  details:      Record<string, unknown>
}): Promise<{ error: string | null; orderId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be logged in to place an order.' }

  const serviceType = SLUG_TO_SERVICE_TYPE[params.serviceSlug]
  if (!serviceType) return { error: `Unknown service: ${params.serviceSlug}` }

  // Look up game
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', 'valorant')
    .single()

  if (!game) return { error: 'Valorant game not found in database. Run the seed script first.' }

  // Look up service
  const { data: service } = await supabase
    .from('games_services')
    .select('id')
    .eq('game_id', game.id)
    .eq('type', serviceType)
    .single()

  if (!service) return { error: `Service "${serviceType}" not found. Run the seed script first.` }

  // ── Payment velocity check (uses service role to bypass RLS) ─────────────
  const svcForVelocity = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ count: failedCount }, { data: pastOrders }] = await Promise.all([
    svcForVelocity
      .from('payment_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'failed')
      .gte('created_at', since24h),
    svcForVelocity
      .from('orders')
      .select('price')
      .eq('client_id', user.id)
      .neq('status', 'cancelled'),
  ])

  const avgOrderValue =
    pastOrders && pastOrders.length > 0
      ? pastOrders.reduce((sum: number, o: { price: number }) => sum + (o.price ?? 0), 0) / pastOrders.length
      : 0

  const velocityResult = checkPaymentVelocity(
    failedCount ?? 0,
    params.price,
    avgOrderValue,
  )

  const needsManualReview = velocityResult.blocked

  if (needsManualReview) {
    // Fire-and-forget flag — never blocks the order creation
    flagUser(user.id, 'PAYMENT_VELOCITY', velocityResult.reason ?? undefined).catch(() => {})
  }

  // Insert the order (manual_review flag set when velocity check triggered)
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      client_id:     user.id,
      booster_id:    null,
      game_id:       game.id,
      service_id:    service.id,
      status:        'in_progress' as OrderStatus,
      price:         params.price,
      details:       params.details as unknown as Json,
      manual_review: needsManualReview,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Log this order as a successful payment attempt for future velocity checks
  svcForVelocity
    .from('payment_attempts')
    .insert({ user_id: user.id, amount: params.price, status: 'success' })
    .then(({ error: e }) => { if (e) console.error('[PaymentVelocity] log error:', e.message) })

  // Notify + email the client about their new order (fire-and-forget)
  const shortId = order.id.slice(0, 8).toUpperCase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'
  // Re-use the service-role client already created above
  const admin = svcForVelocity

  // ── In-App: Client receipt notification
  const clientNotifBody = `Your order #${shortId} has been placed and is awaiting a booster. We will notify you as soon as one is assigned.`
  admin.from('notifications').insert({
    user_id:          user.id,
    title:            'Order Confirmed',
    body:             clientNotifBody,
    type:             'order_created',
    related_order_id: order.id,
  }).then(({ error: e }) => { if (e) console.error('[Notifications] create error (client):', e.message) })

  // ── In-App: Notify all admin/support users about the new order
  admin
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'support'])
    .then(({ data: adminProfiles }) => {
      if (!adminProfiles?.length) return
      const adminRows = adminProfiles.map((p: { id: string }) => ({
        user_id:          p.id,
        title:            'New Order Received',
        body:             `Order #${shortId} has been placed and is awaiting booster assignment.`,
        type:             'order_created',
        related_order_id: order.id,
      }))
      admin.from('notifications').insert(adminRows)
        .then(({ error: e }) => { if (e) console.error('[Notifications] create error (admins):', e.message) })
    })

  // ── Email: Client receipt only — actor emails are never sent
  if (user.email) {
    sendNotificationEmail({
      to:       user.email,
      subject:  `Order #${shortId} confirmed — Arshboost`,
      title:    'Order Confirmed',
      body:     clientNotifBody,
      ctaUrl:   `${siteUrl}/dashboard/orders/${order.id}`,
      ctaLabel: 'Track Order',
    }).catch(console.error)
  }

  revalidatePath('/dashboard/orders')
  return { error: null, orderId: order.id }
}

async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/boosts')
  revalidatePath('/dashboard/support')

  return { success: true }
}

export async function claimJob(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('orders')
    .update({ booster_id: user.id, status: 'in_progress' })
    .eq('id', orderId)
    .is('booster_id', null)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/boosts')
  revalidatePath(`/dashboard/boosts/${orderId}`)
  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${orderId}`)

  return { success: true }
}

export async function completeOrder(orderId: string) {
  return updateOrderStatus(orderId, 'completed')
}

export async function cancelOrder(orderId: string) {
  return updateOrderStatus(orderId, 'cancelled')
}

export async function declareDispute(orderId: string) {
  return updateOrderStatus(orderId, 'dispute')
}

export async function callSupportOrder(orderId: string) {
  return updateOrderStatus(orderId, 'support')
}

// ─── Unified order action: update status + insert system message ──────────────

type OrderActionType =
  | 'mark_completed'
  | 'booster_mark_complete'
  | 'open_dispute'
  | 'need_support'
  | 'cancel_request'

export async function executeOrderAction(
  orderId: string,
  actionType: OrderActionType,
  actorRole: 'Client' | 'Booster',
  proofImageUrl?: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Use service role to bypass RLS ownership restrictions
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const trackId = Math.random().toString(36).slice(2, 8).toUpperCase()

  // Map action → new order status (null = no status change)
  const statusMap: Record<OrderActionType, OrderStatus | null> = {
    mark_completed:        'completed',
    booster_mark_complete: 'waiting_action',
    open_dispute:          'dispute',
    need_support:          null,            // status stays in_progress; only support_needed flips
    cancel_request:        'cancel_requested',
  }

  const messageMap: Record<OrderActionType, { content: string; systemType: string }> = {
    mark_completed: {
      content:    `The order has been marked as completed by the ${actorRole}. Please ensure your order has been completed successfully and flawlessly. Otherwise, you can call support or open a dispute.`,
      systemType: 'completed',
    },
    booster_mark_complete: {
      content:    `The booster has marked this order as complete. Please review and click "Approve & Release Funds" if everything looks good, or open a dispute if something is wrong.`,
      systemType: 'waiting_action',
    },
    open_dispute: {
      content:    `A dispute has been opened by the ${actorRole}. The chat is now locked pending support intervention. Dispute ID: DSP-${trackId}`,
      systemType: 'dispute',
    },
    need_support: {
      content:    `Support has been notified for this order by the ${actorRole}. A team member will join the chat shortly. Support ID: SUP-${trackId}`,
      systemType: 'support',
    },
    cancel_request: {
      content:    `A cancellation has been requested by the ${actorRole}. The chat is now locked pending review. Cancel ID: CAN-${trackId}`,
      systemType: 'cancel',
    },
  }

  const newStatus = statusMap[actionType]
  const { content, systemType } = messageMap[actionType]

  // Fetch order + both user profiles so we can create notifications + emails
  const { data: orderRow } = await admin
    .from('orders')
    .select('client_id, booster_id, id')
    .eq('id', orderId)
    .single()

  if (!orderRow) return { error: 'Order not found' }

  // ── Ownership check (service role bypasses RLS, so we enforce here) ─────────
  // Booster-only actions must be called by the assigned booster.
  // Client-only actions must be called by the order's client.
  if (actionType === 'booster_mark_complete') {
    if (orderRow.booster_id !== user.id) return { error: 'Forbidden: you are not the assigned booster' }
  } else if (actionType === 'mark_completed') {
    if (orderRow.client_id !== user.id) return { error: 'Forbidden: you are not the client for this order' }
  } else {
    // open_dispute, need_support, cancel_request — either participant may call
    if (orderRow.client_id !== user.id && orderRow.booster_id !== user.id) {
      return { error: 'Forbidden: you are not a participant in this order' }
    }
  }

  // Fetch both profiles in parallel
  const participantIds = [
    orderRow?.client_id,
    orderRow?.booster_id,
  ].filter(Boolean) as string[]

  const { data: profiles } = participantIds.length
    ? await admin
        .from('profiles')
        .select('id, email, username')
        .in('id', participantIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; email: string; username: string | null }) => [p.id, p])
  )

  const clientId  = orderRow?.client_id  ?? null
  const boosterId = orderRow?.booster_id ?? null
  const actorId   = user.id
  const counterpartyId = actorId === clientId ? boosterId : clientId

  const shortId = orderId.slice(0, 8).toUpperCase()

  // Notification texts per action
  const notifMap: Record<OrderActionType, { actorTitle: string; actorBody: string; cpTitle: string; cpBody: string; emailSubject: string }> = {
    mark_completed: {
      actorTitle:   'Order Marked as Completed',
      actorBody:    `You marked order #${shortId} as completed. Waiting for the booster to confirm.`,
      cpTitle:      'Order Marked as Completed',
      cpBody:       `Order #${shortId} has been marked as completed by the client. Payment will be processed after review.`,
      emailSubject: `Order #${shortId} marked as completed`,
    },
    booster_mark_complete: {
      actorTitle:   'Order Marked as Completed',
      actorBody:    `You marked order #${shortId} as completed. Waiting for client confirmation.`,
      cpTitle:      'Your Order Has Been Completed',
      cpBody:       `Booster has marked order #${shortId} as completed. Please verify and confirm within 3 days, or open a dispute if something is wrong.`,
      emailSubject: `Your order #${shortId} has been completed`,
    },
    open_dispute: {
      actorTitle:   'Dispute Opened',
      actorBody:    `You opened a dispute for order #${shortId}. Our support team will contact you shortly.`,
      cpTitle:      'A Dispute Has Been Opened',
      cpBody:       `A dispute was opened for order #${shortId}. Please wait for support to review and contact both parties.`,
      emailSubject: `Dispute opened for order #${shortId}`,
    },
    need_support: {
      actorTitle:   'Support Requested',
      actorBody:    `You requested support for order #${shortId}. Our team will join the chat shortly.`,
      cpTitle:      'Support Requested for Your Order',
      cpBody:       `Support has been requested for order #${shortId}. A team member will join the chat shortly.`,
      emailSubject: `Support requested for order #${shortId}`,
    },
    cancel_request: {
      actorTitle:   'Cancellation Requested',
      actorBody:    `You requested cancellation of order #${shortId}. Support will review and process your request.`,
      cpTitle:      'Cancellation Requested',
      cpBody:       `A cancellation was requested for order #${shortId}. Support will review and contact both parties.`,
      emailSubject: `Cancellation requested for order #${shortId}`,
    },
  }

  const { actorTitle, actorBody, cpTitle, cpBody, emailSubject } = notifMap[actionType]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'
  const orderUrl = `${siteUrl}/dashboard/orders/${orderId}`

  // 1. Update order status (or support_needed flag for need_support)
  if (newStatus !== null) {
    const updatePayload: Record<string, unknown> = { status: newStatus }
    if (actionType === 'booster_mark_complete' && proofImageUrl) {
      updatePayload.proof_image_url = proofImageUrl
    }
    const { error: statusErr } = await admin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
    if (statusErr) return { error: statusErr.message }
  } else {
    // need_support: flip flag only, keep current status
    const { error: flagErr } = await admin
      .from('orders')
      .update({ support_needed: true })
      .eq('id', orderId)
    if (flagErr) return { error: flagErr.message }
  }

  // 2. Insert system message — sender_id = auth user so dbToLocal can detect "by you"
  const { error: msgErr } = await admin
    .from('chat_messages')
    .insert({
      order_id:    orderId,
      sender_id:   user.id,
      content,
      is_system:   true,
      system_type: systemType,
    })
  if (msgErr) return { error: msgErr.message }

  // 3. In-App: Insert notifications for BOTH actor and counterparty (always)
  createNotificationsForAction({
    actorUserId:          actorId,
    counterpartyUserId:   counterpartyId,
    relatedOrderId:       orderId,
    actorTitle,
    actorBody,
    counterpartyTitle:    cpTitle,
    counterpartyBody:     cpBody,
    type:                 systemType,
  }).catch(console.error)

  // 4. Email — STRICT MATRIX (actor NEVER receives an email):
  //    mark_completed / booster_mark_complete → counterparty only
  //    open_dispute / cancel_request          → counterparty only
  //    need_support                           → NO email (admins monitor their panel)
  const counterpartyProfile = counterpartyId ? profileMap.get(counterpartyId) : undefined
  const shouldEmailCounterparty = actionType !== 'need_support'

  if (shouldEmailCounterparty && counterpartyProfile?.email) {
    sendNotificationEmail({
      to:      counterpartyProfile.email,
      subject: emailSubject,
      title:   cpTitle,
      body:    cpBody,
      ctaUrl:  orderUrl,
      ctaLabel:'View Order',
    }).catch(console.error)
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/boosts')
  revalidatePath('/dashboard/support')
  return {}
}

export async function approveAndReleaseAction(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify caller is the client for this order
  const { data: order } = await admin
    .from('orders')
    .select('client_id, booster_id, status, price')
    .eq('id', orderId)
    .single()
  if (!order) return { error: 'Order not found' }
  if (order.client_id !== user.id) return { error: 'Forbidden' }
  if (order.status !== 'waiting_action') return { error: 'Order is not pending approval' }

  const { error: statusErr } = await admin
    .from('orders')
    .update({ status: 'completed' as OrderStatus })
    .eq('id', orderId)
  if (statusErr) return { error: statusErr.message }

  // Credit booster's balance atomically via a single UPDATE expression
  if (order.booster_id) {
    const { boosterPayout } = calculateBoosterPayout(order.price as number)
    await admin.rpc('increment_profile_balance', {
      p_user_id: order.booster_id,
      p_amount:  boosterPayout,
    })
  }

  await admin.from('chat_messages').insert({
    order_id:    orderId,
    sender_id:   user.id,
    content:     'The client has approved and released funds. This order is now complete. Thank you!',
    is_system:   true,
    system_type: 'completed',
  })

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/boosts')
  return {}
}

// ─── Booster: upload proof screenshot then mark complete ─────────────────────
// Accepts FormData so the file is streamed through the server action (no storage
// RLS needed — the service role client does the upload).
export async function boosterMarkCompleteWithProof(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const orderId = formData.get('orderId')
  const file    = formData.get('file')
  if (typeof orderId !== 'string' || !orderId) return { error: 'Missing orderId' }
  if (!(file instanceof File))                  return { error: 'Missing file' }
  if (!file.type.startsWith('image/'))          return { error: 'Only image files are accepted' }
  if (file.size > 10 * 1024 * 1024)            return { error: 'File must be under 10 MB' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Ownership check before uploading (avoid orphaned files)
  const { data: orderRow } = await admin
    .from('orders')
    .select('booster_id, status')
    .eq('id', orderId)
    .single()
  if (!orderRow)                        return { error: 'Order not found' }
  if (orderRow.booster_id !== user.id)  return { error: 'Forbidden: you are not the assigned booster' }
  if (orderRow.status !== 'in_progress') return { error: 'Order is not in progress' }

  // Upload via service role — no storage RLS required
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(
    (file.name.split('.').pop() ?? '').toLowerCase(),
  ) ? file.name.split('.').pop()!.toLowerCase() : 'jpg'
  const path = `${orderId}/${Date.now()}.${safeExt}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await admin.storage
    .from('order-proofs')
    .upload(path, buf, { contentType: file.type, upsert: true })
  if (uploadErr) return { error: uploadErr.message }

  const { data: { publicUrl } } = admin.storage.from('order-proofs').getPublicUrl(path)

  // Delegate to the main state machine (ownership re-checked there, notifications sent)
  return executeOrderAction(orderId, 'booster_mark_complete', 'Booster', publicUrl)
}

// ─── Save login credentials to order details ─────────────────────────────────

export async function saveLoginsAction(
  orderId: string,
  logins: { ign: string; login: string; pwd: string; twoFa: boolean }
): Promise<{ error: string | null }> {
  // Verify ownership with user session first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch current details (ownership + data merge)
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('client_id, details')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }
  if (order.client_id !== user.id) return { error: 'Forbidden' }

  // Use service role to bypass RLS (client update policy only allows cancellation)
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updatedDetails = {
    ...(order.details as Record<string, unknown>),
    logins,
  }

  const { error } = await admin
    .from('orders')
    .update({ details: updatedDetails })
    .eq('id', orderId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { error: null }
}

// ─── Delete login credentials from order details ──────────────────────────────

export async function deleteLoginsAction(
  orderId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('client_id, details')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }
  if (order.client_id !== user.id) return { error: 'Forbidden' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const details = { ...(order.details as Record<string, unknown>) }
  delete details.logins

  const { error } = await admin
    .from('orders')
    .update({ details })
    .eq('id', orderId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { error: null }
}

// ─── Booster progress updates ─────────────────────────────────────────────────

/** Update the live rank progress stored in order.details.current_progress_rank.
 *  Triggers an orders Realtime UPDATE so the client's LiveOrderStatus updates instantly. */
export async function updateOrderProgress(
  orderId: string,
  currentProgressRank: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('booster_id, details')
    .eq('id', orderId)
    .single()
  if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }
  if (order.booster_id !== user.id) return { error: 'Forbidden' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const updatedDetails = {
    ...(order.details as Record<string, unknown>),
    current_progress_rank: currentProgressRank,
  }
  const { error } = await admin.from('orders').update({ details: updatedDetails }).eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  return { error: null }
}

/** Update the booster's activity status stored in order.details.booster_activity_status.
 *  Triggers an orders Realtime UPDATE so the client's status badge updates instantly. */
export async function updateOrderActivity(
  orderId: string,
  activityStatus: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('booster_id, details')
    .eq('id', orderId)
    .single()
  if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }
  if (order.booster_id !== user.id) return { error: 'Forbidden' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const updatedDetails = {
    ...(order.details as Record<string, unknown>),
    booster_activity_status: activityStatus,
  }
  const { error } = await admin.from('orders').update({ details: updatedDetails }).eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  return { error: null }
}

export async function deleteOrdersAction(ids: string[]): Promise<{ error: string | null }> {
  if (!ids.length) return { error: null }

  // Use service role to bypass RLS (no client delete policy exists)
  // Still verify ownership before deleting
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Safety: only delete orders that belong to this user
  const { error } = await admin
    .from('orders')
    .delete()
    .in('id', ids)
    .eq('client_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/orders')
  return { error: null }
}

// ─── Polling fallback: fetch mutable order fields ─────────────────────────────
// Used by OrderDetailView to guarantee status updates even when Realtime
// publication is not yet configured on the Supabase project.
export async function fetchOrderStatus(orderId: string): Promise<{
  status: string
  support_needed: boolean
  booster_id: string | null
  updated_at: string
  details: Record<string, unknown> | null
  booster: { id: string; username: string | null; email: string; avatar_url: string | null } | null
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('status, support_needed, booster_id, updated_at, details, booster:profiles!orders_booster_id_fkey(id, username, email, avatar_url)')
    .eq('id', orderId)
    .single()
  if (error) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any
}
