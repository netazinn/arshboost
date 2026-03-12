import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { BoosterSidebar } from '@/components/features/dashboard/BoosterSidebar'
import { Navbar } from '@/components/shared/Navbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/auth/login')

  // Block suspended users — sign them out so the session is cleared
  if (profile.is_banned) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  if (profile.role === 'admin') redirect('/admin')

  if (profile.role === 'booster') {
    return (
      <div className="flex h-screen overflow-hidden bg-black">
        <BoosterSidebar />
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-black">
      <Navbar />
      {children}
    </div>
  )
}
