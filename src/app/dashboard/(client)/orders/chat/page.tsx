import type { Metadata } from 'next'
import { MessageSquare } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientOrders } from '@/lib/data/orders'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { ChatInboxLayout } from '@/components/features/dashboard/ChatInboxLayout'
import { Footer } from '@/components/shared/Footer'
import type { Profile } from '@/types'

export const metadata: Metadata = {
  title: 'Orders Chat – ArshBoost',
  robots: { index: false },
}

export default async function OrdersChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const orders = await getClientOrders(user.id)

  const currentUser: Pick<Profile, 'id' | 'role'> = { id: user.id, role: 'client' }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={MessageSquare}
          title="Orders Chat"
          subtitle="All your order chats in one place."
        />
        <ChatInboxLayout
          userId={user.id}
          role="client"
          orders={orders}
          currentUser={currentUser}
        />
      </main>
      <Footer />
    </>
  )
}
