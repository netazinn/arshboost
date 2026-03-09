'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Shield, Headphones, Briefcase, MessageSquare, SendHorizonal, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendDmMessage, fetchDmMessages, fetchMessages } from '@/lib/actions/chat'
import { ChatPanel } from '@/components/features/dashboard/ChatPanel'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order, ChatMessage, Profile } from '@/types'

// ─── DM channel definitions ───────────────────────────────────────────────────

type ChannelId = 'admin' | 'support' | 'accountant'

interface ChannelDef {
  id: ChannelId
  label: string
  role: string
  Icon: React.ElementType
  iconColor: string
  dotColor: string
  activeBg: string
  borderAccent: string
  pillCls: string
}

const DM_CHANNELS: ChannelDef[] = [
  {
    id: 'admin', label: 'Admin', role: 'Platform Administrator',
    Icon: Shield, iconColor: 'text-purple-400', dotColor: 'bg-purple-500',
    activeBg: 'bg-purple-500/5', borderAccent: 'border-l-purple-500/50',
    pillCls: 'border-purple-500/20 text-purple-400/70',
  },
  {
    id: 'support', label: 'Support', role: 'Help & Support Team',
    Icon: Headphones, iconColor: 'text-blue-400', dotColor: 'bg-blue-500',
    activeBg: 'bg-blue-500/5', borderAccent: 'border-l-blue-500/50',
    pillCls: 'border-blue-500/20 text-blue-400/70',
  },
  {
    id: 'accountant', label: 'Accountant', role: 'Finance & Payments',
    Icon: Briefcase, iconColor: 'text-emerald-400', dotColor: 'bg-emerald-500',
    activeBg: 'bg-emerald-500/5', borderAccent: 'border-l-emerald-500/50',
    pillCls: 'border-emerald-500/20 text-emerald-400/70',
  },
]

// ─── Selection discriminated union ───────────────────────────────────────────

type Selection =
  | { kind: 'dm';    channelId: ChannelId }
  | { kind: 'order'; orderId: string }
  | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  in_progress:       'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  completed:         'border-green-500/40 text-green-400 bg-green-500/10',
  cancelled:         'border-red-500/40 text-red-400 bg-red-500/10',
  dispute:           'border-orange-500/40 text-orange-400 bg-orange-500/10',
  support:           'border-blue-500/40 text-blue-400 bg-blue-500/10',
  pending:           'border-gray-500/30 text-gray-400 bg-gray-500/10',
  awaiting_payment:  'border-gray-500/30 text-gray-400 bg-gray-500/10',
}
const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
  dispute: 'Disputed', support: 'Support', pending: 'Pending', awaiting_payment: 'Awaiting Payment',
}

function deriveOrderTitle(order: Order): string {
  const d = (order.details ?? {}) as Record<string, unknown>
  if (d.current_rank && d.target_rank) return `${d.current_rank} → ${d.target_rank}`
  return order.service?.label ?? 'Order'
}

// ─── OrderChatWrapper — lazy-loads messages then mounts ChatPanel ─────────────

function OrderChatWrapper({
  order,
  currentUser,
}: {
  order: Order
  currentUser: Pick<Profile, 'id' | 'role'>
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)

  useEffect(() => {
    setMessages(null)
    fetchMessages(order.id).then(setMessages)
  }, [order.id])

  if (messages === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={18} className="animate-spin text-[#4a4a4a]" />
      </div>
    )
  }

  return (
    <ChatPanel
      orderId={order.id}
      messages={messages}
      currentUser={currentUser}
    />
  )
}

// ─── DM chat pane — inline DM channel messaging ───────────────────────────────

