'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { OrderStatus, ServiceType } from '@/types'
import type { Json } from '@/types/database'
import { createNotificationsForAction } from './notifications'
import { sendNotificationEmail } from '@/lib/email'

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

  // Insert the order with in_progress status (payment bypassed)
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      client_id:  user.id,
      booster_id: null,
      game_id:    game.id,
      service_id: service.id,
      status:     'in_progress' as OrderStatus,
      price:      params.price,
      details:    params.details as unknown as Json,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Notify + email the client about their new order (fire-and-forget)
  const shortId = order.id.slice(0, 8).toUpperCase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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

  // Map action → new order status
  const statusMap: Record<OrderActionType, OrderStatus> = {
    mark_completed:        'completed',
    booster_mark_complete: 'completed',
    open_dispute:          'dispute',
    need_support:          'support',
    cancel_request:        'cancelled',
  }

  // Message stored in DB — receiver reads it as-is.
  // For 'completed', the sender sees an override in dbToLocal (sender_id check).
  const messageMap: Record<OrderActionType, { content: string; systemType: string }> = {
    mark_completed: {
      content:    `The order has been marked as completed by the ${actorRole}. Please ensure your order has been completed successfully and flawlessly. Otherwise, you can call support or open a dispute.`,
      systemType: 'completed',
    },
    booster_mark_complete: {
      content:    `The order has been marked as completed by the ${actorRole}. Please ensure your order has been completed successfully and flawlessly. Otherwise, you can call support or open a dispute.`,
      systemType: 'completed',
    },
    open_dispute: {
      content:    `A dispute case has been opened for this order by the ${actorRole}. Dispute ID: DSP-${trackId} — Please wait for support to connect and intervene before sending any further messages.`,
      systemType: 'dispute',
    },
    need_support: {
      content:    `A support case has been opened for this order by the ${actorRole}. Support ID: SUP-${trackId} — Please wait for support to connect and intervene before sending any further messages.`,
      systemType: 'support',
    },
    cancel_request: {
      content:    `A cancel request has been opened for this order by the ${actorRole}. Cancel ID: CAN-${trackId} — Please wait for support to connect and intervene before sending any further messages.`,
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

  // 1. Update order status
  const { error: statusErr } = await admin
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
  if (statusErr) return { error: statusErr.message }

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
  booster_id: string | null
  updated_at: string
  details: Record<string, unknown> | null
  booster: { id: string; username: string | null; email: string; avatar_url: string | null } | null
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('status, booster_id, updated_at, details, booster:profiles!orders_booster_id_fkey(id, username, email, avatar_url)')
    .eq('id', orderId)
    .single()
  if (error) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any
}
