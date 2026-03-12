'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { parseISO, isValid, differenceInYears } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'start_verification' | 'under_review' | 'approved' | 'declined'

export interface VerificationRecord {
  id: string
  user_id: string
  verification_status: VerificationStatus
  first_name: string | null
  last_name: string | null
  dob: string | null
  id_type: 'passport' | 'national_id' | null
  id_serial_number: string | null
  id_document_url: string | null
  id_selfie_url: string | null
  proof_of_address_text: string | null
  proof_of_address_url: string | null
  discord_username: string | null
  discord_unique_id: string | null
  discord_avatar_url: string | null
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Booster: get own verification record ────────────────────────────────────

export async function getMyVerification(): Promise<VerificationRecord | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('booster_verifications')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (data as VerificationRecord | null) ?? null
}

// ─── Booster: submit full ID verification ────────────────────────────────────

export async function submitIDVerification(payload: {
  first_name: string
  last_name: string
  dob: string
  id_type: 'passport' | 'national_id'
  id_serial_number: string
  id_document_path: string
  id_selfie_path: string
  proof_of_address_text: string
  proof_of_address_path: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Server-side age validation — cannot be bypassed by the client
  const parsedDob = parseISO(payload.dob)
  if (!isValid(parsedDob) || differenceInYears(new Date(), parsedDob) < 18) {
    return { error: 'You must be at least 18 years old.' }
  }

  const { error } = await supabase
    .from('booster_verifications')
    .upsert(
      {
        user_id:               user.id,
        verification_status:   'under_review',
        first_name:            payload.first_name,
        last_name:             payload.last_name,
        dob:                   payload.dob,
        id_type:               payload.id_type,
        id_serial_number:      payload.id_serial_number,
        id_document_url:       payload.id_document_path,
        id_selfie_url:         payload.id_selfie_path,
        proof_of_address_text: payload.proof_of_address_text,
        proof_of_address_url:  payload.proof_of_address_path,
        updated_at:            new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

// ─── Booster: submit Discord linking ─────────────────────────────────────────

export async function submitDiscordVerification(payload: {
  discord_username: string
  discord_unique_id: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('booster_verifications')
    .upsert(
      {
        user_id:           user.id,
        discord_username:  payload.discord_username,
        discord_unique_id: payload.discord_unique_id,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

// ─── Admin: get verification record for any user ──────────────────────────────

export async function getVerificationForAdmin(userId: string): Promise<{
  data?: VerificationRecord
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'support'].includes(profile.role)) return { error: 'Insufficient permissions' }

  const admin = serviceClient()
  const { data, error } = await admin
    .from('booster_verifications')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // PGRST116 = no row found — not an error, just no record
    if (error.code === 'PGRST116') return {}
    return { error: error.message }
  }

  return { data: data as VerificationRecord }
}

// ─── Support: save admin notes without changing verification status ───────────

export async function saveVerificationNotes(
  userId: string,
  notes: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'support'].includes(profile.role)) {
    return { error: 'Insufficient permissions' }
  }

  const admin = serviceClient()
  const { error } = await admin
    .from('booster_verifications')
    .update({
      admin_notes: notes || null,
      updated_at:  new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return {}
}

// ─── Admin: generate a 1-hour signed URL for a stored document ───────────────

export async function getVerificationDocumentUrl(storagePath: string): Promise<{
  url?: string
  error?: string
}> {
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
  const { data, error } = await admin.storage
    .from('verification_documents')
    .createSignedUrl(storagePath, 3600)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─── Admin: approve or decline a booster's verification ──────────────────────

export async function updateVerificationStatus(
  userId: string,
  status: 'approved' | 'declined',
  notes?: string,
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

  const { error } = await admin
    .from('booster_verifications')
    .update({
      verification_status: status,
      admin_notes:         notes ?? null,
      reviewed_by:         user.id,
      reviewed_at:         new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) return { error: error.message }

  // Notify the booster
  const title = status === 'approved' ? 'Identity Verified ✓' : 'Verification Declined'
  const body  = status === 'approved'
    ? 'Your identity has been successfully verified. You now have full access to all platform features.'
    : `Your verification submission was declined.${notes ? ` Reason: ${notes}` : ''} Please contact support if you have questions.`

  await admin.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type: 'system',
    read: false,
  })

  return {}
}
