import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllUsers } from '@/lib/data/admin'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { Users } from 'lucide-react'
import { updateUserRole } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const users = await getAllUsers()

  const ROLE_BADGE: Record<string, string> = {
    admin:      'border-red-500/30 bg-red-500/10 text-red-400',
    support:    'border-blue-500/30 bg-blue-500/10 text-blue-400',
    accountant: 'border-green-500/30 bg-green-500/10 text-green-400',
    booster:    'border-purple-500/30 bg-purple-500/10 text-purple-400',
    client:     'border-[#3a3a3a] bg-[#1a1a1a] text-[#9a9a9a]',
  }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={Users}
          title="User Management"
          subtitle={`${users.length} total users on the platform.`}
        />
        <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                {['User', 'Email', 'Role', 'Joined'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[9px] font-semibold tracking-[0.05em] uppercase text-[#4a4a4a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#0f0f0f] hover:bg-[#0d0d0d] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white">
                      {u.username ?? '(no username)'}
                    </p>
                    <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] mt-0.5">
                      #{u.id.slice(0, 8).toUpperCase()}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">{u.email}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${ROLE_BADGE[u.role] ?? ROLE_BADGE.client}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
