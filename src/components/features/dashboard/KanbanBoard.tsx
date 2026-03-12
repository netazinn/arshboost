'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { GAME_ICONS } from '@/lib/config/game-icons'
import { Search, ChevronDown, SlidersHorizontal, Clock, AlertTriangle } from 'lucide-react'
import type { Order, OrderStatus } from '@/types'
import { calculateSLAStatus, type SLASettings, type SLAResult } from '@/lib/sla-utils'

// ─── Column config ────────────────────────────────────────────────────────────

interface Column {
  id: string
  label: string
  statuses: OrderStatus[]
  headerCls: string
  dotCls: string
  countCls: string
}

const COLUMNS: Column[] = [
  {
    id: 'waiting',
    label: 'Waiting Action',
    statuses: ['pending', 'awaiting_payment'],
    headerCls: 'border-[#3a3a3a]',
    dotCls: 'bg-[#6e6d6f]',
    countCls: 'bg-[#2a2a2a] text-[#9a9a9a]',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    statuses: ['in_progress'],
    headerCls: 'border-yellow-500/30',
    dotCls: 'bg-yellow-400',
    countCls: 'bg-yellow-500/10 text-yellow-400',
  },
  {
    id: 'disputed',
    label: 'Disputed / Support',
    statuses: ['dispute', 'support'],
    headerCls: 'border-orange-500/30',
    dotCls: 'bg-orange-400',
    countCls: 'bg-orange-500/10 text-orange-400',
  },
  {
    id: 'completed',
    label: 'Completed',
    statuses: ['completed', 'cancelled'],
    headerCls: 'border-[#2a2a2a]',
    dotCls: 'bg-green-400',
    countCls: 'bg-green-500/10 text-green-400',
  },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

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
  pending:          'Pending',
  awaiting_payment: 'Awaiting Payment',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Cancelled',
  dispute:          'Dispute',
  support:          'Support',
}

// ─── SLA indicator ───────────────────────────────────────────────────────────

