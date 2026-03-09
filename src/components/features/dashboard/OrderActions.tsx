'use client'

import { useTransition, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cancelOrder, declareDispute, completeOrder } from '@/lib/actions/orders'
import type { OrderStatus } from '@/types'

interface OrderActionsProps {
  orderId: string
  status: OrderStatus
  role: 'client' | 'booster' | 'support' | 'admin' | 'accountant'
}

export function OrderActions({ orderId, status, role }: OrderActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: (id: string) => Promise<{ error?: string; success?: boolean }>) {
    setError(null)
    startTransition(async () => {
      const res = await action(orderId)
      if (res?.error) setError(res.error)
    })
  }

  if (status === 'completed' || status === 'cancelled') return null

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="font-mono text-[10px] tracking-[-0.05em] text-red-400">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Client: can cancel pending/awaiting_payment orders, declare dispute on in_progress */}
        {role === 'client' && (status === 'pending' || status === 'awaiting_payment') && (
          <button
            disabled={isPending}
            onClick={() => run(cancelOrder)}
            className="flex h-9 items-center gap-2 rounded-md border border-red-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-red-400 transition-all hover:border-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Cancel Order
          </button>
        )}
        {role === 'client' && status === 'in_progress' && (
          <>
            <button
              disabled={isPending}
              onClick={() => run(completeOrder)}
              className="flex h-9 items-center gap-2 rounded-md border border-green-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-green-400 transition-all hover:border-green-400 hover:bg-green-500/10 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Mark Complete
            </button>
            <button
              disabled={isPending}
              onClick={() => run(declareDispute)}
              className="flex h-9 items-center gap-2 rounded-md border border-orange-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-orange-400 transition-all hover:border-orange-400 hover:bg-orange-500/10 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Open Dispute
            </button>
          </>
        )}

        {/* Booster: can mark complete on in_progress */}
        {role === 'booster' && status === 'in_progress' && (
          <button
            disabled={isPending}
            onClick={() => run(completeOrder)}
            className="flex h-9 items-center gap-2 rounded-md border border-green-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-green-400 transition-all hover:border-green-400 hover:bg-green-500/10 disabled:opacity-40"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Mark Complete
          </button>
        )}

        {/* Support/Admin: can cancel or complete any active order */}
        {(role === 'support' || role === 'admin') && (
          <>
            <button
              disabled={isPending}
              onClick={() => run(completeOrder)}
              className="flex h-9 items-center gap-2 rounded-md border border-green-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-green-400 transition-all hover:border-green-400 hover:bg-green-500/10 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Complete
            </button>
            <button
              disabled={isPending}
              onClick={() => run(cancelOrder)}
              className="flex h-9 items-center gap-2 rounded-md border border-red-500/30 px-4 font-mono text-xs tracking-[-0.1em] text-red-400 transition-all hover:border-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
