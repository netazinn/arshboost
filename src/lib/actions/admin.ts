'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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
  clientPct,
  notes,
}: {
  orderId: string
  clientPct: number
  notes?: string
}): Promise<{ error?: string }> {
  try {
    const { user } = await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('orders')
      .update({
        status: 'completed',
        resolution_client_pct: clientPct,
        resolution_notes: notes ?? null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (error) return { error: error.message }
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

// ─── User Role: Update ────────────────────────────────────────────────────────

export async function updateUserRole(
  userId: string,
  role: 'admin' | 'booster' | 'client' | 'support' | 'accountant',
): Promise<{ error?: string }> {
  try {
    await requireAdminRole()
    const admin = adminClient()

    const { error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
