'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  User,
  Clock,
} from 'lucide-react'
import { approveBankDetails, markWithdrawalPaid } from '@/lib/actions/admin'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import type { Withdrawal, Profile } from '@/types'

type WithdrawalWithBooster = Withdrawal & { booster: Profile }

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatIban(iban: string | null | undefined) {
  if (!iban) return '—'
  return iban.replace(/(.{4})/g, '$1 ').trim()
}

// ── Withdrawal row ────────────────────────────────────────────────────────────

function WithdrawalRow({
  withdrawal,
  onPaid,
}: {
  withdrawal: WithdrawalWithBooster
  onPaid: (id: string) => void
}) {
  const [pending, startPaid] = useTransition()
  const [error, setError]    = useState<string | null>(null)

  const { booster } = withdrawal

  function handlePaid() {
    setError(null)
    startPaid(async () => {
      const result = await markWithdrawalPaid(withdrawal.id)
      if (result.error) {
        setError(result.error)
      } else {
        onPaid(withdrawal.id)
      }
    })
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-5 flex flex-col gap-4">
      {/* Top row: amount + date */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xl font-semibold tracking-[-0.06em] text-white">
            ${withdrawal.amount.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
            Requested {formatDate(withdrawal.created_at)}
          </span>
        </div>
        <span className="inline-flex items-center rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] text-yellow-400">
          Pending
        </span>
      </div>

      {/* Booster info */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Booster</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">
            {booster.username ?? booster.email}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Holder Name</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{booster.bank_holder_name ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Bank</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{booster.bank_name ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">SWIFT / BIC</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{booster.bank_swift ?? '—'}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">IBAN</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{formatIban(booster.bank_iban)}</span>
        </div>
      </div>

      {/* Payout details on withdrawal row (what was stored at request time) */}
      {withdrawal.payout_details && withdrawal.payout_details !== booster.bank_iban && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Stored Payout Details</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f]">{formatIban(withdrawal.payout_details)}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertCircle size={12} strokeWidth={2} className="shrink-0 text-red-400" />
          <span className="font-mono text-[11px] tracking-[-0.04em] text-red-400">{error}</span>
        </div>
      )}

      <button
        onClick={handlePaid}
        disabled={pending}
        className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-green-500 font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-green-400 disabled:opacity-40"
      >
        {pending
          ? <><Loader2 size={12} strokeWidth={2} className="animate-spin" /> Processing…</>
          : <><CheckCircle2 size={12} strokeWidth={2} /> Mark as Paid</>
        }
      </button>
    </div>
  )
}

// ── Bank review row ───────────────────────────────────────────────────────────

function BankReviewRow({
  profile,
  onApproved,
}: {
  profile: Profile
  onApproved: (id: string) => void
}) {
  const [pending, startApprove] = useTransition()
  const [error, setError]       = useState<string | null>(null)

  function handleApprove() {
    setError(null)
    startApprove(async () => {
      const result = await approveBankDetails(profile.id)
      if (result.error) {
        setError(result.error)
      } else {
        onApproved(profile.id)
      }
    })
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[13px] font-semibold tracking-[-0.05em] text-white">
            {profile.username ?? profile.email}
          </span>
          {profile.bank_details_updated_at && (
            <span className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
              Submitted {formatDate(profile.bank_details_updated_at)}
            </span>
          )}
        </div>
        <span className="inline-flex items-center rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] text-yellow-400">
          Under Review
        </span>
      </div>

      {/* Bank fields */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Holder Name</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{profile.bank_holder_name ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">Bank Name</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{profile.bank_name ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">SWIFT / BIC</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{profile.bank_swift ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">IBAN</span>
          <span className="font-mono text-[11px] tracking-[-0.04em] text-white">{formatIban(profile.bank_iban)}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertCircle size={12} strokeWidth={2} className="shrink-0 text-red-400" />
          <span className="font-mono text-[11px] tracking-[-0.04em] text-red-400">{error}</span>
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={pending}
        className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90 disabled:opacity-40"
      >
        {pending
          ? <><Loader2 size={12} strokeWidth={2} className="animate-spin" /> Approving…</>
          : <><ShieldCheck size={12} strokeWidth={2} /> Approve Bank Details</>
        }
      </button>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#111111] py-16 gap-3">
      <CheckCircle2 size={28} strokeWidth={1} className="text-[#3a3a3a]" />
      <p className="font-mono text-[12px] tracking-[-0.04em] text-[#4a4a4a]">{label}</p>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

type Tab = 'withdrawals' | 'bank-reviews'

export function AdminControlCenter({
  initialWithdrawals,
  initialBankReviews,
}: {
  initialWithdrawals: WithdrawalWithBooster[]
  initialBankReviews: Profile[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('withdrawals')
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals)
  const [bankReviews, setBankReviews] = useState(initialBankReviews)

  function removeWithdrawal(id: string) {
    setWithdrawals(prev => prev.filter(w => w.id !== id))
    router.refresh()
  }

  function removeBankReview(id: string) {
    setBankReviews(prev => prev.filter(p => p.id !== id))
    router.refresh()
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'withdrawals',  label: 'Pending Withdrawals', icon: ArrowUpRight, count: withdrawals.length },
    { id: 'bank-reviews', label: 'Bank Detail Reviews', icon: ShieldCheck,  count: bankReviews.length  },
  ]

  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={Building2}
        title="Withdrawal Management"
        subtitle="Manage pending withdrawals and bank detail approvals."
      />

      {/* Stats row */}
      <div className="flex shrink-0 gap-3">
        {[
          { label: 'Pending Withdrawals', value: withdrawals.length, accent: 'text-yellow-400' },
          { label: 'Bank Detail Reviews', value: bankReviews.length, accent: 'text-yellow-400' },
          {
            label: 'Total Pending Amount',
            value: `$${withdrawals.reduce((s, w) => s + w.amount, 0).toFixed(2)}`,
            accent: 'text-white',
          },
        ].map(({ label, value, accent }) => (
          <div key={label} className="flex flex-1 flex-col gap-1 rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">{label}</span>
            <span className={`font-mono text-lg font-semibold tracking-[-0.05em] ${accent}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-px overflow-hidden rounded-md border border-[#2a2a2a] w-fit">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] tracking-[-0.05em] transition-colors ${
              tab === id ? 'bg-white text-black' : 'bg-[#111111] text-[#6e6d6f] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Icon size={12} strokeWidth={1.5} className="shrink-0" />
            {label}
            {count > 0 && (
              <span className={`flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                tab === id ? 'bg-black text-white' : 'bg-yellow-500 text-black'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'withdrawals' && (
        <>
          {withdrawals.length === 0 ? (
            <EmptyState label="No pending withdrawals. All clear!" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {withdrawals.map(w => (
                <WithdrawalRow key={w.id} withdrawal={w} onPaid={removeWithdrawal} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'bank-reviews' && (
        <>
          {bankReviews.length === 0 ? (
            <EmptyState label="No bank details pending review." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {bankReviews.map(p => (
                <BankReviewRow key={p.id} profile={p} onApproved={removeBankReview} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
