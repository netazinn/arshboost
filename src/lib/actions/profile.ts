'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ProfileActionState {
  error: string | null
  success: boolean
}

export async function updateProfileAction(
  data: { username?: string; avatar_url?: string }
): Promise<ProfileActionState> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Unauthorized.', success: false }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(data.username !== undefined && { username: data.username }),
      ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath('/dashboard/settings')
  return { error: null, success: true }
}

export async function saveBankDetailsAction(data: {
  bank_name: string
  bank_swift: string
  bank_iban: string
}): Promise<ProfileActionState> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized.', success: false }

  // ── KYC guard: must be ID-verified before saving bank details ─────────────
  const { data: verification } = await supabase
    .from('booster_verifications')
    .select('verification_status, first_name, last_name')
    .eq('user_id', user.id)
    .single()

  if (!verification || verification.verification_status !== 'approved') {
    return {
      error: 'Identity verification must be approved before adding payout details.',
      success: false,
    }
  }

  // Legal name is sourced strictly from the approved verification record —
  // never from the client payload.
  const verifiedName = [verification.first_name, verification.last_name]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()

  // Fetch current bank status to enforce 30-day lockout
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('bank_details_status, bank_details_updated_at')
    .eq('id', user.id)
    .single()
  if (fetchError || !profile) return { error: 'Profile not found.', success: false }

  const isFirstTime = !profile.bank_details_status || profile.bank_details_status === 'none'

  if (!isFirstTime && profile.bank_details_updated_at) {
    const daysSince =
      (Date.now() - new Date(profile.bank_details_updated_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince < 30) {
      const daysLeft = Math.ceil(30 - daysSince)
      return {
        error: `Bank details can only be updated once every 30 days. ${daysLeft} day(s) remaining.`,
        success: false,
      }
    }
  }

  const newStatus = isFirstTime ? 'approved' : 'under_review'

  const { error } = await supabase
    .from('profiles')
    .update({
      bank_holder_name:        verifiedName,
      bank_name:               data.bank_name.trim(),
      bank_swift:              data.bank_swift.trim(),
      bank_iban:               data.bank_iban.trim(),
      bank_details_status:     newStatus,
      bank_details_updated_at: new Date().toISOString(),
      updated_at:              new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message, success: false }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/wallet')
  return { error: null, success: true }
}
