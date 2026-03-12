'use client'

import { useState, useTransition } from 'react'
import { updateOperationalSettings } from '@/lib/actions/admin'

// ─── Inline Toast ─────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] rounded-lg border px-4 py-3 font-mono text-[11px] tracking-[-0.04em] shadow-2xl ${
        type === 'success'
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-white cursor-pointer">
          {label}
        </label>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
          {description}
        </p>
      </div>
      {/* Custom toggle */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          checked
            ? danger
              ? 'border-red-500/60 bg-red-500/20'
              : 'border-white/30 bg-white/15'
            : 'border-[#2a2a2a] bg-[#111]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-lg transition-transform duration-200 ${
            checked
              ? danger
                ? 'translate-x-5 bg-red-400'
                : 'translate-x-5 bg-white'
              : 'translate-x-0.5 bg-[#444]'
          } mt-0.5`}
        />
      </button>
    </div>
  )
}

// ─── Number field ─────────────────────────────────────────────────────────────

function TimerField({
  id,
  label,
  description,
  value,
  onChange,
  min,
}: {
  id: string
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  min?: number
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-white">
          {label}
        </label>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
          {description}
        </p>
      </div>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min ?? 0}
        step="1"
        className="h-9 w-full sm:w-28 rounded-md border border-[#2a2a2a] bg-[#111] px-3 font-mono text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none focus:ring-0 transition-colors"
      />
    </div>
  )
}

// ─── Operations Form ──────────────────────────────────────────────────────────

interface OperationsFormProps {
  initialMaintenanceMode: boolean
  initialHaltOrders: boolean
  initialAutoCompleteHours: number
  initialAutoCancelHours: number
  initialIbanCooldownDays: number
}

export function OperationsForm({
  initialMaintenanceMode,
  initialHaltOrders,
  initialAutoCompleteHours,
  initialAutoCancelHours,
  initialIbanCooldownDays,
}: OperationsFormProps) {
  const [maintenanceMode, setMaintenanceMode] = useState(initialMaintenanceMode)
  const [haltOrders,      setHaltOrders]      = useState(initialHaltOrders)
  const [autoComplete,    setAutoComplete]    = useState(String(initialAutoCompleteHours))
  const [autoCancel,      setAutoCancel]      = useState(String(initialAutoCancelHours))
  const [ibanCooldown,    setIbanCooldown]    = useState(String(initialIbanCooldownDays))
  const [toast,           setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending,       startTransition]    = useTransition()

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const autoCompleteVal = parseInt(autoComplete, 10)
    const autoCancelVal   = parseInt(autoCancel, 10)
    const ibanVal         = parseInt(ibanCooldown, 10)

    if (!Number.isInteger(autoCompleteVal) || autoCompleteVal < 1)
      return showToast('Auto-complete hours must be a whole number ≥ 1.', 'error')
    if (!Number.isInteger(autoCancelVal) || autoCancelVal < 1)
      return showToast('Auto-cancel hours must be a whole number ≥ 1.', 'error')
    if (!Number.isInteger(ibanVal) || ibanVal < 0)
      return showToast('IBAN cooldown must be a whole number ≥ 0.', 'error')

    startTransition(async () => {
      const result = await updateOperationalSettings({
        is_maintenance_mode:        maintenanceMode,
        halt_new_orders:            haltOrders,
        auto_complete_hours:        autoCompleteVal,
        auto_cancel_hours:          autoCancelVal,
        iban_cooldown_days:         ibanVal,
      })
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        showToast('Operational settings saved.', 'success')
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-0 divide-y divide-[#1a1a1a]">

        {/* ── Emergency Controls ── */}
        <div className="pb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase">
              Emergency Controls
            </span>
          </div>
          <div className="flex flex-col gap-5">
            <ToggleRow
              id="is_maintenance_mode"
              label="Maintenance Mode"
              description="Puts the platform in read-only/maintenance mode for users."
              checked={maintenanceMode}
              onChange={setMaintenanceMode}
              danger
            />
            <ToggleRow
              id="halt_new_orders"
              label="Halt New Orders"
              description="Prevents clients from creating new orders."
              checked={haltOrders}
              onChange={setHaltOrders}
              danger
            />
          </div>
        </div>

        {/* ── Platform Timers ── */}
        <div className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase">
              Platform Timers
            </span>
          </div>
          <div className="flex flex-col gap-5">
            <TimerField
              id="auto_complete_hours"
              label="Auto-Complete Order (Hours)"
              description="Time before a completed order is auto-approved if the client doesn't dispute."
              value={autoComplete}
              onChange={setAutoComplete}
              min={1}
            />
            <TimerField
              id="auto_cancel_hours"
              label="Auto-Cancel Unpaid/Waiting Orders (Hours)"
              description="Time before an inactive pending order is cancelled."
              value={autoCancel}
              onChange={setAutoCancel}
              min={1}
            />
            <TimerField
              id="iban_cooldown_days"
              label="IBAN Change Cooldown (Days)"
              description="Days a booster must wait before changing their bank details again."
              value={ibanCooldown}
              onChange={setIbanCooldown}
              min={0}
            />
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-md bg-white px-5 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  )
}
