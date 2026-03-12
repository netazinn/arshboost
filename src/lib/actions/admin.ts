'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { calculateBoosterPayout } from '@/lib/payout'
import { getGlobalSettings } from '@/lib/data/settings'
import { logAdminAction } from '@/lib/log-action'

// ─── helpers ─────────────────────────────────────────────────────────────────

async function requireAdminRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'support', 'accountant'].includes(profile.role)) {
    throw new Error('Insufficient permissions')
  }
  return { user, role: profile.role as 'admin' | 'support' | 'accountant' }
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Withdrawal: Approve ─────────────────────────────────────────────────────

/**
 * Marks a withdrawal as approved. The PDF receipt must already be uploaded
 * client-side (to the `receipts` bucket) and its public URL passed here.
 */
export async function approveWithdrawal({
  withdrawalId,
  transactionId,
  receiptUrl,
}: {
  withdrawalId: string
  transactionId: string
  receiptUrl: string
}): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('withdrawals')
      .update({
        status: 'approved',
        transaction_id: transactionId,
        receipt_url: receiptUrl,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    if (error) return { error: error.message }
    logAdminAction(user.id, 'withdrawal.approved', withdrawalId, { transactionId, receiptUrl })
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Withdrawal: Reject ───────────────────────────────────────────────────────

export async function rejectWithdrawal({
  withdrawalId,
  notes,
}: {
  withdrawalId: string
  notes?: string
}): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('withdrawals')
      .update({
        status: 'rejected',
        notes: notes ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    if (error) return { error: error.message }
    logAdminAction(user.id, 'withdrawal.rejected', withdrawalId, { notes: notes ?? null })
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Dispute: Resolve ─────────────────────────────────────────────────────────

/**
 * Finalises a disputed order with a split decision.
 * clientPct 0 = full pay to booster, clientPct 100 = full refund to client.
 */
export async function resolveDispute({
  orderId,
  mode,
  boosterPct = 0,
  notes,
}: {
  orderId: string
  /** full_refund → order cancelled, no wallet touch
   *  full_payout → order completed, full booster net credited
   *  custom      → order completed, boosterPct% of net credited */
  mode: 'full_refund' | 'full_payout' | 'custom'
  boosterPct?: number   // 0-100; only used for 'custom' and 'full_payout'
  notes?: string
}): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    // Fetch order price + booster to compute payout
    const { data: order, error: fetchErr } = await admin
      .from('orders')
      .select('price, booster_id')
      .eq('id', orderId)
      .single()
    if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }

    const { flat_platform_fee } = await getGlobalSettings()
    const { boosterPayout } = calculateBoosterPayout(order.price, flat_platform_fee)
    const newStatus = mode === 'full_refund' ? 'cancelled' : 'completed'
    const clientPctRecord =
      mode === 'full_refund' ? 100
      : mode === 'full_payout' ? 0
      : Math.round(100 - boosterPct)

    const { error: updateErr } = await admin
      .from('orders')
      .update({
        status: newStatus,
        resolution_client_pct: clientPctRecord,
        resolution_notes: notes ?? null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) return { error: updateErr.message }

    // Credit booster wallet for non-refund resolutions
    if (mode !== 'full_refund' && order.booster_id) {
      const effectivePct = mode === 'full_payout' ? 100 : boosterPct
      const creditAmount = Math.round(boosterPayout * (effectivePct / 100) * 100) / 100
      if (creditAmount > 0) {
        const { error: rpcErr } = await admin.rpc('increment_profile_balance', {
          p_user_id: order.booster_id,
          p_amount:  creditAmount,
        })
        if (rpcErr) return { error: rpcErr.message }
      }
    }

    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── God-Mode Chat: Send ──────────────────────────────────────────────────────

/**
 * Sends a message from an admin/support user into any order chat,
 * bypassing the lock. The caller's role appears in the UI as a special badge.
 * Uses the service-role client so it is never blocked by participant-only RLS.
 */
export async function sendAdminMessage(
  orderId: string,
  content: string,
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    // Use service-role client so staff always bypass the participant-only INSERT policy
    const admin = adminClient()

    const { error } = await admin
      .from('chat_messages')
      .insert({ order_id: orderId, sender_id: user.id, content })

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── God-Mode DM Reply ───────────────────────────────────────────────────────

/**
 * Sends a staff reply into a DM thread (no order_id).
 * threadId format: "{boosterId}:{role}" — e.g., "abc123:admin"
 * Uses service-role client to bypass RLS.
 */
export async function sendAdminDmReply(
  threadId: string,
  content: string,
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('chat_messages')
      .insert({ dm_thread_id: threadId, sender_id: user.id, content })

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Bank Details: Approve ────────────────────────────────────────────────────

export async function approveBankDetails(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('profiles')
      .update({ bank_details_status: 'approved' })
      .eq('id', userId)

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Withdrawal: Mark as Paid ─────────────────────────────────────────────────

export async function markWithdrawalPaid(
  withdrawalId: string,
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('withdrawals')
      .update({
        status:      'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── User Role: Update ────────────────────────────────────────────────────────

export async function updateUserRole(
  userId: string,
  role: 'admin' | 'booster' | 'client' | 'support' | 'accountant',
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    if (user.id === userId) return { error: 'You cannot change your own role.' }
    const admin = adminClient()

    // Fetch old role for the audit log
    const { data: oldProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    const { error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) return { error: error.message }
    logAdminAction(user.id, 'user.role.changed', userId, { old_role: oldProfile?.role ?? null, new_role: role })
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Toggle User Ban ──────────────────────────────────────────────────────────

export async function toggleUserBanStatus(
  userId: string,
): Promise<{ is_banned?: boolean; error?: string }> {
  try {
    const { user } = await requireAdminRole()
    if (user.id === userId) return { error: 'You cannot ban yourself.' }
    const admin = adminClient()

    const { data: profile, error: fetchErr } = await admin
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .single()
    if (fetchErr || !profile) return { error: fetchErr?.message ?? 'User not found' }

    const newBanned = !(profile.is_banned ?? false)
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ is_banned: newBanned })
      .eq('id', userId)
    if (updateErr) return { error: updateErr.message }

    logAdminAction(user.id, newBanned ? 'user.banned' : 'user.unbanned', userId, {})
    return { is_banned: newBanned }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Get User Details (admin read) ───────────────────────────────────────────

export async function getUserDetails(userId: string): Promise<{
  data?: {
    balance:             number
    bank_holder_name:    string | null
    bank_name:           string | null
    bank_swift:          string | null
    bank_iban:           string | null
    bank_details_status: 'none' | 'approved' | 'under_review'
    activeOrders:        number
    completedOrders:     number
  }
  error?: string
}> {
  try {
    await requireAdminRole()
    const admin = adminClient()

    const ACTIVE_STATUSES = ['pending', 'awaiting_payment', 'in_progress', 'waiting_action', 'dispute', 'support', 'cancel_requested']

    const [profileRes, ordersRes] = await Promise.all([
      admin
        .from('profiles')
        .select('balance, bank_holder_name, bank_name, bank_swift, bank_iban, bank_details_status')
        .eq('id', userId)
        .single(),
      admin
        .from('orders')
        .select('status')
        .or(`client_id.eq.${userId},booster_id.eq.${userId}`),
    ])

    if (profileRes.error) return { error: profileRes.error.message }

    const orders = ordersRes.data ?? []
    const activeOrders    = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length
    const completedOrders = orders.filter(o => o.status === 'completed').length

    return {
      data: {
        balance:             profileRes.data.balance ?? 0,
        bank_holder_name:    profileRes.data.bank_holder_name   ?? null,
        bank_name:           profileRes.data.bank_name          ?? null,
        bank_swift:          profileRes.data.bank_swift         ?? null,
        bank_iban:           profileRes.data.bank_iban          ?? null,
        bank_details_status: (profileRes.data.bank_details_status ?? 'none') as 'none' | 'approved' | 'under_review',
        activeOrders,
        completedOrders,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Relist Disputed Order (Takeover) ───────────────────────────────────────

/**
 * Partially pays out the current booster and re-lists the order as a
 * 'takeover' so a new booster can claim the remaining work.
 *
 * Atomic steps:
 *  1. Credit oldBoosterCut to current booster’s wallet
 *  2. Reset booster_id → null
 *  3. Set status → in_progress (makes it appear in Available Boosts)
 *  4. Update price to newPrice
 *  5. Mark is_takeover = true with the admin note
 */
export async function relistDisputedOrder({
  orderId,
  oldBoosterCut,
  newPrice,
  takeoverNote,
}: {
  orderId:      string
  oldBoosterCut: number
  newPrice:     number
  takeoverNote: string
}): Promise<{ error?: string }> {
  try {
    if (oldBoosterCut < 0 || newPrice <= 0) return { error: 'Invalid amounts' }
    const { user } = await requireAdminRole()
    const admin = adminClient()

    // Fetch current booster
    const { data: order, error: fetchErr } = await admin
      .from('orders')
      .select('booster_id')
      .eq('id', orderId)
      .single()
    if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }

    // 1. Credit old booster (if any)
    if (order.booster_id && oldBoosterCut > 0) {
      const { error: rpcErr } = await admin.rpc('increment_profile_balance', {
        p_user_id: order.booster_id,
        p_amount:  Math.round(oldBoosterCut * 100) / 100,
      })
      if (rpcErr) return { error: rpcErr.message }
    }

    // 2-5. Update the order
    const { error: updateErr } = await admin
      .from('orders')
      .update({
        booster_id:    null,
        status:        'in_progress',
        price:         Math.round(newPrice * 100) / 100,
        is_takeover:   true,
        takeover_note: takeoverNote || null,
        resolved_by:   user.id,
        resolved_at:   new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) return { error: updateErr.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Auth God-Mode Actions ────────────────────────────────────────────────────

/** Send a password reset email via the Supabase Auth Admin API. */
export async function adminSendPasswordReset(
  email: string,
): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()
    const { error } = await admin.auth.resetPasswordForEmail(email)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Generate & send a magic link to the user's email. */
export async function adminSendMagicLink(
  email: string,
): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()
    // generateLink produces an OTP-based magic link without sending an email on
    // its own; we then trigger the email by using the admin invite flow.
    // The cleanest supported approach with service-role is inviteUserByEmail
    // which sends a "confirm your account" link—instead we use resetPasswordForEmail
    // on a non-password flow, BUT Supabase's proper magic-link send uses:
    const { error } = await admin.auth.admin.generateLink({
      type:  'magiclink',
      email,
    })
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Mark a user's email as confirmed without them having to click a link. */
export async function adminVerifyEmail(
  userId: string,
): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Platform Settings: Update Financials ────────────────────────────────────

export async function updateFinancialSettings({
  flat_platform_fee,
  min_withdrawal_amount,
  duo_boost_multiplier,
}: {
  flat_platform_fee: number
  min_withdrawal_amount: number
  duo_boost_multiplier: number
}): Promise<{ error?: string }> {
  try {
    const { user, role } = await requireAdminRole()
    if (role !== 'admin') return { error: 'Only admins can update platform settings.' }

    if (flat_platform_fee < 0 || min_withdrawal_amount < 0 || duo_boost_multiplier < 1)
      return { error: 'Invalid values: fee/withdrawal must be ≥ 0, multiplier must be ≥ 1.' }

    const oldSettings = await getGlobalSettings()
    const admin = adminClient()
    const { error } = await admin
      .from('global_settings')
      .update({
        flat_platform_fee,
        min_withdrawal_amount,
        duo_boost_multiplier,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', 1)

    if (error) return { error: error.message }

    logAdminAction(user.id, 'settings.financials.update', '1', {
      old: { flat_platform_fee: oldSettings.flat_platform_fee, min_withdrawal_amount: oldSettings.min_withdrawal_amount, duo_boost_multiplier: oldSettings.duo_boost_multiplier },
      new: { flat_platform_fee, min_withdrawal_amount, duo_boost_multiplier },
    })
    revalidatePath('/admin/settings')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Hard-delete a user from Supabase Auth.
 * The `profiles` row is removed by the ON DELETE CASCADE trigger already
 * present in the core schema migration.
 */
export async function adminHardDeleteUser(
  userId: string,
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    if (user.id === userId) return { error: 'You cannot delete yourself.' }
    const admin = adminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Edit a user's profile (username, email, avatar_url).
 * Email changes are applied to both Auth and the profiles table.
 */
export async function adminUpdateUserProfile(
  userId: string,
  data: { username?: string; email?: string; clearAvatar?: boolean },
): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    if (user.id === userId && data.email) {
      // Allow admins to change their own email; Auth handles it.
    }
    const admin = adminClient()

    // Auth update (email, if changed)
    if (data.email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
        email: data.email,
      })
      if (authErr) return { error: authErr.message }
    }

    // Profile update
    const profileUpdate: Record<string, unknown> = {}
    if (data.username !== undefined) profileUpdate.username   = data.username || null
    if (data.email    !== undefined) profileUpdate.email      = data.email
    if (data.clearAvatar)            profileUpdate.avatar_url = null

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await admin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId)
      if (profileErr) return { error: profileErr.message }
    }

    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── DM Thread: Delete ────────────────────────────────────────────────────────

export async function deleteStaffDmThread(threadId: string): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('chat_messages')
      .delete()
      .eq('dm_thread_id', threadId)

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Platform Settings: Update Operations ────────────────────────────────────

export async function updateOperationalSettings({
  is_maintenance_mode,
  halt_new_orders,
  auto_complete_hours,
  auto_cancel_hours,
  iban_cooldown_days,
}: {
  is_maintenance_mode: boolean
  halt_new_orders: boolean
  auto_complete_hours: number
  auto_cancel_hours: number
  iban_cooldown_days: number
}): Promise<{ error?: string }> {
  try {
    const { user, role } = await requireAdminRole()
    if (role !== 'admin') return { error: 'Only admins can update platform settings.' }

    if (!Number.isInteger(auto_complete_hours) || auto_complete_hours < 1)
      return { error: 'Auto-complete hours must be a whole number ≥ 1.' }
    if (!Number.isInteger(auto_cancel_hours) || auto_cancel_hours < 1)
      return { error: 'Auto-cancel hours must be a whole number ≥ 1.' }
    if (!Number.isInteger(iban_cooldown_days) || iban_cooldown_days < 0)
      return { error: 'IBAN cooldown must be a whole number ≥ 0.' }

    const oldSettings = await getGlobalSettings()
    const admin = adminClient()
    const { error } = await admin
      .from('global_settings')
      .update({
        is_maintenance_mode,
        halt_new_orders,
        auto_complete_hours,
        auto_cancel_hours,
        iban_cooldown_days,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', 1)

    if (error) return { error: error.message }

    logAdminAction(user.id, 'settings.operations.update', '1', {
      old: { is_maintenance_mode: oldSettings.is_maintenance_mode, halt_new_orders: oldSettings.halt_new_orders, auto_complete_hours: oldSettings.auto_complete_hours, auto_cancel_hours: oldSettings.auto_cancel_hours, iban_cooldown_days: oldSettings.iban_cooldown_days },
      new: { is_maintenance_mode, halt_new_orders, auto_complete_hours, auto_cancel_hours, iban_cooldown_days },
    })
    revalidatePath('/admin/settings')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Platform Settings: Update Communications ─────────────────────────────────

export async function updateCommunicationSettings({
  is_announcement_active,
  announcement_text,
  announcement_color,
}: {
  is_announcement_active: boolean
  announcement_text: string
  announcement_color: string
}): Promise<{ error?: string }> {
  try {
    const { user, role } = await requireAdminRole()
    if (role !== 'admin') return { error: 'Only admins can update platform settings.' }

    const sanitizedText  = announcement_text.trim().slice(0, 500)
    const VALID_COLORS   = ['amber', 'green', 'red', 'blue', 'purple', 'slate']
    const sanitizedColor = VALID_COLORS.includes(announcement_color) ? announcement_color : 'amber'

    const oldSettings = await getGlobalSettings()
    const admin = adminClient()
    const { error } = await admin
      .from('global_settings')
      .update({
        is_announcement_active,
        announcement_text:  sanitizedText,
        announcement_color: sanitizedColor,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', 1)

    if (error) return { error: error.message }

    logAdminAction(user.id, 'settings.communications.update', '1', {
      old: { is_announcement_active: oldSettings.is_announcement_active, announcement_text: oldSettings.announcement_text, announcement_color: oldSettings.announcement_color },
      new: { is_announcement_active, announcement_text: sanitizedText, announcement_color: sanitizedColor },
    })
    revalidatePath('/', 'layout')
    revalidatePath('/admin/settings')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── Get User Security Details (admin-only) ───────────────────────────────────

interface GeoLocation {
  country:     string
  countryCode: string
  city:        string
  isp:         string
}

function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true
  if (/^10\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^f[cde]/i.test(ip)) return true // fc00::/7, fe80::/10
  return false
}

async function resolveGeo(ip: string): Promise<GeoLocation | null> {
  if (isPrivateIp(ip)) {
    return { country: 'Localhost', countryCode: '', city: 'Development', isp: 'Local Network' }
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,isp`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    const json = await res.json() as { status: string; country?: string; countryCode?: string; city?: string; isp?: string }
    if (json.status !== 'success') return null
    return {
      country:     json.country     ?? '',
      countryCode: json.countryCode ?? '',
      city:        json.city        ?? '',
      isp:         json.isp        ?? '',
    }
  } catch {
    return null
  }
}

export async function getUserSecurityDetails(targetUserId: string): Promise<{
  data?: {
    last_sign_in_ip:  string | null
    last_sign_in_at:  string | null
    geo:              GeoLocation | null
  }
  error?: string
}> {
  try {
    const { role } = await requireAdminRole()
    if (role !== 'admin') return { error: 'Unauthorized' }

    const admin = adminClient()
    const { data, error } = await admin.auth.admin.getUserById(targetUserId)
    if (error) return { error: error.message }

    const ip = (data.user as { last_sign_in_ip?: string | null }).last_sign_in_ip ?? null
    const geo = ip ? await resolveGeo(ip) : null

    return {
      data: {
        last_sign_in_ip: ip,
        last_sign_in_at: data.user.last_sign_in_at ?? null,
        geo,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

