'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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
  CreditCard,
  Tag,
} from 'lucide-react'
import type { Transaction, TransactionStatus, PaymentMethod } from '@/types'
import {
  STATUS_LABEL,
  METHOD_LABEL,
  WALLET_COLUMNS,
  hasDiscount,
  deriveTitle,
  computeStats,
  filterTransactions,
  sortTransactions,
  paginateTransactions,
} from '@/lib/wallet-utils'

// ─── Badge styles ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<TransactionStatus, string> = {
  pending:   'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  completed: 'border border-green-500/40  text-green-400  bg-green-500/10',
  failed:    'border border-red-500/40    text-red-400    bg-red-500/10',
  refunded:  'border border-blue-500/40   text-blue-400   bg-blue-500/10',
}

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  card:    <CreditCard size={13} strokeWidth={1.5} />,
  paypal:  <CreditCard size={13} strokeWidth={1.5} />,
  crypto:  <CreditCard size={13} strokeWidth={1.5} />,
  balance: <CreditCard size={13} strokeWidth={1.5} />,
  other:   <CreditCard size={13} strokeWidth={1.5} />,
}

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
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-white/10 text-[#6e6d6f] hover:border-white/20 hover:text-white'
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
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#111111] py-1.5 shadow-2xl">
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

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [15, 20, 30, 40, 50]

export function WalletView({ transactions: injected = [] }: { transactions?: Transaction[] }) {
  const [query,         setQuery]         = useState('')
  const [statusFilter,  setStatusFilter]  = useState<Set<string>>(new Set())
  const [methodFilter,  setMethodFilter]  = useState<Set<string>>(new Set())
  const [sortAsc,       setSortAsc]       = useState(false)
  const [page,          setPage]          = useState(1)
  const [pageSize]                        = useState(15)

  function toggleFilter(setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
    setPage(1)
  }

  const filtered = useMemo(() => {
    const base = filterTransactions(injected, { query, statusFilter, methodFilter })
    return sortTransactions(base, sortAsc)
  }, [query, statusFilter, methodFilter, sortAsc, injected])

  const { rows: pageRows, totalPages, safePage } = paginateTransactions(filtered, page, pageSize)
  const { totalSpent, totalSavings, pendingCount } = computeStats(injected)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex h-full flex-col gap-4">

      {/* ── Stats row ── */}
      <div className="flex shrink-0 gap-3">
        {[
          { label: 'Total Spent',    value: `$${totalSpent.toFixed(2)}` },
          { label: 'Total Savings',  value: totalSavings > 0 ? `$${totalSavings.toFixed(2)}` : '—', accent: true },
          { label: 'Pending',        value: String(pendingCount) },
          { label: 'Transactions',   value: String(injected.length) },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="flex flex-1 flex-col gap-1 rounded-md border border-white/10 bg-[#111111] px-4 py-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">{label}</span>
            <span className={`font-mono text-lg font-semibold tracking-[-0.05em] ${accent ? 'text-green-400' : 'text-white'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Controls bar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search transactions…"
            className="h-9 w-full rounded-md border border-white/10 bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] focus:border-white/30 focus:outline-none transition-colors"
          />
        </div>

        <FilterDropdown
          label="Status"
          options={['Pending', 'Completed', 'Failed', 'Refunded']}
          selected={statusFilter}
          onChange={(v) => toggleFilter(setStatusFilter, v)}
        />
        <FilterDropdown
          label="Method"
          options={['Credit Card', 'PayPal', 'Crypto', 'Balance', 'Other']}
          selected={methodFilter}
          onChange={(v) => toggleFilter(setMethodFilter, v)}
        />

        {/* Sort */}
        <button
          onClick={() => { setSortAsc((v) => !v); setPage(1) }}
          className="flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-white/20 hover:text-white"
        >
          <ArrowUpDown size={12} strokeWidth={1.5} />
          Date
          <span className="text-[10px] text-[#4a4a4a]">{sortAsc ? '↑' : '↓'}</span>
        </button>
      </div>

      {/* ── Table ── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#111111]">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/10 bg-[#111111]">
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">ORDER</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">PAYMENT METHOD</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">STATUS</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">TRANSACTION ID</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">AMOUNT</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">DISCOUNT</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">LAST UPDATED</th>
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((tx, i) => {
                  const title    = deriveTitle(tx)
                  const gameName = tx.order?.game?.name ?? 'Unknown'
                  const gameIcon = tx.order?.game ? GAME_ICONS[gameName] : undefined
                  const txHasDiscount = hasDiscount(tx)

                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                        i === pageRows.length - 1 ? 'border-none' : ''
                      }`}
                    >
                      {/* Order */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {gameIcon ? (
                            <Image
                              src={gameIcon}
                              alt={gameName}
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-md bg-[#2a2a2a] flex items-center justify-center">
                              <span className="font-sans text-[9px] font-bold text-white">
                                {gameName.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs tracking-[-0.05em] text-white">
                              {title}
                            </span>
                            <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">
                              {gameName}
                              {tx.order?.service?.label ? ` · ${tx.order.service.label}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Payment method */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        <div className="flex items-center gap-2 font-mono text-xs tracking-[-0.05em] text-[#9ca3af]">
                          {METHOD_ICONS[tx.payment_method]}
                          {METHOD_LABEL[tx.payment_method]}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${STATUS_BADGE[tx.status]}`}>
                          {STATUS_LABEL[tx.status]}
                        </span>
                      </td>

                      {/* Transaction ID */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                          {tx.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-white">
                          ${Number(tx.amount).toFixed(2)} {tx.currency}
                        </span>
                      </td>

                      {/* Discount */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        {txHasDiscount ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-green-400">
                              −${Number(tx.discount_amount).toFixed(2)}
                            </span>
                            {tx.promo_code && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[-0.03em] text-[#6e6d6f] border border-white/10 rounded px-1.5 py-0.5 w-fit">
                                <Tag size={9} strokeWidth={1.5} />
                                {tx.promo_code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] tracking-[-0.05em] text-[#3a3a3a]">—</span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="hidden md:table-cell px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
                          {formatDate(tx.updated_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })
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
          {(
            [
              { icon: ChevronFirst, action: () => setPage(1),            disabled: safePage === 1 },
              { icon: ChevronLeft,  action: () => setPage((p) => p - 1), disabled: safePage === 1 },
            ] as const
          ).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-[#6e6d6f] transition-colors hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 text-[#6e6d6f] hover:border-white/20 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            )}

          {(
            [
              { icon: ChevronRight, action: () => setPage((p) => p + 1),   disabled: safePage === totalPages },
              { icon: ChevronLast,  action: () => setPage(totalPages),      disabled: safePage === totalPages },
            ] as const
          ).map(({ icon: Icon, action, disabled }, i) => (
            <button
              key={i}
              onClick={action}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-[#6e6d6f] transition-colors hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// wallet-utils re-exports (STATUS_LABEL, METHOD_LABEL, etc.) are imported at the top.
