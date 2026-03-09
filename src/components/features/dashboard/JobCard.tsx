'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { claimJob } from '@/lib/actions/orders'
import type { Order } from '@/types'

interface JobCardProps {
  order: Order
  /** If true, show the Claim button */
  showClaim?: boolean
}

export function JobCard({ order, showClaim = false }: JobCardProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  function handleClaim() {
    startTransition(async () => {
      const result = await claimJob(order.id)
      if (!result?.error) {
        router.push(`/dashboard/boosts/${order.id}`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[#2a2a2a] bg-[#111111] p-4 transition-colors hover:border-[#3a3a3a]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {order.game && (
              <span className="font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
                {order.game.name}
              </span>
            )}
            {order.service && (
              <>
                <span className="text-[#3a3a3a]">/</span>
                <span className="font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
                  {order.service.label}
                </span>
              </>
            )}
          </div>
          <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">
            #{order.id.slice(0, 8).toUpperCase()} · {date}
          </span>
        </div>
        <span className="font-mono text-sm font-semibold tracking-[-0.07em] text-green-400">
          ${Number(order.price).toFixed(2)}
        </span>
      </div>

      {/* Details preview */}
      {order.details && Object.keys(order.details).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(order.details)
            .slice(0, 4)
            .map(([key, val]) => (
              <span
                key={key}
                className="rounded bg-[#2a2a2a] px-2 py-0.5 font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f]"
              >
                {key}: {String(val)}
              </span>
            ))}
        </div>
      )}

      {/* Claim */}
      {showClaim && (
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.1em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : null}
          {isPending ? 'Claiming…' : 'Claim Job'}
        </button>
      )}
    </div>
  )
}
