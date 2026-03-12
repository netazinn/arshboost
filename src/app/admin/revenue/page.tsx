import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getRevenueStats } from '@/lib/actions/revenue'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { MetricCards } from './_components/MetricCards'
import { DailyRevenueChart } from './_components/DailyRevenueChart'
import { RevenueByGameChart } from './_components/RevenueByGameChart'
import { RefreshButton } from './_components/RefreshButton'
import { BarChart2 } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Revenue – ArshBoost', robots: { index: false } }

export default async function AdminRevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) redirect('/admin')

  const stats = await getRevenueStats()

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <DashboardPageHeader
          icon={BarChart2}
          title="Revenue Overview"
          subtitle="Platform-wide financial analytics."
        />
        <RefreshButton />
      </div>

      {/* Metric cards */}
      <MetricCards
        totalVolume={stats.totalVolume}
        platformNetProfit={stats.platformNetProfit}
        pendingBoosterBalances={stats.pendingBoosterBalances}
        totalCompletedOrders={stats.totalCompletedOrders}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DailyRevenueChart data={stats.dailyRevenue} />
        </div>
        <div className="xl:col-span-1">
          <RevenueByGameChart data={stats.revenueByGame} />
        </div>
      </div>

      {/* Orders breakdown table */}
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3">
          <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-[#c8c8c8]">
            Top Orders — Revenue Breakdown
          </p>
        </div>
        <RevenueOrdersTable stats={stats} />
      </div>
    </main>
  )
}

// ─── Server-rendered orders table ─────────────────────────────────────────────
// Keep this inline since it only needs the already-fetched stats shape.
// We re-fetch orders specifically for the table to include joins for display.

import { getAllOrdersAdmin } from '@/lib/data/admin'

async function RevenueOrdersTable({ stats: _stats }: { stats: Awaited<ReturnType<typeof getRevenueStats>> }) {
  const orders = await getAllOrdersAdmin()

  const STATUS_CLS: Record<string, string> = {
    completed:      'border-green-500/30 bg-green-500/10 text-green-400',
    approved:       'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    waiting_action: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    in_progress:    'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    dispute:        'border-orange-500/30 bg-orange-500/10 text-orange-400',
    cancelled:      'border-red-500/30 bg-red-500/10 text-red-400',
    pending:        'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]',
    support:        'border-blue-500/30 bg-blue-500/10 text-blue-400',
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#0f0f0f] bg-[#0a0a0a]">
          {['Order', 'Client', 'Game', 'Status', 'Price', 'Date'].map((h) => (
            <th key={h} className="px-5 py-2.5 text-left font-mono text-[9px] font-semibold tracking-[0.05em] uppercase text-[#4a4a4a]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.slice(0, 50).map((o) => {
          const d = (o.details ?? {}) as Record<string, string>
          const title = d.current_rank && d.target_rank
            ? `${d.current_rank} → ${d.target_rank}`
            : o.service?.label ?? 'Order'
          return (
            <tr key={o.id} className="border-b border-[#0a0a0a] hover:bg-[#0d0d0d] transition-colors">
              <td className="px-5 py-3">
                <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-white truncate max-w-[160px]">{title}</p>
                <p className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">#{o.id.slice(0, 8).toUpperCase()}</p>
              </td>
              <td className="px-5 py-3">
                <span className="font-mono text-[10px] text-[#9a9a9a] tracking-[-0.04em]">
                  {o.client?.username ?? o.client?.email ?? '—'}
                </span>
              </td>
              <td className="px-5 py-3">
                <span className="font-mono text-[10px] text-[#9a9a9a] tracking-[-0.04em]">{o.game?.name ?? '—'}</span>
              </td>
              <td className="px-5 py-3">
                <span className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[8px] tracking-[-0.02em] ${STATUS_CLS[o.status] ?? STATUS_CLS.pending}`}>
                  {o.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-5 py-3">
                <span className="font-mono text-[10px] font-semibold text-white tracking-[-0.04em]">${o.price.toFixed(2)}</span>
              </td>
              <td className="px-5 py-3">
                <span className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.04em]">
                  {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

