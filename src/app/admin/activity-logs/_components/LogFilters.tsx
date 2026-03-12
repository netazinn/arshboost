'use client'

import { useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { DatePickerFilter } from './DatePickerFilter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterValues {
  search: string
  admin:  string
  type:   string
  from:   string
  to:     string
}

interface LogFiltersProps {
  adminOptions: { id: string; label: string }[]
  actionTypes:  string[]
  initial:      FilterValues
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'user.banned':                    'User Banned',
  'user.unbanned':                  'User Unbanned',
  'user.role.changed':              'Role Changed',
  'withdrawal.approved':            'Withdrawal Approved',
  'withdrawal.rejected':            'Withdrawal Rejected',
  'settings.financials.update':     'Financials Updated',
  'settings.operations.update':     'Operations Updated',
  'settings.communications.update': 'Comms Updated',
}
function actionLabel(a: string) { return ACTION_LABELS[a] ?? a }

function buildUrl(values: FilterValues, page?: number): string {
  const qs = new URLSearchParams()
  if (values.search) qs.set('search', values.search)
  if (values.admin)  qs.set('admin',  values.admin)
  if (values.type)   qs.set('type',   values.type)
  if (values.from)   qs.set('from',   values.from)
  if (values.to)     qs.set('to',     values.to)
  if (page && page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return `/admin/activity-logs${s ? `?${s}` : ''}`
}

// ─── Component ────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'h-8 rounded-md border border-[#2a2a2a] bg-[#111111] px-3 font-mono text-[11px] tracking-[-0.04em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] focus:border-[#6e6d6f] focus:text-white focus:outline-none'

export function LogFilters({ adminOptions, actionTypes, initial }: LogFiltersProps) {
  const router = useRouter()
  const [values, setValues]         = useState<FilterValues>(initial)
  const [searchDraft, setSearchDraft] = useState(initial.search)

  function navigate(patch: Partial<FilterValues>) {
    const next = { ...values, ...patch }
    setValues(next)
    router.push(buildUrl(next))
  }

  function submitSearch() {
    navigate({ search: searchDraft })
  }

  function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submitSearch() }
  }

  function clearAll() {
    const empty: FilterValues = { search: '', admin: '', type: '', from: '', to: '' }
    setValues(empty)
    setSearchDraft('')
    router.push('/admin/activity-logs')
  }

  const hasFilters = !!(values.search || values.admin || values.type || values.from || values.to)

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">

      {/* Search — submits on Enter */}
      <form
        onSubmit={(e) => { e.preventDefault(); submitSearch() }}
        className="relative flex-1 min-w-[160px] max-w-[240px]"
      >
        <Search
          size={11}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6d6f] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search target ID…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={handleSearchKey}
          aria-label="Search target ID"
          className={`${INPUT_CLS} pl-7 pr-3 w-full placeholder:text-[#3a3a3a]`}
        />
      </form>

      {/* Admin select */}
      <select
        value={values.admin}
        onChange={(e) => navigate({ admin: e.target.value })}
        aria-label="Filter by admin"
        className={`${INPUT_CLS} appearance-none cursor-pointer pr-3`}
      >
        <option value="">All admins</option>
        {adminOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Action type select */}
      <select
        value={values.type}
        onChange={(e) => navigate({ type: e.target.value })}
        aria-label="Filter by action type"
        className={`${INPUT_CLS} appearance-none cursor-pointer pr-3`}
      >
        <option value="">All actions</option>
        {actionTypes.map((t) => (
          <option key={t} value={t}>
            {actionLabel(t)}
          </option>
        ))}
      </select>

      {/* Date — from */}
      <DatePickerFilter
        value={values.from}
        onChange={(iso) => navigate({ from: iso })}
        placeholder="From date"
        label="From date"
      />

      {/* Date — to */}
      <DatePickerFilter
        value={values.to}
        onChange={(iso) => navigate({ to: iso })}
        placeholder="To date"
        label="To date"
      />

      {/* Clear filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 h-8 px-3 rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white"
        >
          <X size={10} strokeWidth={2} />
          Clear
        </button>
      )}
    </div>
  )
}

// ─── Export URL builder for Server Component pagination use ───────────────────
export { buildUrl }
