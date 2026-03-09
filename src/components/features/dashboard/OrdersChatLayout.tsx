'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  MessageSquare, AlertTriangle, HelpCircle, XCircle,
  MoreVertical, Send, Shield, ImagePlus, CheckCircle2, X,
} from 'lucide-react'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order } from '@/types'

// ─── Display types ────────────────────────────────────────────────────────────

type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Need Action'

const COMPLETION_BADGE: Record<CompletionStatus, string> = {
  'Waiting':     'border border-white/20 text-[#6e6d6f] bg-white/5',
  'In Progress': 'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Completed':   'border border-green-500/40 text-green-400 bg-green-500/10',
  'Canceled':    'border border-red-500/40 text-red-400 bg-red-500/10',
  'Disputed':    'border border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Need Action': 'border border-purple-500/40 text-purple-400 bg-purple-500/10',
}

function deriveDisplay(order: Order) {
  const d = (order.details ?? {}) as Record<string, unknown>

  const statusToCompletion: Record<string, CompletionStatus> = {
    pending: 'Waiting', awaiting_payment: 'Waiting',
    in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Canceled', dispute: 'Disputed',
  }

  const title =
    d.current_rank && d.target_rank
      ? `${d.current_rank} → ${d.target_rank}`
      : order.service?.label ?? 'Boost'

  return {
    shortId:          order.id.slice(0, 8).toUpperCase(),
    gameName:         order.game?.name   ?? 'Unknown',
    serviceLabel:     order.service?.label ?? 'Boost',
    orderTitle:       title,
    completionStatus: (statusToCompletion[order.status] ?? 'In Progress') as CompletionStatus,
    price:            Number(order.price),
    createdDate:      new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
  }
}

// ─── Chat message types & mocks ───────────────────────────────────────────────

interface ChatMessage {
  id: string
  sender: 'client' | 'booster' | 'system'
  text?: string
  imageUrl?: string
  time: string
  systemColor?: 'orange' | 'blue' | 'red' | 'green'
}

const MOCK_MESSAGES: ChatMessage[] = [
  { id: '1', sender: 'system',  text: 'Order started. Booster has been assigned.',               time: '10:01 AM' },
  { id: '2', sender: 'booster', text: 'Hey! I will start your boost shortly, I just need to log in.', time: '10:03 AM' },
  { id: '3', sender: 'client',  text: 'Great, thanks! Let me know if you need anything.',         time: '10:05 AM' },
  { id: '4', sender: 'booster', text: 'Currently in game, making great progress!',                time: '10:45 AM' },
]

// ─── Image compression ────────────────────────────────────────────────────────

const MAX_FILE_SIZE    = 5 * 1024 * 1024
const ALLOWED_TYPES    = ['image/jpeg', 'image/png', 'image/webp']
const COMPRESS_MAX_DIM = 1200
const COMPRESS_QUALITY = 0.82

