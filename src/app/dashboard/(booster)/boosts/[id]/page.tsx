import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrderById, getOrderMessages } from '@/lib/data/orders'
import { OrderDetailView } from '@/components/features/dashboard/OrderDetailView'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chat?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params
  return { title: `Boost – ArshBoost`, robots: { index: false } }
}

export default async function JobDetailPage({ params, searchParams }: Props) {
  const { id }   = await params
  const { chat } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [order, messages] = await Promise.all([
    getOrderById(id),
    getOrderMessages(id),
  ])

  if (!order) notFound()

  return (
    <OrderDetailView
      order={order}
      messages={messages}
      userId={user?.id}
      defaultChat={chat === '1'}
      isBooster={true}
    />
  )
}
