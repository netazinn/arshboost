'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { calculateBoosterPayout } from '@/lib/payout'
import { requestWithdrawalAction } from '@/lib/actions/withdrawals'
import type { Order, Withdrawal } from '@/types'
import {
  Wallet,
  ArrowUpRight,
  Building2,
  CreditCard,
  CheckCircle2,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'

const STATUS_BADGE: Record<string, string> = {
  paid:     'text-green-400 bg-green-500/10 border border-green-500/20',
  pending:  'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20',
  approved: 'text-green-400 bg-green-500/10 border border-green-500/20',
  rejected: 'text-red-400 bg-red-500/10 border border-red-500/20',
}

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
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">{count}</span>
        ) : (
          <span className="text-[#4a4a4a]">+</span>
        )}
        {label}
        <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] py-1.5 shadow-2xl">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-3 px-4 py-2 font-mono text-xs tracking-[-0.05em] text-[#9ca3af] transition-colors hover:bg-white/5 hover:text-white">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => onChange(opt)} className="h-3.5 w-3.5 accent-white" />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

function buildBoostTitle(order: Order): string {
  const d = (order.details ?? {}) as Record<string, unknown>
  const from    = typeof d.current_rank === 'string' ? d.current_rank : (order.service?.label ?? order.id.slice(0, 8).toUpperCase())
  const to      = typeof d.target_rank  === 'string' ? ` → ${d.target_rank}` : ''
  const winsStr = typeof d.wins === 'number' ? ` · ${d.wins} Wins` : ''
  return `${from}${to}${winsStr}`
}

