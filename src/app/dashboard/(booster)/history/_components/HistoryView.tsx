'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react'
import type { Order } from '@/types'
import { GAME_ICONS } from '@/lib/config/game-icons'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'

// ── Row shape ─────────────────────────────────────────────────────────────────

interface HistoryRow {
  id:          string
  title:       string
  game:        string
  service:     string
  client:      string
  status:      string
  payout:      number
  completedAt: string
}

function buildTitle(order: Order): string {
  const d = (order.details ?? {}) as Record<string, unknown>
  const from    = typeof d.current_rank === 'string' ? d.current_rank : (order.service?.label ?? order.id.slice(0, 8).toUpperCase())
  const to      = typeof d.target_rank  === 'string' ? ` → ${d.target_rank}` : ''
  const winsStr = typeof d.wins === 'number' ? ` · ${d.wins} Wins` : ''
  return `${from}${to}${winsStr}`
}

function ordersToRows(orders: Order[]): HistoryRow[] {
  return orders.map((o) => ({
    id:          o.id,
    title:       buildTitle(o),
    game:        o.game?.name ?? 'Unknown',
    service:     o.service?.label ?? '',
    client:      o.client_id.slice(0, 8).toUpperCase(),
    status:      o.status,
    payout:      o.price,
    completedAt: o.updated_at,
  }))
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  completed:   'text-green-400 bg-green-500/10 border border-green-500/20',
  in_progress: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20',
}
const STATUS_LABEL: Record<string, string> = {
  completed:   'Completed',
  in_progress: 'In Progress',
}

const PAGE_SIZE = 15

// ── Filter dropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const count = selected.size

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-1.5 rounded-md border px-3 font-mono text-xs tracking-[-0.05em] transition-all ${
          count > 0
            ? 'border-[#6e6d6f] bg-white/10 text-white'
            : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'
        }`}
      >
        {count > 0 ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">
            {count}
          </span>
        ) : (
          <span className="text-[#4a4a4a]">+</span>
        )}
        {label}
        <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[180px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] py-1.5 shadow-2xl">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 font-mono text-xs tracking-[-0.05em] text-[#9ca3af] transition-colors hover:bg-white/5 hover:text-white"
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => onChange(opt)}
                className="h-3.5 w-3.5 accent-white"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function HistoryView({ initialOrders }: { initialOrders: Order[] }) {
  const HISTORY = useMemo(() => ordersToRows(initialOrders), [initialOrders])

  const [query,         setQuery]         = useState('')
  const [gameFilter,    setGameFilter]    = useState<Set<string>>(new Set())
  const [serviceFilter, setServiceFilter] = useState<Set<string>>(new Set())
  const [statusFilter,  setStatusFilter]  = useState<Set<string>>(new Set())
  const [sortAsc,       setSortAsc]       = useState(false)
  const [page,          setPage]          = useState(1)

  function toggleFilter(setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
    setPage(1)
  }

  const allGames    = [...new Set(HISTORY.map((h) => h.game))]
  const allServices = [...new Set(HISTORY.map((h) => h.service))]
  const allStatuses = ['Completed', 'In Progress']

  const filtered = useMemo(() => {
    return HISTORY
      .filter((h) => {
        if (gameFilter.size    && !gameFilter.has(h.game))                   return false
        if (serviceFilter.size && !serviceFilter.has(h.service))             return false
        if (statusFilter.size  && !statusFilter.has(STATUS_LABEL[h.status])) return false
        if (query &&
          !h.title.toLowerCase().includes(query.toLowerCase()) &&
          !h.id.toLowerCase().includes(query.toLowerCase()))                 return false
        return true
      })
      .sort((a, b) => {
        const cmp = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
        return sortAsc ? cmp : -cmp
      })
  }, [HISTORY, query, gameFilter, serviceFilter, statusFilter, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const totalEarned = HISTORY
    .filter((h) => h.status === 'completed')
    .reduce((s, h) => s + h.payout, 0)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={History}
        title="Completed History"
        subtitle={`${HISTORY.filter((h) => h.status === 'completed').length} completed boosts · $${totalEarned.toFixed(2)} total earned`}
      />

      {/* ── Controls ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search history…"
            className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] transition-colors focus:border-[#6e6d6f] focus:outline-none"
          />
        </div>

        <FilterDropdown
          label="Game"
          options={allGames}
          selected={gameFilter}
          onChange={(v) => toggleFilter(setGameFilter, v)}
        />
        <FilterDropdown
          label="Service"
          options={allServices}
          selected={serviceFilter}
          onChange={(v) => toggleFilter(setServiceFilter, v)}
        />
        <FilterDropdown
          label="Status"
          options={allStatuses}
          selected={statusFilter}
          onChange={(v) => toggleFilter(setStatusFilter, v)}
        />

        <button
          onClick={() => { setSortAsc((v) => !v); setPage(1) }}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:text-white"
        >
          <ArrowUpDown size={12} strokeWidth={1.5} />
          Date
          <span className="text-[10px] text-[#4a4a4a]">{sortAsc ? '↑' : '↓'}</span>
        </button>
      </div>

      {/* ── Table ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                {['ORDER', 'BOOST ID', 'CLIENT', 'SERVICE', 'PAYOUT', 'STATUS', 'DATE'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">
                    {HISTORY.length === 0 ? 'No orders yet.' : 'No orders match your filters.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                      i === pageRows.length - 1 ? 'border-none' : ''
                    }`}
                  >
                    {/* ORDER */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {GAME_ICONS[row.game] ? (
                          <Image
                            src={GAME_ICONS[row.game]}
                            alt={row.game}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#2a2a2a]">
                            <span className="font-sans text-[9px] font-bold text-white">
                              {row.game.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs tracking-[-0.05em] text-white">{row.title}</span>
                          <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">{row.game}</span>
                        </div>
                      </div>
                    </td>

                    {/* BOOST ID */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                        {row.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>

                    {/* CLIENT */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                        {row.client}
                      </span>
                    </td>

                    {/* SERVICE */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                        {row.service}
                      </span>
                    </td>

                    {/* PAYOUT */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-white">
                        ${row.payout.toFixed(2)}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${STATUS_BADGE[row.status] ?? 'text-[#6e6d6f] bg-white/5'}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>

                    {/* DATE */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                        {formatDate(row.completedAt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-1">
        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">
          {filtered.length === 0
            ? '0 rows'
            : `${filtered.length} rows — Page ${safePage} of ${totalPages}`}
        </span>

        <div className="flex items-center gap-1">
          {([
            { icon: ChevronFirst, action: () => setPage(1),            disabled: safePage === 1 },
            { icon: ChevronLeft,  action: () => setPage((p) => p - 1), disabled: safePage === 1 },
          ] as const).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="w-5 text-center font-mono text-[11px] text-[#3a3a3a]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[11px] transition-colors ${
                    safePage === p
                      ? 'border-[#6e6d6f] bg-white/10 text-white'
                      : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            )}

          {([
            { icon: ChevronRight, action: () => setPage((p) => p + 1), disabled: safePage === totalPages },
            { icon: ChevronLast,  action: () => setPage(totalPages),   disabled: safePage === totalPages },
          ] as const).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
