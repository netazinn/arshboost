import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllOrdersAdmin } from '@/lib/data/admin'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { BarChart2, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const orders = await getAllOrdersAdmin()

  const completedOrders = orders.filter((o) => o.status === 'completed')
  const totalRevenue    = orders.reduce((sum, o) => sum + o.price, 0)
  const completedRev    = completedOrders.reduce((sum, o) => sum + o.price, 0)
  const activeOrders    = orders.filter((o) => o.status === 'in_progress')
  const disputedOrders  = orders.filter((o) => ['dispute', 'support'].includes(o.status))

  const STATS = [
    { label: 'Total Revenue (All Orders)', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-white',       border: 'border-[#2a2a2a]' },
    { label: 'Completed Revenue',          value: `$${completedRev.toFixed(2)}`,  icon: TrendingUp,  color: 'text-green-400',  border: 'border-green-500/20' },
    { label: 'Active Orders',              value: String(activeOrders.length),    icon: ShoppingCart,color: 'text-yellow-400', border: 'border-yellow-500/20' },
    { label: 'Disputed / Support',         value: String(disputedOrders.length),  icon: BarChart2,   color: 'text-orange-400', border: 'border-orange-500/20' },
  ]

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={BarChart2}
          title="Revenue Overview"
          subtitle="Platform-wide financial summary."
        />

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map(({ label, value, icon: Icon, color, border }) => (
            <div key={label} className={`rounded-xl border ${border} bg-[#0f0f0f] p-5 flex flex-col gap-3`}>
              <Icon size={18} strokeWidth={1.5} className={`${color}`} />
              <div>
                <p className={`font-mono text-2xl font-bold tracking-[-0.07em] ${color}`}>{value}</p>
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Orders breakdown table */}
        <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
          <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3">
            <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-[#c8c8c8]">
              All Orders — Revenue Breakdown
            </p>
          </div>
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
                const STATUS_CLS: Record<string, string> = {
                  completed:  'border-green-500/30 bg-green-500/10 text-green-400',
                  in_progress:'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
                  dispute:    'border-orange-500/30 bg-orange-500/10 text-orange-400',
                  cancelled:  'border-red-500/30 bg-red-500/10 text-red-400',
                  pending:    'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]',
                  support:    'border-blue-500/30 bg-blue-500/10 text-blue-400',
                }
                const d = (o.details ?? {}) as Record<string, string>
                const title = d.current_rank && d.target_rank ? `${d.current_rank} → ${d.target_rank}` : o.service?.label ?? 'Order'
                return (
                  <tr key={o.id} className="border-b border-[#0a0a0a] hover:bg-[#0d0d0d] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-white truncate max-w-[160px]">{title}</p>
                      <p className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">#{o.id.slice(0,8).toUpperCase()}</p>
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
                        {o.status.replace('_', ' ')}
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
        </div>
      </main>
    </>
  )
}
