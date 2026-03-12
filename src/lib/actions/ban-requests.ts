'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BanRequestStatus = 'pending' | 'approved' | 'rejected'
export type BanRequestAction = 'ban' | 'unban'

export interface BanRequest {
  id:           string
  target_id:    string
  requested_by: string
  action:       BanRequestAction
  reason:       string | null
  status:       BanRequestStatus
  resolved_by:  string | null
  resolved_at:  string | null
  created_at:   string
  target?:      { username: string | null; email: string }
  requester?:   { username: string | null; email: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Submit a ban/unban request (support + admin) ────────────────────────────

export async function submitBanRequest(
  targetId: string,
  action: BanRequestAction,
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['support', 'admin'].includes(profile.role)) {
    return { error: 'Insufficient permissions' }
  }

  if (!reason.trim()) return { error: 'A reason is required.' }

  const { error } = await supabase
    .from('ban_requests')
    .insert({
      target_id:    targetId,
      requested_by: user.id,
      action,
      reason: reason.trim(),
    })

  if (error) return { error: error.message }

  revalidatePath('/admin/ban-requests')
  return {}
}

// ─── Get pending/resolved ban requests (admin only) ──────────────────────────

export async function getBanRequests(
  status: BanRequestStatus | 'all' = 'all',
): Promise<{ data?: BanRequest[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return { error: 'Insufficient permissions' }

  const admin = serviceClient()

  let query = admin
    .from('ban_requests')
    .select(`
      *,
      target:profiles!ban_requests_target_id_fkey(username, email),
      requester:profiles!ban_requests_requested_by_fkey(username, email)
    `)
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return { error: error.message }

  return { data: data as BanRequest[] }
}

// ─── Resolve a ban request (admin only) ──────────────────────────────────────

export async function resolveBanRequest(
  requestId: string,
  approve: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return { error: 'Insufficient permissions' }

  const admin = serviceClient()

  const { data: req, error: reqErr } = await admin
    .from('ban_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return { error: reqErr?.message ?? 'Request not found' }
  if (req.status !== 'pending') return { error: 'This request has already been resolved.' }

  const { error: updateErr } = await admin
    .from('ban_requests')
    .update({
      status:      approve ? 'approved' : 'rejected',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateErr) return { error: updateErr.message }

  // If approved, perform the actual ban/unban on the target profile
  if (approve) {
    const { error: banErr } = await admin
      .from('profiles')
      .update({ is_banned: req.action === 'ban' })
      .eq('id', req.target_id)

    if (banErr) return { error: banErr.message }
  }

  revalidatePath('/admin/ban-requests')
  revalidatePath('/admin/users')
  return {}
}

// ─── Count pending ban requests (for sidebar badge) ───────────────────────────

export async function getPendingBanRequestCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return 0

  const admin = serviceClient()
  const { count } = await admin
    .from('ban_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return count ?? 0
}
