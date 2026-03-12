'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getGlobalSettings } from '@/lib/data/settings'

export async function requestWithdrawalAction(
  amount: number,
): Promise<{ error?: string; withdrawalId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0)
    return { error: 'Invalid amount.' }

  const { min_withdrawal_amount } = await getGlobalSettings()
  if (amount < min_withdrawal_amount)
    return { error: `Minimum withdrawal amount is $${min_withdrawal_amount}.` }

  // Read bank details from profile — validates status server-side
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('bank_iban, bank_details_status')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return { error: 'Profile not found.' }
  if (profile.bank_details_status !== 'approved')
    return { error: 'Bank details must be approved before requesting a withdrawal. Please update your bank details in Settings.' }
  if (!profile.bank_iban)
    return { error: 'No IBAN on file. Please add your bank details in Settings.' }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await admin.rpc('request_withdrawal', {
    p_user_id:        user.id,
    p_amount:         amount,
    p_payout_details: profile.bank_iban,
  })

  if (error) {
    if (error.message.includes('BELOW_MINIMUM'))          return { error: `Minimum withdrawal amount is $${min_withdrawal_amount}.` }
    if (error.message.includes('INSUFFICIENT_BALANCE'))   return { error: 'Insufficient balance.' }
    if (error.message.includes('MISSING_PAYOUT_DETAILS')) return { error: 'Payout destination is required.' }
    if (error.message.includes('USER_NOT_FOUND'))         return { error: 'User profile not found.' }
    console.error('[requestWithdrawalAction]', error.message)
    return { error: 'Failed to process withdrawal. Please try again.' }
  }

  revalidatePath('/dashboard/wallet')
  return { withdrawalId: data as string }
}
