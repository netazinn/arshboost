import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrderById, getOrderMessages } from '@/lib/data/orders'
import { getProfile } from '@/lib/data/profiles'
import { OrderStatusBadge } from '@/components/features/dashboard/OrderStatusBadge'
import { OrderActions } from '@/components/features/dashboard/OrderActions'
import { ChatPanel } from '@/components/features/dashboard/ChatPanel'

interface SupportOrderDetailProps {
  params: Promise<{ id: string }>
}

export default async function SupportOrderDetailPage({ params }: SupportOrderDetailProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const [order, messages, profile] = await Promise.all([
    getOrderById(id),
    getOrderMessages(id),
    getProfile(user.id),
  ])

  if (!order || !profile) notFound()

  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#2a2a2a] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/support"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tracking-[-0.07em] text-white">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="font-mono text-[11px] tracking-[-0.1em] text-[#4a4a4a]">
                {order.game?.name} · {order.service?.label} · {date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xl font-semibold tracking-[-0.07em] text-white">
              ${Number(order.price).toFixed(2)}
            </span>
            <OrderActions orderId={order.id} status={order.status} role={profile.role} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left – details */}
        <div className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[#2a2a2a] p-5 md:flex">
          <Section title="Client">
            <Row label="Email" value={order.client?.email ?? '–'} />
            {order.client?.username && (
              <Row label="Username" value={order.client.username} />
            )}
          </Section>

          {order.booster ? (
            <Section title="Booster">
              <Row label="Email" value={order.booster.email} />
              {order.booster.username && (
                <Row label="Username" value={order.booster.username} />
              )}
            </Section>
          ) : (
            <Section title="Booster">
              <Row label="Assigned" value="None" />
            </Section>
          )}

          <Section title="Order Details">
            <Row label="Game" value={order.game?.name ?? '–'} />
            <Row label="Service" value={order.service?.label ?? '–'} />
            <Row label="Price" value={`$${Number(order.price).toFixed(2)}`} />
            <Row label="Date" value={date} />
          </Section>

          {order.details && Object.keys(order.details).length > 0 && (
            <Section title="Boost Options">
              {Object.entries(order.details).map(([k, v]) => (
                <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
            </Section>
          )}
        </div>

        {/* Right – full chat history */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[#2a2a2a] px-4 py-3">
            <h2 className="font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
              Chat History ({messages.length} messages)
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              orderId={order.id}
              messages={messages}
              currentUser={{ id: user.id, role: profile.role }}
              allowImages
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#4a4a4a]">
        {title}
      </p>
      <div className="flex flex-col gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] p-3">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[11px] capitalize tracking-[-0.05em] text-[#6e6d6f]">
        {label}
      </span>
      <span className="truncate font-mono text-[11px] tracking-[-0.05em] text-white">
        {value}
      </span>
    </div>
  )
}
