import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getAllTips } from '@/lib/data/admin'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { Medal } from 'lucide-react'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TipsHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const tips = await getAllTips()

  const totalEarned = tips.reduce((sum, o) => sum + o.price, 0)

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      <DashboardPageHeader
        icon={Medal}
        title="Tips History"
        subtitle="Global booster earnings — all completed orders across the platform."
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
          <p className="font-mono text-[10px] tracking-widest text-[#6e6d6f] uppercase mb-2">Total Completed</p>
          <p className="font-mono text-3xl font-bold tracking-[-0.07em] text-white">{tips.length}</p>
          <p className="font-mono text-[10px] text-[#4a4a4a] mt-1">orders</p>
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
          <p className="font-mono text-[10px] tracking-widest text-[#6e6d6f] uppercase mb-2">Total Paid Out</p>
          <p className="font-mono text-3xl font-bold tracking-[-0.07em] text-green-400">
            ${totalEarned.toFixed(2)}
          </p>
          <p className="font-mono text-[10px] text-[#4a4a4a] mt-1">across all boosters</p>
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
          <p className="font-mono text-[10px] tracking-widest text-[#6e6d6f] uppercase mb-2">Active Boosters</p>
          <p className="font-mono text-3xl font-bold tracking-[-0.07em] text-white">
            {new Set(tips.map(o => o.booster_id).filter(Boolean)).size}
          </p>
          <p className="font-mono text-[10px] text-[#4a4a4a] mt-1">unique earners</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                {['Order', 'Game', 'Booster', 'Client', 'Amount', 'Date'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[9px] tracking-[0.08em] text-[#4a4a4a] uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-mono text-[11px] text-[#3a3a3a]">
                    No completed orders yet.
                  </td>
                </tr>
              ) : (
                tips.map((order: Order) => {
                  const details = (order.details ?? {}) as Record<string, string>
                  const title = details.current_rank && details.target_rank
                    ? `${details.current_rank} → ${details.target_rank}`
                    : order.service?.label ?? 'Order'
                  const gameIcon = GAME_ICONS[order.game?.name ?? '']
                  const boosterName = order.booster?.username ?? order.booster?.email ?? '—'
                  const clientName  = order.client?.username  ?? order.client?.email  ?? '—'

                  return (
                    <tr key={order.id} className="border-b border-[#0f0f0f] hover:bg-[#0f0f0f] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-[11px] font-semibold tracking-[-0.05em] text-white">{title}</p>
                        <p className="font-mono text-[9px] text-[#4a4a4a] mt-0.5">#{order.id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {gameIcon
                            ? <Image src={gameIcon} alt={order.game?.name ?? ''} width={16} height={16} className="h-4 w-4 rounded-sm shrink-0 object-cover" />
                            : <div className="h-4 w-4 rounded-sm bg-[#2a2a2a] shrink-0" />
                          }
                          <span className="font-mono text-[10px] text-[#c8c8c8] tracking-[-0.04em]">
                            {order.game?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] text-white tracking-[-0.04em]">{boosterName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] text-[#9a9a9a] tracking-[-0.04em]">{clientName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-bold text-green-400 tracking-[-0.04em]">
                          ${order.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.03em]">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
