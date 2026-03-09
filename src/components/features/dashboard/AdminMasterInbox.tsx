'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Shield, Headphones, Search, SendHorizonal, Loader2,
  AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendAdminMessage, resolveDispute } from '@/lib/actions/admin'
import { SystemMessageDivider, SYS_COLOR_MAP } from '@/components/features/dashboard/ChatPanel'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order, ChatMessage, Profile, OrderStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  orders: Order[]
  initialOrder: Order | null
  initialMessages: ChatMessage[]
  currentUser: Pick<Profile, 'id' | 'role'>
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  pending:          'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]',
  awaiting_payment: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  in_progress:      'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  completed:        'border-green-500/30 bg-green-500/10 text-green-400',
  cancelled:        'border-red-500/30 bg-red-500/10 text-red-400',
  dispute:          'border-orange-500/30 bg-orange-500/10 text-orange-400',
  support:          'border-blue-500/30 bg-blue-500/10 text-blue-400',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', awaiting_payment: 'Awaiting Payment',
  in_progress: 'In Progress', completed: 'Completed',
  cancelled: 'Cancelled', dispute: 'Dispute', support: 'Support',
}

const FILTERS: { label: string; statuses: OrderStatus[] | 'all' }[] = [
  { label: 'All',       statuses: 'all' },
  { label: 'Active',    statuses: ['in_progress'] },
  { label: 'Disputed',  statuses: ['dispute', 'support'] },
  { label: 'Waiting',   statuses: ['pending', 'awaiting_payment'] },
  { label: 'Done',      statuses: ['completed', 'cancelled'] },
]

// ─── Order title helper ───────────────────────────────────────────────────────

function orderTitle(order: Order) {
  const d = (order.details ?? {}) as Record<string, string>
  return d.current_rank && d.target_rank
    ? `${d.current_rank} → ${d.target_rank}`
    : order.service?.label ?? 'Order'
}

// ─── Admin message label ─────────────────────────────────────────────────────

function getAdminLabel(role: string) {
  if (role === 'admin')   return '[SYSTEM ADMINISTRATOR]'
  if (role === 'support') return '[SUPPORT]'
  return '[STAFF]'
}

// ─── Dispute Resolution Module ────────────────────────────────────────────────

