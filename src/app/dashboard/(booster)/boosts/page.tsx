import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert, ArrowRight, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveBoosterOrder, getAvailableBoosts } from '@/lib/supabase/queries/booster'
import { Button } from '@/components/ui/button'
import { JobCard } from './_components/JobCard'
import type { BoostDisplay } from './_components/JobCard'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

// ── Helpers ──────────────────────────────────────────────────────────────────────

const SERVER_LABELS: Record<string, string> = {
  EU:    'Europe',
  NA:    'North America',
  AP:    'Asia Pacific',
  BR:    'Brazil',
  KR:    'Korea',
  LATAM: 'Latin America',
}

function formatTimeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Maps a DB Order row to the BoostDisplay shape the JobCard client component expects. */
function orderToBoost(order: Order): BoostDisplay {
  const d = (order.details ?? {}) as Record<string, unknown>

  // options sub-object (rank_boost): { priority, stream, solo_queue, bonus_win, agents }
  const optObj = (d.options && typeof d.options === 'object' && !Array.isArray(d.options))
    ? (d.options as Record<string, unknown>)
    : null

  const optionLabels: string[] = []
  if (optObj?.priority)   optionLabels.push('Priority Queue')
  if (optObj?.stream)     optionLabels.push('Stream Games')
  if (optObj?.solo_queue) optionLabels.push('Solo Queue')
  if (optObj?.bonus_win)  optionLabels.push('Bonus Win')

  const agents = Array.isArray(optObj?.agents) ? (optObj!.agents as string[]) : []
  const server = typeof d.server === 'string' ? d.server : ''

  return {
    id:           order.id,
    shortId:      order.id.slice(0, 8).toUpperCase(),
    game:         order.game?.name  ?? 'Valorant',
    service:      order.service?.label ?? '',
    startRank:    typeof d.current_rank === 'string' ? d.current_rank : null,
    endRank:      typeof d.target_rank  === 'string' ? d.target_rank  : null,
    startRRRange: typeof d.rr_range     === 'string' ? d.rr_range     : null,
    targetRR:     typeof d.target_immortal_rr === 'number' ? d.target_immortal_rr : null,
    server,
    serverFull:   SERVER_LABELS[server.toUpperCase()] ?? server,
    queue:        typeof d.queue === 'string' ? d.queue : '',
    options:      optionLabels,
    agents,
    wins:         typeof d.wins === 'number' ? d.wins : undefined,
    payout:       order.price,
    postedAt:     formatTimeAgo(order.created_at),
  }
}


// ── Lock screen ──────────────────────────────────────────────────────────────

function LockScreen({ orderId }: { orderId: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-8 text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-yellow-500/25 bg-yellow-500/10">
            <ShieldAlert size={26} strokeWidth={1.5} className="text-yellow-400" />
          </div>
        </div>
        <h2 className="mb-2 text-[15px] font-semibold text-foreground">
          Active Boost in Progress
        </h2>
        <p className="mb-7 text-[12px] leading-relaxed text-muted-foreground">
          You must complete your current order before you can claim a new one.
          Focusing on one client at a time ensures the best quality of service.
        </p>
        <Button asChild className="w-full gap-2">
          <Link href={`/dashboard/boosts/${orderId}?chat=1`}>
            Go to Active Boost
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BoostsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Parallel: active-order guard + available jobs
  const [activeOrder, orders] = await Promise.all([
    getActiveBoosterOrder(user.id),
    getAvailableBoosts(),
  ])

  if (activeOrder) {
    return <LockScreen orderId={activeOrder.id} />
  }

  const boosts: BoostDisplay[] = orders.map(orderToBoost)

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="font-mono text-sm font-semibold text-foreground">Boosts Panel</h1>
        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
          {boosts.length} order{boosts.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {boosts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {boosts.map(b => (
            <JobCard key={b.id} boost={b} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Inbox size={32} strokeWidth={1} className="text-muted-foreground/20" />
          <p className="font-mono text-xs text-muted-foreground">No boosts available right now.</p>
        </div>
      )}
    </div>
  )
}
