import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getProfile } from '@/lib/data/profiles'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { ActivityTable } from './_components/ActivityTable'
import { LogFilters, type FilterValues } from './_components/LogFilters'
import type { ActivityLog } from './_components/types'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Activity Logs – ArshBoost', robots: { index: false } }

export type { ActivityLog } from './_components/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// All action types that logAdminAction() can emit — used for the filter dropdown.
const KNOWN_ACTION_TYPES = [
  'user.banned',
  'user.unbanned',
  'user.role.changed',
  'withdrawal.approved',
  'withdrawal.rejected',
  'settings.financials.update',
  'settings.operations.update',
  'settings.communications.update',
]

// ─── Service client factory ───────────────────────────────────────────────────

function makeAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
type AdminClient = ReturnType<typeof makeAdminClient>

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getActivityLogs(
  svc: AdminClient,
  page: number,
  filters: FilterValues,
): Promise<{ logs: ActivityLog[]; total: number }> {
  const rangeFrom = (page - 1) * PAGE_SIZE
  const rangeTo   = rangeFrom + PAGE_SIZE - 1

  let query = svc
    .from('activity_logs')
    .select('id, admin_id, action_type, target_id, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (filters.search) query = query.ilike('target_id', `%${filters.search}%`)
  if (filters.admin)  query = query.eq('admin_id', filters.admin)
  if (filters.type)   query = query.eq('action_type', filters.type)
  if (filters.from)   query = query.gte('created_at', `${filters.from}T00:00:00.000Z`)
  if (filters.to)     query = query.lte('created_at', `${filters.to}T23:59:59.999Z`)

  const { data, error, count } = await query

  if (error) {
    console.error('[getActivityLogs]', error.message)
    return { logs: [], total: 0 }
  }

  const rows = data ?? []
  const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean))]
  const profileMap = new Map<string, { id: string; username: string | null; email: string }>()

  if (adminIds.length > 0) {
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, username, email')
      .in('id', adminIds)
    for (const p of profiles ?? []) profileMap.set(p.id, p)
  }

  const logs: ActivityLog[] = rows.map((row) => ({
    ...row,
    admin: profileMap.get(row.admin_id) ?? null,
  }))

  return { logs, total: count ?? 0 }
}

async function getAdminOptions(
  svc: AdminClient,
): Promise<{ id: string; label: string }[]> {
  // Query profiles with admin-capable roles rather than scanning all logs —
  // bounded set, index-friendly, and includes admins with zero actions yet.
  const { data } = await svc
    .from('profiles')
    .select('id, username, email')
    .in('role', ['admin', 'accountant'])
    .order('username', { ascending: true })

  return (data ?? []).map((p) => ({
    id:    p.id,
    label: p.username ?? p.email ?? p.id.slice(0, 8),
  }))
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function pageUrl(filters: FilterValues, page: number): string {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.admin)  qs.set('admin',  filters.admin)
  if (filters.type)   qs.set('type',   filters.type)
  if (filters.from)   qs.set('from',   filters.from)
  if (filters.to)     qs.set('to',     filters.to)
  if (page > 1)       qs.set('page',   String(page))
  const s = qs.toString()
  return `/admin/activity-logs${s ? `?${s}` : ''}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) redirect('/admin')

  const raw = await searchParams
  const str = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key]) ?? ''

  const page    = Math.max(1, parseInt(str('page') || '1', 10))
  const filters: FilterValues = {
    search: str('search'),
    admin:  str('admin'),
    type:   str('type'),
    from:   str('from'),
    to:     str('to'),
  }

  const svc = makeAdminClient()
  const [{ logs, total }, adminOptions] = await Promise.all([
    getActivityLogs(svc, page, filters),
    getAdminOptions(svc),
  ])

  const totalPages   = Math.ceil(total / PAGE_SIZE)
  const activeFilters = Object.values(filters).some(Boolean)

  const PAGINATION_BTN =
    'flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 font-mono text-[10px] font-semibold text-[#9a9a9a] tracking-[-0.03em] hover:border-[#6e6d6f] hover:text-white transition-colors duration-200 ease-in-out'
  const PAGINATION_DISABLED =
    'flex items-center gap-1.5 rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[10px] font-semibold text-[#3a3a3a] tracking-[-0.03em] cursor-not-allowed select-none'

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      <DashboardPageHeader
        icon={ScrollText}
        title="Activity Logs"
        subtitle={`Audit trail of all administrative actions. ${total.toLocaleString()} result${total !== 1 ? 's' : ''}${activeFilters ? ' (filtered)' : ''}.`}
      />

      {/* Log table + filter toolbar */}
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        {/* Card header */}
        <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3 flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-[#c8c8c8]">
            Admin Actions Feed
          </p>
          <p className="font-mono text-[10px] text-[#4a4a4a] tracking-[-0.04em]">
            Page {page} of {Math.max(1, totalPages)}
          </p>
        </div>

        {/* Filter toolbar */}
        <LogFilters
          adminOptions={adminOptions}
          actionTypes={KNOWN_ACTION_TYPES}
          initial={filters}
        />

        {/* Table or empty state */}
        {logs.length > 0 ? (
          <ActivityTable logs={logs} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="font-mono text-[11px] text-[#4a4a4a] tracking-[-0.03em]">
              {activeFilters
                ? 'No logs found for these criteria.'
                : 'No activity logs yet.'}
            </p>
            {activeFilters && (
              <Link
                href="/admin/activity-logs"
                className="font-mono text-[10px] text-[#6e6d6f] hover:text-white transition-colors duration-200 underline underline-offset-2"
              >
                Clear filters
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={pageUrl(filters, page - 1)} className={PAGINATION_BTN}>
              <ChevronLeft size={11} strokeWidth={2} />
              Prev
            </Link>
          ) : (
            <span className={PAGINATION_DISABLED}>
              <ChevronLeft size={11} strokeWidth={2} />
              Prev
            </span>
          )}

          <span className="font-mono text-[10px] text-[#4a4a4a] tracking-[-0.03em] px-2">
            {page} / {totalPages}
          </span>

          {page < totalPages ? (
            <Link href={pageUrl(filters, page + 1)} className={PAGINATION_BTN}>
              Next
              <ChevronRight size={11} strokeWidth={2} />
            </Link>
          ) : (
            <span className={PAGINATION_DISABLED}>
              Next
              <ChevronRight size={11} strokeWidth={2} />
            </span>
          )}
        </div>
      )}
    </main>
  )
}