function DmChatPane({
  userId,
  channelDef,
  lastMessages,
  onLastMessageUpdate,
}: {
  userId: string
  channelDef: ChannelDef
  lastMessages: Record<string, ChatMessage | null>
  onLastMessageUpdate: (channelId: ChannelId, msg: ChatMessage) => void
}) {
  const threadId                    = `${userId}:${channelDef.id}`
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const [input, setInput]           = useState('')
  const [isSending, setIsSending]   = useState(false)
  const bottomRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setLoading(true)
    fetchDmMessages(threadId).then((msgs) => {
      setMessages(msgs)
      setLoading(false)
    })
  }, [threadId])

  // Realtime for this DM thread
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`dm-pane:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `dm_thread_id=eq.${threadId}` },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            if (msg.sender_id === userId) {
              const optIdx = prev.findIndex((m) => m.id.startsWith('opt-') && m.content === msg.content)
              if (optIdx !== -1) return prev.map((m, i) => (i === optIdx ? msg : m))
            }
            return [...prev, msg]
          })
          onLastMessageUpdate(channelDef.id, msg)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, userId])

  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return
    const optId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optId, order_id: null, dm_thread_id: threadId,
      sender_id: userId, content: text, image_url: null,
      status: 'sending', created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setIsSending(true)
    const result = await sendDmMessage(threadId, text)
    if (result?.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optId))
      setInput(text)
    }
    setIsSending(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[#4a4a4a]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-xs tracking-[-0.05em] text-[#4a4a4a]">
              No messages yet. Send one to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === userId
            const isOpt = msg.id.startsWith('opt-')
            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && (
                  <span className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f]">
                    {channelDef.label}
                  </span>
                )}
                <div className={`max-w-[320px] rounded-md px-3 py-2 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                  isOwn ? 'bg-white text-black' : 'bg-[#2a2a2a] text-white'
                } ${isOpt ? 'opacity-60' : ''}`}>
                  {msg.content}
                </div>
                <span className="font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a]">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div className="shrink-0 border-t border-[#2a2a2a] p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`Message ${channelDef.label}…`}
            disabled={isSending}
            className="flex-1 resize-none rounded-md border border-[#2a2a2a] bg-[#111111] px-3 py-2 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] focus:border-[#6e6d6f] focus:outline-none disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-black transition-opacity disabled:opacity-30"
          >
            {isSending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} strokeWidth={1.5} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar order card ───────────────────────────────────────────────────────

function OrderSidebarCard({ order, isActive, onClick }: {
  order: Order; isActive: boolean; onClick: () => void
}) {
  const gameIcon = GAME_ICONS[order.game?.name ?? '']
  const title    = deriveOrderTitle(order)
  const shortId  = order.id.slice(0, 8).toUpperCase()
  const badgeCls = STATUS_BADGE[order.status] ?? STATUS_BADGE.in_progress
  const badgeLbl = STATUS_LABEL[order.status] ?? order.status

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left px-4 py-3.5 border-b border-[#111] transition-colors ${
        isActive ? 'bg-[#1f1f1f] border-l-2 border-l-white/30' : 'hover:bg-[#161616]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={`font-mono text-[11px] font-semibold tracking-[-0.06em] truncate ${isActive ? 'text-white' : 'text-[#c8c8c8]'}`}>
          {title}
        </p>
        <span className="shrink-0 font-mono text-[9px] tracking-[-0.03em] text-[#3a3a3a]">
          {relativeTime(order.updated_at)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        {gameIcon && (
          <Image src={gameIcon} alt={order.game?.name ?? ''} width={12} height={12}
            className="h-[12px] w-[12px] rounded-sm object-cover opacity-50 shrink-0" />
        )}
        <span className="font-mono text-[10px] tracking-[-0.05em] text-[#5a5a5a] truncate">
          {order.game?.name ?? ''} · #{shortId}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded px-1.5 py-px font-mono text-[9px] tracking-[-0.02em] border ${badgeCls}`}>
          {badgeLbl}
        </span>
        {/* Show client username for booster view */}
        {(order as Order & { client?: { username?: string | null } }).client?.username && (
          <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] truncate">
            {(order as Order & { client?: { username?: string | null } }).client?.username}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface ChatInboxLayoutProps {
  userId: string
  role: 'client' | 'booster'
  orders: Order[]
  /** Pre-fetched last DM messages (booster only) */
  lastDmMessages?: Record<string, ChatMessage | null>
  currentUser: Pick<Profile, 'id' | 'role'>
}

export function ChatInboxLayout({
  userId,
  role,
  orders,
  lastDmMessages: initialLastDmMessages = {},
  currentUser,
}: ChatInboxLayoutProps) {
  const [selection,     setSelection]     = useState<Selection>(null)
  const [lastDmMsgs,    setLastDmMsgs]    = useState(initialLastDmMessages)

  const handleDmUpdate = useCallback((channelId: ChannelId, msg: ChatMessage) => {
    setLastDmMsgs((prev) => ({ ...prev, [channelId]: msg }))
  }, [])

  const activeChannel = selection?.kind === 'dm'
    ? DM_CHANNELS.find((c) => c.id === selection.channelId)
    : null
  const activeOrder = selection?.kind === 'order'
    ? orders.find((o) => o.id === selection.orderId) ?? null
    : null

  const sidebarTitle    = role === 'booster' ? 'Chat Inbox' : 'Orders Chat'
  const sidebarSubtitle = role === 'booster' ? 'Staff channels & order chats' : 'All your order conversations'

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-md border border-[#2a2a2a]">

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-[#1a1a1a] bg-[#111111] overflow-hidden">

        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-[#1a1a1a]">
          <h2 className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{sidebarTitle}</h2>
          <p className="mt-0.5 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">{sidebarSubtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Booster: Pinned staff DM channels */}
          {role === 'booster' && (
            <>
              <div className="px-4 pt-3 pb-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#3a3a3a]">Staff Channels</span>
              </div>
              {DM_CHANNELS.map((ch) => {
                const isActive = selection?.kind === 'dm' && selection.channelId === ch.id
                const last     = lastDmMsgs[ch.id]
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelection({ kind: 'dm', channelId: ch.id })}
                    className={`relative w-full flex items-start gap-3 px-4 py-3 border-b border-[#0f0f0f] text-left transition-colors ${
                      isActive ? `${ch.activeBg} border-l-[3px] ${ch.borderAccent}` : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                      <ch.Icon size={14} strokeWidth={1.5} className={ch.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-mono text-[11px] font-semibold tracking-[-0.05em] ${isActive ? 'text-white' : 'text-[#c8c8c8]'}`}>
                          {ch.label}
                        </span>
                        {last && (
                          <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] shrink-0">
                            {relativeTime(last.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] truncate mt-0.5">
                        {last
                          ? last.sender_id === userId ? `You: ${last.content}` : last.content
                          : `Message ${ch.label}…`
                        }
                      </p>
                    </div>
                  </button>
                )
              })}
              <div className="px-4 pt-3 pb-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#3a3a3a]">
                  Order Chats
                  <span className="ml-1.5 text-[#2a2a2a]">({orders.length})</span>
                </span>
              </div>
            </>
          )}

          {/* Orders list */}
          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <MessageSquare size={18} strokeWidth={1.3} className="text-[#2a2a2a]" />
              <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">No order chats yet</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderSidebarCard
                key={order.id}
                order={order}
                isActive={selection?.kind === 'order' && selection.orderId === order.id}
                onClick={() => setSelection({ kind: 'order', orderId: order.id })}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#0f0f0f]">

        {/* Nothing selected */}
        {!selection && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111]">
                <MessageSquare size={20} strokeWidth={1.5} className="text-[#3a3a3a]" />
              </div>
              <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">
                {role === 'booster' ? 'Select a channel or order' : 'Select an order'}
              </p>
              <p className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a] max-w-[200px] leading-relaxed">
                {role === 'booster'
                  ? 'Open a staff channel or click any order chat from the sidebar.'
                  : 'Click an order from the sidebar to open its chat.'
                }
              </p>
            </div>
          </div>
        )}

        {/* DM channel selected */}
        {selection?.kind === 'dm' && activeChannel && (
          <>
            {/* DM Header */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#1a1a1a] px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111]">
                <activeChannel.Icon size={14} strokeWidth={1.5} className={activeChannel.iconColor} />
              </div>
              <div>
                <p className="font-mono text-[12px] font-semibold tracking-[-0.06em] text-white">{activeChannel.label}</p>
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">{activeChannel.role}</p>
              </div>
              <div className={`ml-auto flex items-center gap-1.5 rounded border px-2 py-0.5 ${activeChannel.pillCls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeChannel.dotColor} opacity-80`} />
                <span className="font-mono text-[9px] tracking-[-0.03em]">secure channel</span>
              </div>
            </div>
            <DmChatPane
              userId={userId}
              channelDef={activeChannel}
              lastMessages={lastDmMsgs}
              onLastMessageUpdate={handleDmUpdate}
            />
          </>
        )}

        {/* Order chat selected */}
        {selection?.kind === 'order' && activeOrder && (
          <>
            {/* Order Header */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#1a1a1a] px-5 py-3.5">
              {(() => {
                const gameIcon = GAME_ICONS[activeOrder.game?.name ?? '']
                const title    = deriveOrderTitle(activeOrder)
                const badgeCls = STATUS_BADGE[activeOrder.status] ?? STATUS_BADGE.in_progress
                const badgeLbl = STATUS_LABEL[activeOrder.status] ?? activeOrder.status
                return (
                  <>
                    {gameIcon
                      ? <Image src={gameIcon} alt={activeOrder.game?.name ?? ''} width={32} height={32}
                          className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2a2a2a]">
                          <span className="font-sans text-xs font-bold text-white">
                            {(activeOrder.game?.name ?? '?').charAt(0)}
                          </span>
                        </div>
                    }
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white truncate">{title}</p>
                      <p className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] truncate">
                        {activeOrder.game?.name} · #{activeOrder.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                      <span className={`shrink-0 inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${badgeCls}`}>
                        {badgeLbl}
                      </span>
                      <Link
                        href={role === 'booster'
                          ? `/dashboard/boosts/${activeOrder.id}`
                          : `/dashboard/orders/${activeOrder.id}`}
                        className="text-sm font-medium text-gray-400 hover:text-white transition-colors whitespace-nowrap"
                      >
                        Order Details →
                      </Link>
                    </div>
                  </>
                )
              })()}
            </div>
            {/* Rekey ChatPanel when order changes so Realtime re-subscribes */}
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <OrderChatWrapper key={activeOrder.id} order={activeOrder} currentUser={currentUser} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