async function compressImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
          const ratio = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height)
          width  = Math.round(width  * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', COMPRESS_QUALITY))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

type ConfirmAction = 'mark_completed' | 'open_dispute' | 'need_support' | 'cancel_request' | null

function ConfirmModal({ title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  title: string; description: string; confirmLabel?: string
  danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[400px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-500/10' : 'bg-white/5'}`}>
            {danger
              ? <AlertTriangle size={15} strokeWidth={1.5} className="text-red-400" />
              : <Shield        size={15} strokeWidth={1.5} className="text-[#a0a0a0]" />
            }
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{title}</p>
            <p className="mt-1 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#6e6d6f]">{description}</p>
          </div>
          <button onClick={onCancel} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:text-white">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={onCancel} className="flex h-[40px] flex-1 items-center justify-center rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex h-[40px] flex-1 items-center justify-center rounded-md font-mono text-xs font-semibold tracking-[-0.07em] transition-colors ${
              danger ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Chat panel (right) ───────────────────────────────────────────────────────

function ChatPanel({ order }: { order: Order }) {
  const d        = deriveDisplay(order)
  const gameIcon = GAME_ICONS[order.game?.name ?? '']

  const [messages,       setMessages]       = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [input,          setInput]          = useState('')
  const [kebabOpen,      setKebabOpen]      = useState(false)
  const [confirmAction,  setConfirmAction]  = useState<ConfirmAction>(null)
  const [imageError,     setImageError]     = useState<string | null>(null)

  const kebabRef  = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  // Scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close kebab on outside click
  useEffect(() => {
    function handler(e: PointerEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  // Reset chat state when switching orders
  useEffect(() => {
    setMessages(MOCK_MESSAGES)
    setInput('')
    setKebabOpen(false)
    setConfirmAction(null)
    setImageError(null)
  }, [order.id])

  function sendMessage() {
    const text = input.trim()
    if (!text) return
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: 'client', text, time: now }])
    setInput('')
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)
    if (!ALLOWED_TYPES.includes(file.type)) { setImageError('Only JPG, PNG or WebP images are allowed.'); return }
    if (file.size > MAX_FILE_SIZE)          { setImageError('Image must be under 5 MB.'); return }
    const dataUrl = await compressImage(file)
    if (!dataUrl) { setImageError('Could not process image.'); return }
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: 'client', imageUrl: dataUrl, time: now }])
  }

  const CONFIRM_META: Record<NonNullable<ConfirmAction>, { title: string; description: string; label: string; danger: boolean }> = {
    mark_completed: { title: 'Mark as Completed?',    description: 'This will mark your order as completed. The booster will be paid once you confirm.',            label: 'Mark Completed',  danger: false },
    open_dispute:   { title: 'Open a Dispute?',        description: 'Opening a dispute will pause the order and notify our support team to review the situation.',   label: 'Open Dispute',    danger: true  },
    need_support:   { title: 'Contact Support?',       description: 'A support agent will be added to this chat to help resolve any issues.',                        label: 'Contact Support', danger: false },
    cancel_request: { title: 'Cancel this Request?',   description: 'Cancelling will stop the boost. Depending on progress, a partial refund may apply.',            label: 'Cancel Request',  danger: true  },
  }

  return (
    <div className="flex min-h-0 h-full flex-col bg-[#111111]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#2a2a2a] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {gameIcon
            ? <Image src={gameIcon} alt={d.gameName} width={32} height={32} className="h-8 w-8 shrink-0 rounded-md object-cover" />
            : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2a2a2a]"><span className="font-sans text-xs font-bold text-white">{d.gameName.charAt(0)}</span></div>
          }
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white truncate">{d.orderTitle}</p>
            <p className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] truncate">{d.gameName} · {d.serviceLabel}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] tracking-[-0.03em] ${COMPLETION_BADGE[d.completionStatus]}`}>
            {d.completionStatus}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setConfirmAction('mark_completed')}
            className="flex h-[34px] items-center gap-1.5 rounded-md border border-green-500 bg-green-500/10 px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-green-500 transition-colors hover:bg-green-500/20"
          >
            <CheckCircle2 size={13} strokeWidth={2} /> Mark Completed
          </button>

          {/* Kebab */}
          <div ref={kebabRef} className="relative">
            <button
              onClick={() => setKebabOpen((v) => !v)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
            >
              <MoreVertical size={15} strokeWidth={1.5} />
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#111] py-1.5 shadow-2xl">
                {([
                  { action: 'open_dispute'   as ConfirmAction, label: 'Open Dispute',   icon: <AlertTriangle size={13} strokeWidth={1.5} className="text-orange-400" /> },
                  { action: 'need_support'   as ConfirmAction, label: 'Need Support',   icon: <HelpCircle    size={13} strokeWidth={1.5} className="text-blue-400"   /> },
                  { action: 'cancel_request' as ConfirmAction, label: 'Cancel Request', icon: <XCircle       size={13} strokeWidth={1.5} className="text-red-400"    /> },
                ] as const).map(({ action, label, icon }) => (
                  <button
                    key={action}
                    onClick={() => { setKebabOpen(false); setConfirmAction(action) }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 font-mono text-xs tracking-[-0.05em] text-[#9ca3af] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => {
            if (msg.sender === 'system') {
              const sysColorClass = msg.systemColor
                ? ({ orange: 'text-orange-400', blue: 'text-blue-400', red: 'text-red-400', green: 'text-green-400' } as Record<string, string>)[msg.systemColor]
                : 'text-[#4a4a4a]'
              return (
                <div key={msg.id} className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[#2a2a2a]" />
                  <span className={`font-mono text-[10px] tracking-[-0.05em] ${sysColorClass}`}>{msg.text}</span>
                  <div className="h-px flex-1 bg-[#2a2a2a]" />
                </div>
              )
            }
            const isClient = msg.sender === 'client'
            return (
              <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[65%]">
                  {!isClient && (
                    <p className="mb-1 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">Booster</p>
                  )}
                  {msg.imageUrl ? (
                    <img
                      src={msg.imageUrl}
                      alt="uploaded"
                      className={`max-w-full rounded-md object-cover ${isClient ? 'rounded-br-none' : 'rounded-bl-none'}`}
                      style={{ maxHeight: 240 }}
                    />
                  ) : (
                    <div className={`rounded-md px-3.5 py-2.5 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                      isClient
                        ? 'bg-[#e8e8e8] text-[#111111] rounded-br-none'
                        : 'border border-[#2a2a2a] bg-[#141414] text-[#d0d0d0] rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  <p className={`mt-1 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a] ${isClient ? 'text-right' : 'text-left'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Image error bar ─────────────────────────────────────────────── */}
      {imageError && (
        <div className="shrink-0 mx-4 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 text-red-400" />
          <span className="font-mono text-[10px] tracking-[-0.05em] text-red-400">{imageError}</span>
          <button onClick={() => setImageError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Input row ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            title="Upload image (JPG, PNG, WebP · max 5 MB)"
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
          >
            <ImagePlus size={15} strokeWidth={1.5} />
          </button>
          <input
            type="text"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            className="h-[40px] flex-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none transition-colors focus:border-[#6e6d6f]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md bg-white text-black transition-colors hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Confirm modal ──────────────────────────────────────────────── */}
      {confirmAction && (
        <ConfirmModal
          title={CONFIRM_META[confirmAction].title}
          description={CONFIRM_META[confirmAction].description}
          confirmLabel={CONFIRM_META[confirmAction].label}
          danger={CONFIRM_META[confirmAction].danger}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            const ACTION_SYS: Record<NonNullable<ConfirmAction>, { text: string; systemColor: ChatMessage['systemColor'] }> = {
              mark_completed: { text: 'Order marked as completed. Thank you!',          systemColor: 'green'  },
              open_dispute:   { text: 'Dispute opened — support team notified.',          systemColor: 'orange' },
              need_support:   { text: 'A support agent has been added to this chat.',     systemColor: 'blue'   },
              cancel_request: { text: 'Order cancelled — a partial refund may apply.',   systemColor: 'red'    },
            }
            const { text, systemColor } = ACTION_SYS[confirmAction]
            setMessages((prev) => [...prev, { id: String(Date.now()), sender: 'system', text, time: now, systemColor }])
            setConfirmAction(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Left panel order card ────────────────────────────────────────────────────

function OrderCard({ order, isActive, onClick }: {
  order: Order; isActive: boolean; onClick: () => void
}) {
  const d        = deriveDisplay(order)
  const gameIcon = GAME_ICONS[order.game?.name ?? '']

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left px-4 py-4 border-b border-[#1a1a1a] transition-colors duration-150 ${
        isActive ? 'bg-[#1f1f1f]' : 'hover:bg-[#161616]'
      }`}
    >
      {/* Active indicator */}
      {isActive && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/50 rounded-r-full" />}

      {/* Row 1: title + date */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`font-mono text-[11px] font-semibold tracking-[-0.06em] leading-snug truncate ${isActive ? 'text-white' : 'text-[#c8c8c8]'}`}>
          {d.orderTitle}
        </p>
        <span className="shrink-0 font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a] mt-px">
          {d.createdDate}
        </span>
      </div>

      {/* Row 2: game icon + subtitle */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {gameIcon && (
          <Image src={gameIcon} alt={d.gameName} width={13} height={13} className="h-[13px] w-[13px] rounded-sm object-cover opacity-60 shrink-0" />
        )}
        <span className="font-mono text-[10px] tracking-[-0.05em] text-[#5a5a5a] truncate">
          {d.gameName} · {d.serviceLabel}
        </span>
      </div>

      {/* Row 3: order ID + price | status badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a]">
          #{d.shortId} · ${d.price.toFixed(2)}
        </span>
        <span className={`inline-flex items-center rounded px-1.5 py-px font-mono text-[9px] tracking-[-0.02em] ${COMPLETION_BADGE[d.completionStatus]}`}>
          {d.completionStatus}
        </span>
      </div>
    </button>
  )
}

// ─── Empty / placeholder states ───────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a]">
        <MessageSquare size={20} strokeWidth={1.5} className="text-[#3a3a3a]" />
      </div>
      <div>
        <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">No orders yet</p>
        <p className="mt-1 font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
          You don&apos;t have any active orders to chat about.
        </p>
      </div>
    </div>
  )
}

function NoChatSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center bg-[#0f0f0f]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a]">
        <MessageSquare size={20} strokeWidth={1.5} className="text-[#3a3a3a]" />
      </div>
      <p className="font-mono text-sm tracking-[-0.07em] text-[#6e6d6f]">
        Select an order to open its chat
      </p>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrdersChatLayout({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null)

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#111]">
        <EmptyState />
      </div>
    )
  }

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-md border border-[#2a2a2a]">

      {/* ── Left panel: order list (30%) ──────────────────────────────── */}
      <div className="w-[30%] shrink-0 flex flex-col border-r border-[#2a2a2a] bg-[#111] overflow-hidden">
        {/* Panel header */}
        <div className="shrink-0 border-b border-[#2a2a2a] px-4 py-3.5">
          <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">Your Orders</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isActive={order.id === selectedId}
              onClick={() => setSelectedId(order.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel: chat (70%) ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {selectedOrder
          ? <ChatPanel key={selectedOrder.id} order={selectedOrder} />
          : <NoChatSelected />
        }
      </div>
    </div>
  )
}
