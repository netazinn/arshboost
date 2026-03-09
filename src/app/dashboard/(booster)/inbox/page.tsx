import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchDmLastMessages } from '@/lib/actions/chat'
import { getBoosterInboxOrders } from '@/lib/data/orders'
import { ChatInboxLayout } from '@/components/features/dashboard/ChatInboxLayout'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { Footer } from '@/components/shared/Footer'
import type { Profile } from '@/types'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch in parallel: DM previews + visible order chats (30-day rule applied)
  const [lastDmMessages, orders] = await Promise.all([
    fetchDmLastMessages(user.id),
    getBoosterInboxOrders(user.id),
  ])

  const currentUser: Pick<Profile, 'id' | 'role'> = { id: user.id, role: 'booster' }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={MessageSquare}
          title="Chat Inbox"
          subtitle="Staff channels and your active order conversations."
        />
        <ChatInboxLayout
          userId={user.id}
          role="booster"
          orders={orders}
          lastDmMessages={lastDmMessages}
          currentUser={currentUser}
        />
      </main>
      <Footer />
    </>
  )
}
