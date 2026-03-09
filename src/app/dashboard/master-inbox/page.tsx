import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllOrdersAdmin, getOrderAdmin, getOrderMessagesAdmin } from '@/lib/data/admin'
import { AdminMasterInbox } from '@/components/features/dashboard/AdminMasterInbox'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { MessageSquare } from 'lucide-react'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ order?: string }>
}

export default async function MasterInboxPage({ searchParams }: Props) {
  const { order: orderId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'support', 'accountant'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const [orders, initialOrder, initialMessages] = await Promise.all([
    getAllOrdersAdmin(),
    orderId ? getOrderAdmin(orderId) : Promise.resolve(null),
    orderId ? getOrderMessagesAdmin(orderId) : Promise.resolve([]),
  ])

  const currentUser: Pick<Profile, 'id' | 'role'> = { id: user.id, role: profile.role }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1600px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={MessageSquare}
          title="Master Inbox"
          subtitle="God-mode chat — intervene in any order conversation."
        />
        <AdminMasterInbox
          orders={orders}
          initialOrder={initialOrder}
          initialMessages={initialMessages}
          currentUser={currentUser}
        />
      </main>
    </>
  )
}
