import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllWithdrawals } from '@/lib/data/admin'
import { WithdrawalsTable } from '@/components/features/dashboard/WithdrawalsTable'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function WithdrawalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const withdrawals = await getAllWithdrawals()

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={DollarSign}
          title="Withdrawal Requests"
          subtitle="Review and approve booster withdrawal requests."
        />
        <WithdrawalsTable initialWithdrawals={withdrawals} reviewerId={user.id} />
      </main>
    </>
  )
}
