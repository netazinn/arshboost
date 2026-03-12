import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { AdminControlCenter } from '@/components/features/dashboard/AdminControlCenter'
import type { Withdrawal, Profile } from '@/types'

export const metadata = { title: 'Withdrawals & Bank Reviews – ArshBoost', robots: { index: false } }

async function getPendingWithdrawals(): Promise<(Withdrawal & { booster: Profile })[]> {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await admin
    .from('withdrawals')
    .select('*, booster:profiles!withdrawals_booster_id_fkey(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getPendingWithdrawals]', error.message)
    return []
  }
  return (data ?? []) as (Withdrawal & { booster: Profile })[]
}

async function getBankReviews(): Promise<Profile[]> {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('bank_details_status', 'under_review')
    .order('bank_details_updated_at', { ascending: true })

  if (error) {
    console.error('[getBankReviews]', error.message)
    return []
  }
  return (data ?? []) as Profile[]
}

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) redirect('/')

  const [withdrawals, bankReviews] = await Promise.all([
    getPendingWithdrawals(),
    getBankReviews(),
  ])

  return (
    <AdminControlCenter
      initialWithdrawals={withdrawals}
      initialBankReviews={bankReviews}
    />
  )
}
