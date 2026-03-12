import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getBoosterStats } from '@/lib/supabase/queries/booster'
import { BoosterDashboard } from '@/components/features/dashboard/BoosterDashboard'

const ROLE_HOME: Record<string, string> = {
  client:      '/dashboard/orders',
  support:     '/admin',
  admin:       '/admin',
  accountant:  '/admin/withdrawals',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/auth/login')

  if (profile.role === 'booster') {
    const stats = await getBoosterStats(user.id)
    return <BoosterDashboard username={profile.username ?? profile.email} userId={user.id} stats={stats} />
  }

  redirect(ROLE_HOME[profile.role] ?? '/dashboard/orders')
}
