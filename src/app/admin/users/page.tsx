import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllUsers } from '@/lib/data/admin'
import type { UserFilter, UserSort } from '@/lib/data/admin'
import type { Profile } from '@/types'
import { getUsersByIp } from '@/lib/actions/security'
import { isIpAddress } from '@/lib/utils/security-utils'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { UsersTable } from './_components/UsersTable'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'support'].includes(profile.role)) redirect('/admin')

  const sp     = await searchParams
  const search = typeof sp.search === 'string' ? sp.search : ''
  const filter = (typeof sp.filter === 'string' ? sp.filter : 'all') as UserFilter
  const sort   = (typeof sp.sort   === 'string' ? sp.sort   : 'newest') as UserSort

  const isIpSearch = profile.role === 'admin' && isIpAddress(search.trim())

  let users
  let ipSearchCount: number | undefined

  if (isIpSearch) {
    const res = await getUsersByIp(search.trim())
    users = (res.data ?? []) as unknown as Profile[]
    ipSearchCount = users.length
  } else {
    users = await getAllUsers({ search, filter, sort })
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      <DashboardPageHeader
        icon={Users}
        title="User Management"
        subtitle={isIpSearch
          ? `IP search: ${users.length} user${users.length !== 1 ? 's' : ''} sharing ${search.trim()}`
          : `${users.length} users matching current filters.`
        }
      />
      <UsersTable
        initialUsers={users as Profile[]}
        currentUserId={user.id}
        currentUserRole={profile.role}
        initialSearch={search}
        initialFilter={filter}
        initialSort={sort}
        isIpSearch={isIpSearch}
        ipSearchQuery={isIpSearch ? search.trim() : undefined}
      />
    </main>
  )
}
