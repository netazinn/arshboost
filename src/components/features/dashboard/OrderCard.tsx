import Link from 'next/link'
import type { Order } from '@/types'
import { OrderStatusBadge } from './OrderStatusBadge'

interface OrderCardProps {
  order: Order
  href: string
  /** Show client info (for support/admin view) */
  showClient?: boolean
}

export function OrderCard({ order, href, showClient = false }: OrderCardProps) {
  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-md border border-[#2a2a2a] bg-[#111111] p-4 transition-all duration-150 hover:border-[#6e6d6f]"
    >
      {/* Top row */}
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
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <OrderStatusBadge status={order.status} />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showClient && order.client && (
            <span className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f]">
              {order.client.username ?? order.client.email}
            </span>
          )}
          <span className="font-mono text-[11px] tracking-[-0.1em] text-[#4a4a4a]">
            {date}
          </span>
        </div>
        <span className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">
          ${Number(order.price).toFixed(2)}
        </span>
      </div>
    </Link>
  )
}
