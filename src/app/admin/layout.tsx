import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { AdminSidebar } from '@/components/features/dashboard/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'support', 'accountant'].includes(profile.role)) redirect('/')

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <AdminSidebar
        role={profile.role}
        username={profile.username ?? ''}
        email={profile.email}
      />
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {children}
      </main>
    </div>
  )
}
