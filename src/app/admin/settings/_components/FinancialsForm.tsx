'use client'

import { useState, useTransition } from 'react'
import { updateFinancialSettings } from '@/lib/actions/admin'

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

// ─── Field ────────────────────────────────────────────────────────────────────

function SettingField({
  label,
  description,
  id,
  value,
  onChange,
  min,
  step,
}: {
  label: string
  description: string
  id: string
  value: string
  onChange: (v: string) => void
  min?: number
  step?: string
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
        min={min}
        step={step ?? '0.01'}
        className="h-9 w-full sm:w-36 rounded-md border border-[#2a2a2a] bg-[#111] px-3 font-mono text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none focus:ring-0 transition-colors"
      />
    </div>
  )
}

// ─── Financials Form ──────────────────────────────────────────────────────────

interface FinancialsFormProps {
  initialFee: number
  initialMinWithdrawal: number
  initialDuoMultiplier: number
}

export function FinancialsForm({
  initialFee,
  initialMinWithdrawal,
  initialDuoMultiplier,
}: FinancialsFormProps) {
  const [fee,        setFee]        = useState(String(initialFee))
  const [minWith,    setMinWith]    = useState(String(initialMinWithdrawal))
  const [duoMult,    setDuoMult]    = useState(String(initialDuoMultiplier))
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending,  startTransition] = useTransition()

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const feeVal  = parseFloat(fee)
    const minVal  = parseFloat(minWith)
    const duoVal  = parseFloat(duoMult)

    if (isNaN(feeVal) || feeVal < 0)   return showToast('Platform fee must be ≥ 0.', 'error')
    if (isNaN(minVal) || minVal < 0)   return showToast('Min withdrawal must be ≥ 0.', 'error')
    if (isNaN(duoVal) || duoVal < 1)   return showToast('Duo multiplier must be ≥ 1.', 'error')

    startTransition(async () => {
      const result = await updateFinancialSettings({
        flat_platform_fee:     feeVal,
        min_withdrawal_amount: minVal,
        duo_boost_multiplier:  duoVal,
      })
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        showToast('Financial settings saved.', 'success')
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <SettingField
          id="flat_platform_fee"
          label="Platform Flat Fee ($/€)"
          description="Fixed amount deducted from every order as the platform commission."
          value={fee}
          onChange={setFee}
          min={0}
        />

        <div className="border-t border-[#1a1a1a]" />

        <SettingField
          id="min_withdrawal_amount"
          label="Min. Withdrawal ($/€)"
          description="Smallest withdrawal amount a booster can request at one time."
          value={minWith}
          onChange={setMinWith}
          min={0}
        />

        <div className="border-t border-[#1a1a1a]" />

        <SettingField
          id="duo_boost_multiplier"
          label="Duo Boost Multiplier"
          description="Total price is multiplied by this factor when the duo option is selected."
          value={duoMult}
          onChange={setDuoMult}
          min={1}
          step="0.01"
        />

        <div className="flex justify-end pt-2">
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