function SLAIndicator({ sla }: { sla: SLAResult }) {
  if (sla.status === 'normal') return null

  const isCritical = sla.status === 'critical'

  return (
    <div
      title={sla.tooltip}
      className={`mt-1.5 flex items-center gap-1.5 rounded px-1.5 py-1 ${
        isCritical
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-amber-500/10 border border-amber-500/20'
      }`}
    >
      {isCritical ? (
        <AlertTriangle
          size={8}
          strokeWidth={2.5}
          className="text-red-400 animate-pulse shrink-0"
        />
      ) : (
        <Clock
          size={8}
          strokeWidth={2.5}
          className="text-amber-400 shrink-0"
        />
      )}
      <span
        className={`font-mono text-[9px] tracking-[-0.03em] ${
          isCritical ? 'text-red-400' : 'text-amber-400'
        }`}
      >
        {sla.label}
      </span>
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, slaSettings }: { order: Order; slaSettings: SLASettings }) {
  const sla      = calculateSLAStatus(order, slaSettings)
  const gameIcon = GAME_ICONS[order.game?.name ?? '']
  const details  = (order.details ?? {}) as Record<string, string>
  const title    = details.current_rank && details.target_rank
    ? `${details.current_rank} → ${details.target_rank}`
    : order.service?.label ?? 'Order'

  const borderCls =
    sla.status === 'critical'
      ? 'border-red-500/30 hover:border-red-500/50'
      : sla.status === 'warning'
        ? 'border-amber-500/25 hover:border-amber-500/45'
        : 'border-[#1e1e1e] hover:border-[#3a3a3a]'

  return (
    <Link
      href={`/admin/master-inbox?order=${order.id}`}
      className={`block rounded-lg bg-[#111111] p-3.5 hover:bg-[#151515] transition-all cursor-pointer border ${borderCls}`}
    >
      {/* Top row: game icon + title + status */}
      <div className="flex items-start gap-2 mb-2.5">
        {gameIcon
          ? <Image src={gameIcon} alt={order.game?.name ?? ''} width={20} height={20}
              className="h-5 w-5 rounded-sm shrink-0 mt-0.5 object-cover" />
          : <div className="h-5 w-5 rounded-sm bg-[#2a2a2a] shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white truncate leading-tight">
            {title}
          </p>
          <p className="font-mono text-[9px] tracking-[-0.04em] text-[#4a4a4a] truncate mt-0.5">
            {order.game?.name ?? '—'} · #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-px font-mono text-[8px] tracking-[-0.02em] ${STATUS_CLS[order.status] ?? STATUS_CLS.pending}`}>
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* Client + Booster row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">Client</span>
          <span className="font-mono text-[10px] text-[#c8c8c8] tracking-[-0.05em] truncate">
            {order.client?.username ?? order.client?.email ?? '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 items-end">
          <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">Booster</span>
          <span className="font-mono text-[10px] text-[#c8c8c8] tracking-[-0.05em] truncate">
            {order.booster?.username ?? order.booster?.email ?? <span className="text-[#4a4a4a]">Unassigned</span>}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[-0.04em] text-white">
          ${order.price.toFixed(2)}
        </span>
        <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">
          {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* SLA warning / critical indicator */}
      <SLAIndicator sla={sla} />
    </Link>
  )
}

// ─── Select dropdown ──────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] tracking-[-0.04em] transition-colors ${
          value
            ? 'border-[#3a3a3a] text-white bg-white/5'
            : 'border-[#1e1e1e] text-[#4a4a4a] hover:border-[#3a3a3a] hover:text-[#9a9a9a]'
        }`}
      >
        <span className="max-w-[110px] truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={10} strokeWidth={2} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#111] py-1 shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 font-mono text-[10px] tracking-[-0.04em] transition-colors ${
                opt.value === value
                  ? 'bg-white/10 text-white'
                  : 'text-[#6e6d6f] hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function KanbanBoard({
  initialOrders,
  slaSettings,
}: {
  initialOrders: Order[]
  slaSettings: SLASettings
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  // ── Filter / sort state ──
  const [search,   setSearch]   = useState('')
  const [game,     setGame]     = useState('')
  const [assignee, setAssignee] = useState('')
  const [sortBy,   setSortBy]   = useState('newest')

  // Realtime: re-fetch on any INSERT/UPDATE to orders
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin:kanban')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          // Re-fetch all orders (simple approach — avoids join complexity on payload)
          const { data } = await supabase
            .from('orders')
            .select(`
              *,
              game:games(id, name, slug, logo_url),
              service:games_services(id, type, label),
              client:profiles!orders_client_id_fkey(id, email, username, avatar_url, role),
              booster:profiles!orders_booster_id_fkey(id, email, username, avatar_url, role)
            `)
            .order('created_at', { ascending: false })
          if (data) setOrders(data as Order[])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Unique games ──
  const gameOptions = useMemo(() => {
    const names = Array.from(new Set(orders.map((o) => o.game?.name).filter(Boolean))) as string[]
    return [
      { value: '', label: 'All Games' },
      ...names.sort().map((n) => ({ value: n, label: n })),
    ]
  }, [orders])

  // ── Unique boosters ──
  const assigneeOptions = useMemo(() => {
    const seen = new Set<string>()
    const boosters: { value: string; label: string }[] = []
    for (const o of orders) {
      if (o.booster_id && !seen.has(o.booster_id)) {
        seen.add(o.booster_id)
        boosters.push({
          value: o.booster_id,
          label: o.booster?.username ?? o.booster?.email ?? o.booster_id.slice(0, 8),
        })
      }
    }
    return [
      { value: '',           label: 'All Assignees' },
      { value: 'unassigned', label: 'Unassigned' },
      ...boosters.sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [orders])

  // ── Filtered + sorted orders ──
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // Search: by order ID or client/booster username
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.client?.username?.toLowerCase().includes(q) ||
          o.client?.email?.toLowerCase().includes(q) ||
          o.booster?.username?.toLowerCase().includes(q) ||
          o.booster?.email?.toLowerCase().includes(q),
      )
    }

    // Game filter
    if (game) {
      result = result.filter((o) => o.game?.name === game)
    }

    // Assignee filter
    if (assignee === 'unassigned') {
      result = result.filter((o) => !o.booster_id)
    } else if (assignee) {
      result = result.filter((o) => o.booster_id === assignee)
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'price_high':
        result.sort((a, b) => b.price - a.price)
        break
      case 'price_low':
        result.sort((a, b) => a.price - b.price)
        break
      default: // newest
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return result
  }, [orders, search, game, assignee, sortBy])

  const sortOptions = [
    { value: 'newest',     label: 'Newest First' },
    { value: 'oldest',     label: 'Oldest First' },
    { value: 'price_high', label: 'Price: High → Low' },
    { value: 'price_low',  label: 'Price: Low → High' },
  ]

  const hasActiveFilters = !!(search || game || assignee || sortBy !== 'newest')

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <SlidersHorizontal size={13} strokeWidth={1.5} className="text-[#4a4a4a] shrink-0" />

        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-[#1e1e1e] bg-[#0f0f0f] px-2.5 py-1.5 flex-1 min-w-[180px] max-w-[260px] focus-within:border-[#3a3a3a] transition-colors">
          <Search size={11} strokeWidth={1.5} className="text-[#4a4a4a] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID or username…"
            className="flex-1 bg-transparent font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none"
          />
        </div>

        {/* Game filter */}
        <Select value={game} onChange={setGame} options={gameOptions} placeholder="All Games" />

        {/* Assignee filter */}
        <Select value={assignee} onChange={setAssignee} options={assigneeOptions} placeholder="All Assignees" />

        {/* Sort */}
        <Select value={sortBy} onChange={setSortBy} options={sortOptions} placeholder="Sort" />

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setGame(''); setAssignee(''); setSortBy('newest') }}
            className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] hover:text-[#9a9a9a] transition-colors ml-auto"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto font-mono text-[9px] tracking-[-0.03em] text-[#3a3a3a]">
          {filteredOrders.length} / {orders.length}
        </span>
      </div>

      {/* ── Columns ── */}
      <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colOrders = filteredOrders.filter((o) => (col.statuses as string[]).includes(o.status))
        return (
          <div key={col.id} className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
            {/* Column header */}
            <div className={`flex items-center justify-between mb-3 pb-2 border-b ${col.headerCls}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${col.dotCls}`} />
                <span className="font-mono text-[11px] font-semibold tracking-[-0.05em] text-[#c8c8c8]">
                  {col.label}
                </span>
              </div>
              <span className={`inline-flex items-center rounded px-1.5 py-px font-mono text-[9px] tracking-[-0.02em] ${col.countCls}`}>
                {colOrders.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
              {colOrders.length === 0 ? (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[#1e1e1e]">
                  <span className="font-mono text-[10px] text-[#3a3a3a] tracking-[-0.04em]">Empty</span>
                </div>
              ) : (
                colOrders.map((order) => (
                  <OrderCard key={order.id} order={order} slaSettings={slaSettings} />
                ))
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
