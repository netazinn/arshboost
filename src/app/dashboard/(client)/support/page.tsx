import type { Metadata } from 'next'
import { getAllOrders } from '@/lib/data/orders'
import { OrderCard } from '@/components/features/dashboard/OrderCard'
import { OrderStatusBadge } from '@/components/features/dashboard/OrderStatusBadge'
import type { OrderStatus } from '@/types'

export const metadata: Metadata = {
  title: 'All Orders – ArshBoost',
  robots: { index: false },
}

const STATUS_FILTERS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Dispute', value: 'dispute' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

interface SupportPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const { status } = await searchParams
  const allOrders = await getAllOrders()

  const activeFilter = (status ?? 'all') as OrderStatus | 'all'
  const filtered =
    activeFilter === 'all'
      ? allOrders
      : allOrders.filter((o) => o.status === activeFilter)

  const counts: Partial<Record<OrderStatus | 'all', number>> = { all: allOrders.length }
  for (const o of allOrders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-[-0.07em] text-white">
          All Orders
        </h1>
        <p className="mt-0.5 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
          Full order history across all clients.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const isActive = activeFilter === f.value
          const count = counts[f.value] ?? 0
          return (
            <a
              key={f.value}
              href={f.value === 'all' ? '/dashboard/support' : `/dashboard/support?status=${f.value}`}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 font-mono text-xs tracking-[-0.1em] transition-all ${
                isActive
                  ? 'border-white bg-white/10 text-white'
                  : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'
              }`}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={`rounded px-1 font-mono text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#2a2a2a] text-[#4a4a4a]'
                  }`}
                >
                  {count}
                </span>
              )}
            </a>
          )
        })}
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[#2a2a2a] py-20 text-center">
          <p className="font-mono text-sm tracking-[-0.1em] text-[#6e6d6f]">
            No orders match this filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              href={`/dashboard/support/${order.id}`}
              showClient
            />
          ))}
        </div>
      )}
    </div>
  )
}