function DisputeResolution({ order, onResolved }: { order: Order; onResolved: () => void }) {
  const [pct, setPct]         = useState(50)
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const price = order.price

  function clientAmt()  { return ((pct / 100) * price).toFixed(2) }
  function boosterAmt() { return (((100 - pct) / 100) * price).toFixed(2) }

  async function execute() {
    setLoading(true)
    const { error } = await resolveDispute({ orderId: order.id, clientPct: pct, notes })
    setLoading(false)
    if (!error) { setDone(true); onResolved() }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
        <CheckCircle2 size={18} strokeWidth={1.5} className="text-green-400 mx-auto mb-1" />
        <p className="font-mono text-xs tracking-[-0.05em] text-green-400">Resolution executed</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} strokeWidth={1.5} className="text-orange-400 shrink-0" />
        <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-orange-400">
          Dispute Resolution Module
        </p>
      </div>

      {/* Quick buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setPct(100)}
          className="flex-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 font-mono text-[10px] tracking-[-0.04em] text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          Full Refund (Client)
        </button>
        <button
          onClick={() => setPct(0)}
          className="flex-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-1.5 font-mono text-[10px] tracking-[-0.04em] text-green-400 hover:bg-green-500/20 transition-colors"
        >
          Pay in Full (Booster)
        </button>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-mono text-[9px] text-[#6e6d6f] tracking-[-0.03em]">
          <span>Booster gets ${boosterAmt()}</span>
          <span>Client gets ${clientAmt()}</span>
        </div>
        <input
          type="range" min={0} max={100} value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full accent-orange-400 cursor-pointer"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1">
            <span className="font-mono text-[10px] text-[#4a4a4a]">Client $</span>
            <input
              type="number" min={0} max={price} step={0.01}
              value={clientAmt()}
              onChange={(e) => {
                const v = Math.min(price, Math.max(0, parseFloat(e.target.value) || 0))
                setPct(Math.round((v / price) * 100))
              }}
              className="flex-1 bg-transparent font-mono text-[10px] text-white outline-none w-16"
            />
          </div>
          <span className="font-mono text-[10px] text-[#4a4a4a]">{pct}%</span>
        </div>
      </div>

      {/* Notes */}
      <textarea
        placeholder="Resolution notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none resize-none focus:border-[#4a4a4a] transition-colors"
      />

      <button
        onClick={execute}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded border border-orange-500/40 bg-orange-500/10 px-3 py-2 font-mono text-[11px] font-semibold tracking-[-0.05em] text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <AlertTriangle size={12} strokeWidth={2} />}
        Execute Resolution
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminMasterInbox({ orders: initialOrders, initialOrder, initialMessages, currentUser }: Props) {
  const router = useRouter()
  const [orders, setOrders]           = useState<Order[]>(initialOrders)
  const [activeOrder, setActiveOrder] = useState<Order | null>(initialOrder)
  const [messages, setMessages]       = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [filterIdx, setFilterIdx]     = useState(0)
  const [search, setSearch]           = useState('')
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase  = createClient()

  // ── Scroll to bottom ──
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Live order list updates ──
  useEffect(() => {
    const ch = supabase
      .channel('admin:inbox:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        const { data } = await supabase
          .from('orders')
          .select(`*, game:games(id,name,slug,logo_url), service:games_services(id,type,label), client:profiles!orders_client_id_fkey(id,email,username,avatar_url,role), booster:profiles!orders_booster_id_fkey(id,email,username,avatar_url,role)`)
          .order('created_at', { ascending: false })
        if (data) setOrders(data as Order[])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Active chat messages + Realtime ──
  useEffect(() => {
    if (!activeOrder) return

    const ch = supabase
      .channel(`admin:chat:${activeOrder.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${activeOrder.id}` },
        async (payload) => {
          const raw = payload.new as ChatMessage
          // Fetch sender profile to get role
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, email, role, avatar_url, created_at, updated_at')
            .eq('id', raw.sender_id)
            .single()
          setMessages((prev) => {
            if (prev.some((m) => m.id === raw.id)) return prev
            return [...prev, { ...raw, sender: sender ?? undefined }]
          })
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id])

  const loadOrder = useCallback(async (order: Order) => {
    setActiveOrder(order)
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(id, username, email, role, avatar_url)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) ?? [])
    setLoadingMsgs(false)
    router.replace(`/dashboard/master-inbox?order=${order.id}`, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || !activeOrder || sending) return
    setSending(true)
    setInput('')
    const optimisticId = `opt-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        order_id: activeOrder.id,
        sender_id: currentUser.id,
        content: text,
        image_url: null,
        is_system: false,
        created_at: new Date().toISOString(),
        status: 'sending',
        sender: { id: currentUser.id, role: currentUser.role } as Profile,
      },
    ])
    const { error } = await sendAdminMessage(activeOrder.id, text)
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    }
    setSending(false)
  }

  // ── Filtered order list ──
  const activeFilter = FILTERS[filterIdx]
  const filtered = orders.filter((o) => {
    const statusOk = activeFilter.statuses === 'all'
      || (activeFilter.statuses as OrderStatus[]).includes(o.status)
    const searchOk = !search
      || o.client?.username?.toLowerCase().includes(search.toLowerCase())
      || o.client?.email?.toLowerCase().includes(search.toLowerCase())
      || o.id.toLowerCase().includes(search.toLowerCase())
      || orderTitle(o).toLowerCase().includes(search.toLowerCase())
    return statusOk && searchOk
  })

  const isAdminRole = (role?: string) => ['admin', 'support', 'accountant'].includes(role ?? '')

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">

      {/* ── Order sidebar ──────────────────────────────────────── */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-[#151515]">
        {/* Header + search */}
        <div className="shrink-0 border-b border-[#151515] px-4 py-3.5">
          <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white mb-2">
            All Orders <span className="text-[#4a4a4a]">({orders.length})</span>
          </p>
          <div className="flex items-center gap-2 rounded-md border border-[#1e1e1e] bg-[#0f0f0f] px-2.5 py-1.5">
            <Search size={11} strokeWidth={1.5} className="text-[#4a4a4a] shrink-0" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="flex-1 bg-transparent font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="shrink-0 flex gap-1 border-b border-[#151515] px-3 py-2 overflow-x-auto">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilterIdx(i)}
              className={`shrink-0 rounded px-2 py-0.5 font-mono text-[9px] tracking-[-0.03em] transition-colors ${
                filterIdx === i
                  ? 'bg-white/10 text-white'
                  : 'text-[#4a4a4a] hover:text-[#9a9a9a]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((order) => {
            const gameIcon = GAME_ICONS[order.game?.name ?? '']
            const title    = orderTitle(order)
            const isActive = activeOrder?.id === order.id
            return (
              <button
                key={order.id}
                onClick={() => loadOrder(order)}
                className={`w-full text-left px-4 py-3 border-b border-[#0f0f0f] transition-colors ${
                  isActive ? 'bg-[#1a1a1a] border-l-2 border-l-white/20' : 'hover:bg-[#111]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {gameIcon && (
                    <Image src={gameIcon} alt="" width={14} height={14}
                      className="h-3.5 w-3.5 rounded-sm shrink-0 object-cover" />
                  )}
                  <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-white truncate flex-1">
                    {title}
                  </p>
                  <span className={`shrink-0 inline-flex items-center rounded border px-1 py-px font-mono text-[7px] tracking-[-0.02em] ${STATUS_CLS[order.status] ?? STATUS_CLS.pending}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="font-mono text-[9px] tracking-[-0.04em] text-[#4a4a4a] truncate">
                  {order.client?.username ?? order.client?.email ?? '—'} · #{order.id.slice(0, 8).toUpperCase()}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chat panel ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">

        {!activeOrder ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                <Shield size={20} strokeWidth={1.5} className="text-red-400" />
              </div>
              <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Select an order</p>
              <p className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a] max-w-[200px] leading-relaxed">
                Click any order from the sidebar to open god-mode chat access.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#1a1a1a] px-5 py-3.5">
              {(() => {
                const gameIcon = GAME_ICONS[activeOrder.game?.name ?? '']
                const title    = orderTitle(activeOrder)
                const badgeCls = STATUS_CLS[activeOrder.status] ?? STATUS_CLS.pending
                const badgeLbl = STATUS_LABEL[activeOrder.status] ?? activeOrder.status
                return (
                  <>
                    {gameIcon
                      ? <Image src={gameIcon} alt="" width={32} height={32}
                          className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      : <div className="h-8 w-8 shrink-0 rounded-md bg-[#2a2a2a]" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white truncate">{title}</p>
                      <p className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] truncate">
                        {activeOrder.game?.name} · #{activeOrder.id.slice(0, 8).toUpperCase()}
                        {' · '}Client: {activeOrder.client?.username ?? activeOrder.client?.email ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${badgeCls}`}>
                        {badgeLbl}
                      </span>
                      {/* God-mode badge */}
                      <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] text-red-400">
                        <Shield size={8} strokeWidth={2} />
                        GOD MODE
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Messages */}
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {loadingMsgs ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 size={20} strokeWidth={1.5} className="text-[#3a3a3a] animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="font-mono text-[11px] text-[#3a3a3a] tracking-[-0.04em]">No messages yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((msg) => {
                        if (msg.is_system) {
                          const colorCls = (msg.system_type && SYS_COLOR_MAP[msg.system_type]) ?? undefined
                          return <SystemMessageDivider key={msg.id} text={msg.content} colorCls={colorCls} />
                        }

                        const senderRole  = msg.sender?.role ?? ''
                        const isAdminMsg  = isAdminRole(senderRole)
                        const isOwn       = msg.sender_id === currentUser.id
                        const senderName  = msg.sender?.username ?? msg.sender?.email ?? 'Unknown'
                        const adminLabel  = isAdminMsg ? getAdminLabel(senderRole) : null

                        return (
                          <div key={msg.id} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                            {/* Sender label */}
                            <div className="flex items-center gap-2">
                              {!isOwn && (
                                <span className={`font-mono text-[10px] tracking-[-0.05em] ${isAdminMsg ? 'text-yellow-400 font-semibold' : 'text-[#6e6d6f]'}`}>
                                  {adminLabel ? `${adminLabel} ${senderName}` : senderName}
                                </span>
                              )}
                              {isOwn && adminLabel && (
                                <span className="font-mono text-[10px] tracking-[-0.05em] text-yellow-400 font-semibold">
                                  {adminLabel} You
                                </span>
                              )}
                              <span className="font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a]">
                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {/* Bubble */}
                            <div className={`relative max-w-[70%] rounded-md px-3.5 py-2.5 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                              isAdminMsg
                                ? isOwn
                                  ? 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.15)] rounded-br-none'
                                  : 'bg-yellow-500/5 border border-yellow-500/30 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)] rounded-bl-none'
                                : isOwn
                                  ? 'bg-white text-black rounded-br-none'
                                  : 'bg-[#1e1e1e] text-[#e8e8e8] rounded-bl-none'
                            }`}>
                              {isAdminMsg && (
                                <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  {senderRole === 'admin'
                                    ? <Shield size={9} strokeWidth={2} className="text-yellow-400" />
                                    : <Headphones size={9} strokeWidth={2} className="text-yellow-400" />
                                  }
                                  <span className="font-mono text-[8px] tracking-[0.02em] text-yellow-400 font-semibold uppercase">
                                    {senderRole}
                                  </span>
                                </div>
                              )}
                              {msg.content}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-[#1a1a1a] px-4 py-3">
                  <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-2.5 focus-within:border-yellow-500/40 transition-colors">
                    <Shield size={13} strokeWidth={1.5} className="text-yellow-400/60 shrink-0" />
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={`Message as ${currentUser.role === 'admin' ? '[SYSTEM ADMINISTRATOR]' : currentUser.role === 'support' ? '[SUPPORT]' : '[STAFF]'}...`}
                      className="flex-1 bg-transparent font-mono text-xs tracking-[-0.04em] text-white placeholder-[#4a4a4a] outline-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-30 transition-colors"
                    >
                      {sending
                        ? <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                        : <SendHorizonal size={12} strokeWidth={2} />
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Dispute Resolution sidebar (dispute/support orders only) */}
              {(activeOrder.status === 'dispute' || activeOrder.status === 'support') && (
                <div className="w-[260px] shrink-0 border-l border-[#1a1a1a] overflow-y-auto p-4 flex flex-col gap-4">
                  <DisputeResolution
                    order={activeOrder}
                    onResolved={() => setActiveOrder((o) => o ? { ...o, status: 'completed' } : o)}
                  />
                  {/* Order summary snippet */}
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#111] p-3 flex flex-col gap-2">
                    <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-[#c8c8c8] mb-1">Order Info</p>
                    {[
                      ['Client',  activeOrder.client?.username ?? activeOrder.client?.email ?? '—'],
                      ['Booster', activeOrder.booster?.username ?? activeOrder.booster?.email ?? 'Unassigned'],
                      ['Price',   `$${activeOrder.price.toFixed(2)}`],
                      ['Game',    activeOrder.game?.name ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">{k}</span>
                        <span className="font-mono text-[9px] text-[#c8c8c8] tracking-[-0.03em] truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
