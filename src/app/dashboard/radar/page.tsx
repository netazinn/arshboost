import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllOrdersAdmin } from '@/lib/data/admin'
import { KanbanBoard } from '@/components/features/dashboard/KanbanBoard'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { Radar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RadarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'support', 'accountant'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const orders = await getAllOrdersAdmin()

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1600px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={Radar}
          title="Kanban Radar"
          subtitle="Live overview of all orders — auto-updates via Realtime."
        />
        <KanbanBoard initialOrders={orders} />
      </main>
    </>
  )
}
