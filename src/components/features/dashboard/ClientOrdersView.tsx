'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { GAME_ICONS } from '@/lib/config/game-icons'
import {
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  Trash2,
} from 'lucide-react'

import {
  type PaymentStatus,
  type CompletionStatus,
  type MappedOrder,
  PAYMENT_BADGE,
  COMPLETION_BADGE,
  filterOrders,
  sortOrders,
  paginateOrders,
} from '@/lib/orders-utils'
import { deleteOrdersAction } from '@/lib/actions/orders'

// ─── Local alias (keeps rest of component unchanged) ──────────────────────────
type MockOrder = MappedOrder
const EMPTY: MockOrder[] = []

// ─── Filter dropdown ──────────────────────────────────────────────────────────

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

// ─── Main component ──────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [15, 20, 30, 40, 50]

export function ClientOrdersView({ orders: injectedOrders, chatMode = false }: { orders?: MockOrder[]; chatMode?: boolean }) {
  const orders = injectedOrders ?? EMPTY
  const [query,            setQuery]           = useState('')
  const [typeFilter,       setTypeFilter]       = useState<Set<string>>(new Set())
  const [paymentFilter,    setPaymentFilter]    = useState<Set<string>>(new Set())
  const [completionFilter, setCompletionFilter] = useState<Set<string>>(new Set())
  const [sortAsc,          setSortAsc]          = useState(false)
  const [page,             setPage]             = useState(1)
  const [pageSize,         setPageSize]         = useState(15)
  const [selectedOrders,   setSelectedOrders]   = useState<string[]>([])
  const router = useRouter()

  function toggleFilter(setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
    setPage(1)
  }

  const filtered = useMemo(() => {
    const base = filterOrders(orders, { query, typeFilter, paymentFilter, completionFilter })
    return sortOrders(base, sortAsc)
  }, [query, typeFilter, paymentFilter, completionFilter, sortAsc])

  const { rows: pageRows, totalPages, safePage, rowFrom, rowTo } = paginateOrders(filtered, page, pageSize)

  const allPageIds = pageRows.map((o) => o.id)
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedOrders.includes(id))

  function toggleAll() {
    if (allSelected) {
      setSelectedOrders((prev) => prev.filter((id) => !allPageIds.includes(id)))
    } else {
      setSelectedOrders((prev) => [...new Set([...prev, ...allPageIds])])
    }
  }

  function toggleOne(id: string) {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Are you sure you want to delete ${selectedOrders.length} selected order(s)? This cannot be undone.`)) return
    try {
      const { error } = await deleteOrdersAction(selectedOrders)
      if (error) { alert(`Delete failed: ${error}`); return }
      setSelectedOrders([])
      router.refresh()
    } catch (err) {
      alert(`Unexpected error: ${String(err)}`)
    }
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setPage(1)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Controls bar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
          <input
            type="search"
            value={query}
            onChange={handleSearch}
            placeholder="Search orders…"
            className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] focus:border-[#6e6d6f] focus:outline-none transition-colors"
          />
        </div>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Type"
          options={['Boost', 'Account']}
          selected={typeFilter}
          onChange={(v) => toggleFilter(setTypeFilter, v)}
        />
        <FilterDropdown
          label="Payment"
          options={['Unpaid', 'Processing', 'Paid', 'Refunded', 'Partially Refunded']}
          selected={paymentFilter}
          onChange={(v) => toggleFilter(setPaymentFilter, v)}
        />
        <FilterDropdown
          label="Status"
          options={['Waiting', 'In Progress', 'Completed', 'Canceled', 'Disputed', 'Need Action']}
          selected={completionFilter}
          onChange={(v) => toggleFilter(setCompletionFilter, v)}
        />

        {/* Sort */}
        <button
          onClick={() => { setSortAsc((v) => !v); setPage(1) }}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:text-white"
        >
          <ArrowUpDown size={12} strokeWidth={1.5} />
          Purchased At
          <span className="text-[10px] text-[#4a4a4a]">{sortAsc ? '↑' : '↓'}</span>
        </button>

        {/* Bulk delete button — only visible when orders are selected */}
        {selectedOrders.length > 0 && (
          <button
            onClick={handleBulkDelete}
            title={`Delete ${selectedOrders.length} selected order(s)`}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 font-mono text-xs tracking-[-0.05em] text-red-500 transition-all hover:bg-red-500/20"
          >
            <Trash2 size={13} strokeWidth={1.5} />
            Delete {selectedOrders.length}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
        <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[#2a2a2a] bg-[#111111]">
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 accent-white cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">ORDER</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">ID</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">PAYMENT</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">PRICE</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">CREATED AT</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">STATUS</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white"></th>
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">
                  No orders match your filters.
                </td>
              </tr>
            ) : (
              pageRows.map((order, i) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/dashboard/orders/${order.id.replace('#', '')}`)}
                  className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                    i === pageRows.length - 1 ? 'border-none' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOne(order.id)}
                      className="h-3.5 w-3.5 accent-white cursor-pointer"
                    />
                  </td>

                  {/* Order */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {GAME_ICONS[order.game] ? (
                        <Image
                          src={GAME_ICONS[order.game]}
                          alt={order.game}
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 shrink-0 rounded-md bg-[#2a2a2a] flex items-center justify-center"
                          title={order.game}
                        >
                          <span className="font-sans text-[9px] font-bold text-white">
                            {order.game.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs tracking-[-0.05em] text-white">
                          {order.orderTitle}
                        </span>
                        <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">
                          {order.game} · {order.type}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                      {order.id.replace('#', '').slice(0, 8).toUpperCase()}
                    </span>
                  </td>

                  {/* Payment status */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${PAYMENT_BADGE[order.paymentStatus]}`}>
                      {order.paymentStatus}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-white">
                      ${order.price.toFixed(2)}
                    </span>
                  </td>

                  {/* Created at */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                      {formatDate(order.createdAt)}
                    </span>
                  </td>

                  {/* Completion status */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${COMPLETION_BADGE[order.completionStatus]}`}>
                      {order.completionStatus}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="hidden md:table-cell px-4 py-3.5">
                    {chatMode ? (
                      <Link
                        href={`/dashboard/orders/${order.id.replace('#', '')}?chat=1`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#111111] px-3 py-1.5 font-mono text-[10px] tracking-[-0.05em] text-[#a0a0a0] transition-colors hover:border-[#6e6d6f] hover:text-white"
                      >
                        <MessageSquare size={11} strokeWidth={1.5} /> Open Chat
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/orders/${order.id.replace('#', '')}`}
                        className="flex items-center gap-1 whitespace-nowrap font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f] transition-colors hover:text-white"
                      >
                        View
                        <ArrowRight size={11} strokeWidth={1.5} />
                      </Link>
                    )}
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
        {/* Row info */}
        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">
          {filtered.length === 0
            ? '0 rows'
            : `${filtered.length} rows — Page ${safePage} of ${totalPages}`}
        </span>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          {(
            [
              { icon: ChevronFirst, action: () => setPage(1),             disabled: safePage === 1 },
              { icon: ChevronLeft,  action: () => setPage((p) => p - 1),  disabled: safePage === 1 },
            ] as const
          ).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}

          {/* Page number pills */}
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

          {(
            [
              { icon: ChevronRight, action: () => setPage((p) => p + 1),    disabled: safePage === totalPages },
              { icon: ChevronLast,  action: () => setPage(totalPages),       disabled: safePage === totalPages },
            ] as const
          ).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
