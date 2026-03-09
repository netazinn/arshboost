import type { Metadata } from 'next'
import { ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientOrders } from '@/lib/data/orders'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { ClientOrdersView } from '@/components/features/dashboard/ClientOrdersView'
import { Footer } from '@/components/shared/Footer'
import type { Order } from '@/types'

export const metadata: Metadata = {
  title: 'My Orders – ArshBoost',
  robots: { index: false },
}

type PaymentStatus = 'Unpaid' | 'Processing' | 'Paid' | 'Refunded' | 'Partially Refunded'
type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Need Action'

function mapOrder(o: Order) {
  const statusToPayment: Record<string, PaymentStatus> = {
    pending: 'Unpaid', awaiting_payment: 'Unpaid',
    in_progress: 'Paid', completed: 'Paid',
    cancelled: 'Refunded', dispute: 'Paid',
  }
  const statusToCompletion: Record<string, CompletionStatus> = {
    pending: 'Waiting', awaiting_payment: 'Waiting',
    in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Canceled', dispute: 'Disputed',
  }
  const d = (o.details ?? {}) as Record<string, unknown>
  const title =
    d.current_rank && d.target_rank
      ? `${d.current_rank} → ${d.target_rank}`
      : o.service?.label ?? 'Boost'
  return {
    id: o.id,
    game: o.game?.name ?? 'Unknown',
    type: 'Boost' as const,
    orderTitle: title,
    paymentStatus: (statusToPayment[o.status] ?? 'Paid') as PaymentStatus,
    completionStatus: (statusToCompletion[o.status] ?? 'In Progress') as CompletionStatus,
    price: Number(o.price),
    createdAt: o.created_at,
  }
}

export default async function ClientOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawOrders = user ? await getClientOrders(user.id) : []
  const orders = rawOrders.map(mapOrder)

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={ShoppingCart}
          title="My Orders"
          subtitle="List of all your products and services."
        />
        <ClientOrdersView orders={orders} />
      </main>
      <Footer />
    </>
  )
}
