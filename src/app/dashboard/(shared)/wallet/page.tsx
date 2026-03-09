import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getClientTransactions } from '@/lib/data/wallet'
import { getBoosterOrders } from '@/lib/data/orders'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { WalletView } from '@/components/features/dashboard/WalletView'
import { BoosterWalletView } from '@/components/features/dashboard/BoosterWalletView'
import { Footer } from '@/components/shared/Footer'

export const metadata: Metadata = {
  title: 'Wallet – ArshBoost',
  robots: { index: false },
}

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/auth/login')

  if (profile.role === 'booster') {
    const orders = await getBoosterOrders(user.id)
    return <BoosterWalletView orders={orders} />
  }

  const transactions = await getClientTransactions(user.id)

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={Wallet}
          title="My Wallet"
          subtitle="List of all your payments and transactions."
        />
        <WalletView transactions={transactions} />
      </main>
      <Footer />
    </>
  )
}