export function BoosterWalletView({ orders, withdrawals: initialWithdrawals, availableBalance, bankDetails }: {
  orders: Order[]
  withdrawals: Withdrawal[]
  availableBalance: number
  bankDetails: {
    holder: string | null
    bank: string | null
    swift: string | null
    iban: string | null
    status: 'none' | 'approved' | 'under_review'
  }
}) {
  const router = useRouter()
  // ── Derived data from real orders ──────────────────────────────────────────
  const completed  = orders.filter(o => o.status === 'completed')
  const inProgress = orders.filter(o => o.status === 'in_progress')
  const BALANCE    = availableBalance
  const PENDING    = inProgress.reduce((s, o) => s + calculateBoosterPayout(o.price).boosterPayout, 0)
  const TOTAL_PAID = initialWithdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0)

  const PAYMENTS = orders.map(o => ({
    id:     o.id.slice(0, 8).toUpperCase(),
    boost:  buildBoostTitle(o),
    amount: calculateBoosterPayout(o.price).boosterPayout,
    status: o.status === 'completed' ? 'paid' : 'pending',
    date:   o.updated_at.slice(0, 10),
  }))

  const TRANSACTIONS = orders.map(o => ({
    id:          `TXN-${o.id.slice(0, 6).toUpperCase()}`,
    type:        'earning',
    description: buildBoostTitle(o),
    amount:      calculateBoosterPayout(o.price).boosterPayout,
    date:        o.updated_at.slice(0, 10),
  }))

  const BANK = {
    holder: bankDetails.holder ?? '',
    iban:   bankDetails.iban   ?? '',
    bank:   bankDetails.bank   ?? '',
    swift:  bankDetails.swift  ?? '',
  }
  const bankApproved = bankDetails.status === 'approved'

  // withdrawal state
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(initialWithdrawals)
  const [withdrawAmount,  setWithdrawAmount]  = useState('')
  const [withdrawError,   setWithdrawError]   = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawPending, startWithdraw]      = useTransition()

  // withdrawal state
  const [payQuery,        setPayQuery]        = useState('')
  const [payStatusFilter, setPayStatusFilter] = useState<Set<string>>(new Set())
  const [paySortAsc,      setPaySortAsc]      = useState(false)
  const [payPage,         setPayPage]         = useState(1)

  // transactions state
  const [txQuery,        setTxQuery]        = useState('')
  const [txTypeFilter,   setTxTypeFilter]   = useState<Set<string>>(new Set())
  const [txSortAsc,      setTxSortAsc]      = useState(false)
  const [txPage,         setTxPage]         = useState(1)

  // tab state
  const [tab, setTab] = useState<'payments' | 'transactions' | 'withdrawals'>('payments')

  function toggleFilter(setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) {
    setter((prev) => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next })
  }

  // withdrawal list state
  const [wdQuery,        setWdQuery]        = useState('')
  const [wdStatusFilter, setWdStatusFilter] = useState<Set<string>>(new Set())
  const [wdSortAsc,      setWdSortAsc]      = useState(false)
  const [wdPage,         setWdPage]         = useState(1)

  function handleWithdraw() {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt < 50 || amt > BALANCE) return
    if (!bankApproved) return
    setWithdrawError(null)
    setWithdrawSuccess(false)
    startWithdraw(async () => {
      const result = await requestWithdrawalAction(amt)
      if (result.error) {
        setWithdrawError(result.error)
      } else {
        setWithdrawSuccess(true)
        setWithdrawAmount('')
        // optimistic: add new pending row to local list
        setWithdrawals(prev => [{
          id: result.withdrawalId ?? crypto.randomUUID(),
          booster_id: '',
          amount: amt,
          payout_details: bankDetails.iban,
          status: 'pending',
          transaction_id: null,
          receipt_url: null,
          notes: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, ...prev])
        router.refresh()
        setTimeout(() => setWithdrawSuccess(false), 6000)
      }
    })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ── Filtered + sorted payments ──────────────────────────────────────────────
  const filteredPay = PAYMENTS
    .filter((p) => {
      if (payStatusFilter.size) {
        const label = p.status === 'paid' ? 'Paid' : 'Pending'
        if (!payStatusFilter.has(label)) return false
      }
      if (payQuery && !p.boost.toLowerCase().includes(payQuery.toLowerCase()) && !p.id.toLowerCase().includes(payQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      return paySortAsc ? cmp : -cmp
    })

  const payTotalPages = Math.max(1, Math.ceil(filteredPay.length / PAGE_SIZE))
  const paySafePage   = Math.min(payPage, payTotalPages)
  const payRows       = filteredPay.slice((paySafePage - 1) * PAGE_SIZE, paySafePage * PAGE_SIZE)

  // ── Filtered + sorted transactions ─────────────────────────────────────────
  const filteredTx = TRANSACTIONS
    .filter((t) => {
      if (txTypeFilter.size) {
        const label = t.type === 'earning' ? 'Earning' : 'Payout'
        if (!txTypeFilter.has(label)) return false
      }
      if (txQuery && !t.description.toLowerCase().includes(txQuery.toLowerCase()) && !t.id.toLowerCase().includes(txQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      return txSortAsc ? cmp : -cmp
    })

  const txTotalPages = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE))
  const txSafePage   = Math.min(txPage, txTotalPages)
  const txRows       = filteredTx.slice((txSafePage - 1) * PAGE_SIZE, txSafePage * PAGE_SIZE)

  function PaginationRow({ safePage, totalPages, setPage }: { safePage: number; totalPages: number; setPage: React.Dispatch<React.SetStateAction<number>> }) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-1">
        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">
          Page {safePage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          {([
            { icon: ChevronFirst, action: () => setPage(1),            disabled: safePage === 1 },
            { icon: ChevronLeft,  action: () => setPage((p) => p - 1), disabled: safePage === 1 },
          ] as const).map(({ icon: Icon, action, disabled }, i) => (
            <button key={i} onClick={action} disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === '…'
              ? <span key={`e-${i}`} className="w-5 text-center font-mono text-[11px] text-[#3a3a3a]">…</span>
              : <button key={p} onClick={() => setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[11px] transition-colors ${safePage === p ? 'border-[#6e6d6f] bg-white/10 text-white' : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'}`}>
                  {p}
                </button>
            )}
          {([
            { icon: ChevronRight, action: () => setPage((p) => p + 1), disabled: safePage === totalPages },
            { icon: ChevronLast,  action: () => setPage(totalPages),   disabled: safePage === totalPages },
          ] as const).map(({ icon: Icon, action, disabled }, i) => (
            <button key={i} onClick={action} disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
              <Icon size={13} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={Wallet}
        title="Wallet"
        subtitle="Manage your earnings and payouts."
      />

      {/* ── Stats row ── */}
      <div className="flex shrink-0 gap-3">
        {[
          { label: 'Available Balance', value: `$${BALANCE.toFixed(2)}`,  accent: 'text-green-400' },
          { label: 'Pending',           value: `$${PENDING.toFixed(2)}`,  accent: 'text-yellow-400' },
          { label: 'Total Paid Out',    value: `$${TOTAL_PAID.toFixed(2)}`, accent: 'text-white' },
          { label: 'Boosts Completed',  value: String(PAYMENTS.filter(p => p.status === 'paid').length), accent: 'text-white' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="flex flex-1 flex-col gap-1 rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">{label}</span>
            <span className={`font-mono text-lg font-semibold tracking-[-0.05em] ${accent}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Info cards row: Bank + Withdrawal ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bank details */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Building2 size={14} strokeWidth={1.5} className="text-[#6e6d6f]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">Payout Method</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'HOLDER NAME', value: BANK.holder },
              { label: 'BANK NAME',   value: BANK.bank   },
              { label: 'BANK SWIFT',  value: BANK.swift  },
              { label: 'IBAN',        value: BANK.iban   },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">{label}</span>
                <span className="font-mono text-[11px] tracking-[-0.04em] text-white truncate">{value}</span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/settings?tab=bank"
            className="self-start flex items-center gap-1.5 font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:text-white"
          >
            <CreditCard size={11} strokeWidth={1.5} />
            Update bank details →
          </Link>
        </div>

        {/* Withdrawal */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight size={14} strokeWidth={1.5} className="text-[#6e6d6f]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">Request Withdrawal</span>
          </div>

          {/* Success banner */}
          {withdrawSuccess && (
            <div className="flex items-center gap-2.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2.5">
              <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 text-green-400" />
              <span className="font-mono text-[11px] tracking-[-0.04em] text-green-400">Withdrawal requested. Balance updated — processed within 1–3 business days.</span>
            </div>
          )}

          {/* Error banner */}
          {withdrawError && (
            <div className="flex items-center gap-2.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <AlertCircle size={13} strokeWidth={2} className="shrink-0 text-red-400" />
              <span className="font-mono text-[11px] tracking-[-0.04em] text-red-400">{withdrawError}</span>
            </div>
          )}

          {/* Bank not approved notice */}
          {!bankApproved && (
            <div className="flex items-start gap-2.5 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
              <AlertCircle size={13} strokeWidth={2} className="shrink-0 mt-px text-yellow-400" />
              <span className="font-mono text-[11px] tracking-[-0.04em] text-yellow-400/80">
                {bankDetails.status === 'under_review'
                  ? 'Your bank details are under review. Withdrawals will be available once approved.'
                  : 'Add your bank details in Settings before requesting a withdrawal.'}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Amount row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">Amount (USD)</label>
                <div className="flex items-center gap-2 h-9 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3">
                  <span className="font-mono text-xs text-[#6e6d6f]">$</span>
                  <input
                    type="number"
                    min={50}
                    max={BALANCE}
                    value={withdrawAmount}
                    onChange={e => { setWithdrawAmount(e.target.value); setWithdrawError(null) }}
                    placeholder="0.00"
                    className="flex-1 bg-transparent font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => setWithdrawAmount(BALANCE.toFixed(2))}
                className="h-9 px-3 rounded-md border border-[#2a2a2a] font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
              >
                Max
              </button>
            </div>

            {/* Payout details removed — IBAN is sourced from approved bank details in profile */}

            {/* Submit */}
            <button
              onClick={handleWithdraw}
              disabled={
                withdrawPending ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) < 50 ||
                parseFloat(withdrawAmount) > BALANCE ||
                !bankApproved
              }
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90 disabled:opacity-30"
            >
              {withdrawPending
                ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /> Processing…</>
                : <><ArrowUpRight size={13} strokeWidth={2} /> Request Withdrawal</>
              }
            </button>
          </div>

          <p className="font-mono text-[10px] tracking-[-0.04em] text-[#3c3c3c]">
            Min. $50 · Processed within 1–3 business days · Balance deducted immediately upon request.
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-px overflow-hidden rounded-md border border-[#2a2a2a] w-fit">
        {(['payments', 'transactions', 'withdrawals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-mono text-[11px] tracking-[-0.05em] capitalize transition-colors ${
              tab === t ? 'bg-white text-black' : 'bg-[#111111] text-[#6e6d6f] hover:text-white'
            }`}
          >
            {t === 'withdrawals' ? `Withdrawals${withdrawals.length ? ` (${withdrawals.length})` : ''}` : t}
          </button>
        ))}
      </div>

      {/* ── Payments tab ── */}
      {tab === 'payments' && (
        <div className="flex flex-col gap-3">
          {/* Controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
              <input
                type="search"
                value={payQuery}
                onChange={(e) => { setPayQuery(e.target.value); setPayPage(1) }}
                placeholder="Search payments…"
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] transition-colors focus:border-[#6e6d6f] focus:outline-none"
              />
            </div>
            <FilterDropdown
              label="Status"
              options={['Paid', 'Pending']}
              selected={payStatusFilter}
              onChange={(v) => { toggleFilter(setPayStatusFilter, v); setPayPage(1) }}
            />
            <button
              onClick={() => { setPaySortAsc((v) => !v); setPayPage(1) }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:text-white"
            >
              <ArrowUpDown size={12} strokeWidth={1.5} />
              Date
              <span className="text-[10px] text-[#4a4a4a]">{paySortAsc ? '↑' : '↓'}</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                    {['PAYMENT ID', 'BOOST', 'AMOUNT', 'STATUS', 'DATE'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">No payments match your filters.</td></tr>
                  ) : payRows.map((p, i) => (
                    <tr key={p.id} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${i === payRows.length - 1 ? 'border-none' : ''}`}>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">{p.id}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs tracking-[-0.05em] text-white">{p.boost}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-white">${p.amount.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${STATUS_BADGE[p.status]}`}>
                          {p.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">{formatDate(p.date)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationRow safePage={paySafePage} totalPages={payTotalPages} setPage={setPayPage} />
        </div>
      )}

      {/* ── Transactions tab ── */}
      {tab === 'transactions' && (
        <div className="flex flex-col gap-3">
          {/* Controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
              <input
                type="search"
                value={txQuery}
                onChange={(e) => { setTxQuery(e.target.value); setTxPage(1) }}
                placeholder="Search transactions…"
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] transition-colors focus:border-[#6e6d6f] focus:outline-none"
              />
            </div>
            <FilterDropdown
              label="Type"
              options={['Earning', 'Payout']}
              selected={txTypeFilter}
              onChange={(v) => { toggleFilter(setTxTypeFilter, v); setTxPage(1) }}
            />
            <button
              onClick={() => { setTxSortAsc((v) => !v); setTxPage(1) }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:text-white"
            >
              <ArrowUpDown size={12} strokeWidth={1.5} />
              Date
              <span className="text-[10px] text-[#4a4a4a]">{txSortAsc ? '↑' : '↓'}</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                    {['TXN ID', 'DESCRIPTION', 'TYPE', 'AMOUNT', 'DATE'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">No transactions match your filters.</td></tr>
                  ) : txRows.map((t, i) => (
                    <tr key={t.id} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${i === txRows.length - 1 ? 'border-none' : ''}`}>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">{t.id}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs tracking-[-0.05em] text-white">{t.description}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${
                          t.type === 'earning'
                            ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                            : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                        }`}>
                          {t.type === 'earning' ? 'Earning' : 'Payout'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-mono text-xs font-semibold tracking-[-0.05em] ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">{formatDate(t.date)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationRow safePage={txSafePage} totalPages={txTotalPages} setPage={setTxPage} />
        </div>
      )}

      {/* ── Withdrawals tab ── */}
      {tab === 'withdrawals' && (
        <div className="flex flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
              <input
                type="search"
                value={wdQuery}
                onChange={(e) => { setWdQuery(e.target.value); setWdPage(1) }}
                placeholder="Search withdrawals…"
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] transition-colors focus:border-[#6e6d6f] focus:outline-none"
              />
            </div>
            <FilterDropdown
              label="Status"
              options={['Pending', 'Approved', 'Rejected']}
              selected={wdStatusFilter}
              onChange={(v) => { toggleFilter(setWdStatusFilter, v); setWdPage(1) }}
            />
            <button
              onClick={() => { setWdSortAsc((v) => !v); setWdPage(1) }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-all hover:border-[#6e6d6f] hover:text-white"
            >
              <ArrowUpDown size={12} strokeWidth={1.5} />
              Date
              <span className="text-[10px] text-[#4a4a4a]">{wdSortAsc ? '↑' : '↓'}</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                    {['WITHDRAWAL ID', 'PAYOUT DESTINATION', 'AMOUNT', 'STATUS', 'DATE'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = withdrawals
                      .filter((w) => {
                        if (wdStatusFilter.size && !wdStatusFilter.has(w.status.charAt(0).toUpperCase() + w.status.slice(1))) return false
                        if (wdQuery) {
                          const q = wdQuery.toLowerCase()
                          if (!w.id.toLowerCase().includes(q) && !(w.payout_details ?? '').toLowerCase().includes(q)) return false
                        }
                        return true
                      })
                      .sort((a, b) => {
                        const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        return wdSortAsc ? cmp : -cmp
                      })
                    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
                    const safePage   = Math.min(wdPage, totalPages)
                    const rows       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
                    return (
                      <>
                        {rows.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-16 text-center font-mono text-xs text-[#4a4a4a]">No withdrawal requests yet.</td></tr>
                        ) : rows.map((w, i) => (
                          <tr key={w.id} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${i === rows.length - 1 ? 'border-none' : ''}`}>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">WD-{w.id.slice(0, 8).toUpperCase()}</span>
                            </td>
                            <td className="px-4 py-3.5 max-w-[220px]">
                              <span className="font-mono text-xs tracking-[-0.05em] text-white truncate block">{w.payout_details ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs font-semibold tracking-[-0.05em] text-red-400">-${w.amount.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${STATUS_BADGE[w.status]}`}>
                                {w.status === 'pending'  && <Clock    size={10} strokeWidth={2} />}
                                {w.status === 'approved' && <CheckCircle2 size={10} strokeWidth={2} />}
                                {w.status === 'rejected' && <XCircle  size={10} strokeWidth={2} />}
                                {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">{formatDate(w.created_at)}</span>
                            </td>
                          </tr>
                        ))}
                        {filtered.length > PAGE_SIZE && (
                          <tr><td colSpan={5} className="px-4 pb-3">
                            <PaginationRow safePage={safePage} totalPages={totalPages} setPage={setWdPage} />
                          </td></tr>
                        )}
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
