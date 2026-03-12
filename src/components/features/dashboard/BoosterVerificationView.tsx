'use client'

import Image from 'next/image'
import { useState, useEffect, useTransition } from 'react'
import {
  ShieldCheck, Building2, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { IDVerificationWizard } from '@/components/features/dashboard/IDVerificationWizard'
import { saveBankDetailsAction } from '@/lib/actions/profile'
import { getMyVerification } from '@/lib/actions/verification'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import type { VerificationRecord } from '@/lib/actions/verification'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">{title}</h2>
      {subtitle && <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Bank Confirm Dialog ─────────────────────────────────────────────────────────

function BankConfirmDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} strokeWidth={1.5} className="shrink-0 mt-0.5 text-yellow-400" />
          <div>
            <h3 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">Update Bank Details?</h3>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
              Are you sure you want to update your bank details? They will be placed{' '}
              <span className="text-yellow-400">under review</span> and you won't be able to change them again for{' '}
              <span className="text-white font-semibold">30 days</span>.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-md border border-[#2a2a2a] font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ID Verification + Discord section ──────────────────────────────────────────

function VerificationSection() {
  const [record,              setRecord]              = useState<VerificationRecord | null | undefined>(undefined)
  const [showIDWizard,        setShowIDWizard]        = useState(false)
  const [discordOAuthLoading, setDiscordOAuthLoading] = useState(false)
  const [discordToast,        setDiscordToast]        = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    getMyVerification().then(setRecord)
    const params = new URLSearchParams(window.location.search)
    const ds = params.get('discord')
    if (ds) {
      window.history.replaceState({}, '', '/dashboard/verification')
      if (ds === 'connected') {
        setDiscordToast({ type: 'success', message: 'Discord connected successfully!' })
        setTimeout(() => setDiscordToast(null), 4000)
      } else if (ds === 'error') {
        const reason = params.get('reason') ?? 'unknown error'
        const message = reason === 'access_denied'
          ? 'Connection cancelled.'
          : `Connection failed (${reason}). Please try again.`
        setDiscordToast({ type: 'error', message })
        setTimeout(() => setDiscordToast(null), 6000)
      }
    }
  }, [])

  const status        = record?.verification_status ?? 'start_verification'
  const discordLinked = !!(record?.discord_unique_id)
  const idSubmitted   = ['under_review', 'approved', 'declined'].includes(status)

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    start_verification: { label: 'Not Started',  cls: 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]' },
    under_review:       { label: 'Under Review', cls: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' },
    approved:           { label: 'Approved',     cls: 'border-green-500/20 bg-green-500/10 text-green-400' },
    declined:           { label: 'Declined',     cls: 'border-red-500/20 bg-red-500/10 text-red-400' },
  }
  const badge = STATUS_BADGE[status]

  async function connectDiscord() {
    setDiscordOAuthLoading(true)
    setDiscordToast(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        scopes: 'identify',
        redirectTo: `${window.location.origin}/auth/callback/discord`,
      },
    })
    if (error) {
      setDiscordOAuthLoading(false)
      setDiscordToast({ type: 'error', message: error.message })
      return
    }
    if (data.url) window.location.href = data.url
    else setDiscordOAuthLoading(false)
  }

  return (
    <>
      {showIDWizard && (
        <IDVerificationWizard
          onClose={() => setShowIDWizard(false)}
          onSuccess={(r) => { setRecord(r as VerificationRecord); setShowIDWizard(false) }}
        />
      )}

      <div className="grid grid-cols-2 gap-6 items-stretch">
        {/* ID Verification Card */}
        <div className="h-full rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">ID Verification</h2>
              <p className="mt-0.5 font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Verify your identity to unlock full payout capabilities.</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          <div className="mb-5 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
            <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
              To protect our platform and ensure secure payouts, we require identity verification.
              Your documents are encrypted and used{' '}
              <span className="text-white">strictly</span> for compliance and payout security.
            </p>
          </div>

          {record === undefined ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-[#4a4a4a]" />
              <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">Loading...</span>
            </div>
          ) : idSubmitted && record ? (
            <div className="flex flex-col gap-3">
              {[
                { label: 'Government ID', value: record.id_serial_number ? `${record.id_type === 'passport' ? 'Passport' : 'National ID'} · ${record.id_serial_number}` : null },
                { label: 'Selfie with ID', value: record.id_selfie_url ? 'Uploaded' : null },
                { label: 'Proof of Address', value: record.proof_of_address_url ? 'Uploaded' : null },
              ].map(item => (
                <div key={item.label} className={`flex items-center gap-3 rounded-md border px-4 py-3 ${item.value ? 'border-green-500/20 bg-green-500/5' : 'border-[#2a2a2a] bg-[#0d0d0d]'}`}>
                  <CheckCircle2 size={14} strokeWidth={1.5} className={item.value ? 'shrink-0 text-green-400' : 'shrink-0 text-[#2a2a2a]'} />
                  <div className="flex-1">
                    <p className="font-mono text-[11px] tracking-[-0.05em] text-white">{item.label}</p>
                    <p className={`mt-0.5 font-mono text-[9px] tracking-[-0.04em] ${item.value ? 'text-green-400' : 'text-[#4a4a4a]'}`}>{item.value ?? 'Not submitted'}</p>
                  </div>
                </div>
              ))}
              {status === 'declined' && (
                <button
                  onClick={() => setShowIDWizard(true)}
                  className="mt-2 h-9 w-full rounded-md border border-[#2a2a2a] font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f] transition-colors hover:border-white/20 hover:text-white"
                >
                  Resubmit Documents
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowIDWizard(true)}
              className="flex h-9 w-full items-center justify-center rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90"
            >
              Start Verification
            </button>
          )}
        </div>

        {/* Discord Card */}
        <div className="h-full rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
          <SectionHeading title="Discord Account" subtitle="Link your primary Discord to verify your identity." />

          <div className={`flex items-center justify-between gap-4 rounded-md border px-4 py-3 ${discordLinked ? 'border-green-500/20 bg-green-500/5' : 'border-[#2a2a2a] bg-[#0d0d0d]'}`}>
            <div className="flex items-center gap-3">
              {discordLinked && record?.discord_avatar_url ? (
                <Image
                  src={record.discord_avatar_url}
                  alt={record.discord_username ?? 'Discord'}
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[#5865F2]/30"
                />
              ) : (
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${discordLinked ? 'bg-[#5865F2]/20 text-[#5865F2]' : 'bg-[#1a1a1a] text-[#6e6d6f]'}`}>
                  D
                </div>
              )}
              <div>
                <p className="font-mono text-[11px] tracking-[-0.05em] text-white">Discord</p>
                {discordLinked ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 size={10} strokeWidth={2} className="text-green-400" />
                    <p className="font-mono text-[10px] tracking-[-0.04em] text-green-400">Connected as {record?.discord_username}</p>
                  </div>
                ) : (
                  <p className="mt-0.5 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">Not connected</p>
                )}
              </div>
            </div>
            <button
              disabled={discordLinked || discordOAuthLoading}
              onClick={connectDiscord}
              className="flex h-7 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {discordOAuthLoading && <Loader2 size={10} strokeWidth={2} className="animate-spin" />}
              {discordLinked ? 'Connected' : discordOAuthLoading ? 'Redirecting…' : 'Connect Discord'}
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0 text-yellow-400" />
            <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-yellow-400/80">
              You must connect your <span className="font-semibold text-yellow-400">primary</span> Discord account. This can only be linked{' '}
              <span className="font-semibold text-yellow-400">ONCE</span> and cannot be changed later.
            </p>
          </div>

          {discordToast && (
            <div className={`mt-2 flex items-start gap-2 rounded-md border px-4 py-3 ${
              discordToast.type === 'success'
                ? 'border-green-500/20 bg-green-500/5'
                : 'border-red-500/20 bg-red-500/5'
            }`}>
              {discordToast.type === 'success' ? (
                <CheckCircle2 size={12} strokeWidth={1.5} className="mt-px shrink-0 text-green-400" />
              ) : (
                <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0 text-red-400" />
              )}
              <p className={`font-mono text-[10px] leading-relaxed tracking-[-0.04em] ${
                discordToast.type === 'success' ? 'text-green-400/80' : 'text-red-400/80'
              }`}>
                {discordToast.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Bank Details section ────────────────────────────────────────────────────────

function BankSection({ profile }: { profile?: Profile }) {
  const status      = profile?.bank_details_status ?? 'none'
  const lastUpdated = profile?.bank_details_updated_at ?? null

  // ── KYC verification status ──────────────────────────────────────────────
  const [kycStatus,    setKycStatus]    = useState<string | null | undefined>(undefined)
  const [verifiedName, setVerifiedName] = useState<string>('')

  useEffect(() => {
    getMyVerification().then((r) => {
      setKycStatus(r?.verification_status ?? null)
      if (r?.verification_status === 'approved') {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').toUpperCase()
        setVerifiedName(name)
      }
    })
  }, [])

  const kycApproved = kycStatus === 'approved'

  // ── 30-day lockout check ─────────────────────────────────────────────────
  const daysLeft = (() => {
    if (status === 'none') return 0
    if (!lastUpdated) return 0
    const daysSince = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince < 30 ? Math.ceil(30 - daysSince) : 0
  })()

  const isTimeLocked = daysLeft > 0

  const [bank,  setBank]  = useState(profile?.bank_name  ?? '')
  const [swift, setSwift] = useState(profile?.bank_swift ?? '')
  const [iban,  setIban]  = useState(profile?.bank_iban  ?? '')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)
  const [pending,    startSave]     = useTransition()

  function handleConfirm() {
    setDialogOpen(false)
    setError(null)
    setSuccess(false)
    startSave(async () => {
      const result = await saveBankDetailsAction({
        bank_name:  bank,
        bank_swift: swift,
        bank_iban:  iban.replace(/\s/g, ''),
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  const statusBadge = {
    none:         { label: 'Not Set',      cls: 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]' },
    under_review: { label: 'Under Review', cls: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' },
    approved:     { label: 'Approved',     cls: 'border-green-500/20 bg-green-500/10 text-green-400' },
  }[status] ?? { label: 'Not Set', cls: 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]' }

  const canSubmit = kycApproved && !isTimeLocked && bank.trim() && swift.trim() && iban.trim()

  const KYC_WALL_TEXT: Record<string, { icon: React.ReactNode; text: string; cls: string }> = {
    start_verification: {
      icon: <ShieldCheck size={28} strokeWidth={1.2} className="text-[#4a4a4a]" />,
      text: 'You must complete and receive approval for Identity Verification before adding payout methods.',
      cls:  'border-[#2a2a2a] bg-[#0a0a0a] text-[#6e6d6f]',
    },
    under_review: {
      icon: <ShieldCheck size={28} strokeWidth={1.2} className="text-yellow-400/60" />,
      text: 'Your identity verification is currently under review. Bank details will unlock once approved.',
      cls:  'border-yellow-500/20 bg-yellow-500/5 text-yellow-400/80',
    },
    declined: {
      icon: <ShieldCheck size={28} strokeWidth={1.2} className="text-red-400/60" />,
      text: 'Your identity verification was declined. Please resubmit your documents using the section above.',
      cls:  'border-red-500/20 bg-red-500/5 text-red-400/80',
    },
  }

  return (
    <>
      <BankConfirmDialog open={dialogOpen} onCancel={() => setDialogOpen(false)} onConfirm={handleConfirm} />

      <div className="w-full rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
        {/* Header row with status badge */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">Bank Details</h2>
            <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] mt-0.5">Your payout destination. Used for all withdrawal requests.</p>
          </div>
          <span className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* KYC loading skeleton */}
        {kycStatus === undefined && (
          <div className="flex items-center gap-2 py-6">
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-[#4a4a4a]" />
            <span className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a]">Checking verification status…</span>
          </div>
        )}

        {/* KYC locked wall */}
        {kycStatus !== undefined && !kycApproved && (() => {
          const wall = KYC_WALL_TEXT[kycStatus ?? 'start_verification'] ?? KYC_WALL_TEXT['start_verification']
          return (
            <div className={`flex flex-col items-center gap-4 rounded-xl border py-10 px-6 text-center ${wall.cls}`}>
              {wall.icon}
              <div>
                <p className="font-mono text-[12px] font-semibold tracking-[-0.05em] text-white mb-1">
                  🔒 Bank details are locked.
                </p>
                <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em]">{wall.text}</p>
              </div>
            </div>
          )
        })()}

        {/* Form — only shown when KYC approved */}
        {kycApproved && (
          <>
            {error && (
              <div className="mb-4 flex items-center gap-2.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 text-red-400" />
                <span className="font-mono text-[11px] tracking-[-0.04em] text-red-400">{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-center gap-2.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2.5">
                <CheckCircle2 size={12} strokeWidth={2} className="shrink-0 text-green-400" />
                <span className="font-mono text-[11px] tracking-[-0.04em] text-green-400">
                  {status === 'none' ? 'Bank details saved and approved.' : 'Submitted for review.'}
                </span>
              </div>
            )}

            {isTimeLocked && (
              <div className="mb-4 flex items-center gap-2.5 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 text-yellow-400" />
                <span className="font-mono text-[11px] tracking-[-0.04em] text-yellow-400/80">
                  Bank details are locked for editing. {daysLeft} day(s) remaining before next update.
                </span>
              </div>
            )}

            <div className="grid gap-6 grid-cols-2">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                  Account Holder Name
                </label>
                <div className="relative">
                  <input
                    value={verifiedName || profile?.bank_holder_name?.toUpperCase() || ''}
                    readOnly
                    className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none opacity-60 cursor-not-allowed"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <ShieldCheck size={12} strokeWidth={1.5} className="text-green-400" />
                  </div>
                </div>
                <p className="font-mono text-[9px] tracking-[-0.02em] text-[#4a4a4a]">
                  Name locked to your verified ID. Payouts must go to an account under this exact name.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Bank Name</label>
                <input
                  value={bank}
                  onChange={e => setBank(e.target.value.toUpperCase())}
                  disabled={isTimeLocked}
                  className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">SWIFT / BIC</label>
                <input
                  value={swift}
                  onChange={e => setSwift(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                  disabled={isTimeLocked}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">IBAN</label>
                <input
                  value={iban}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^A-Z0-9]/ig, '').toUpperCase().slice(0, 34)
                    setIban(raw.replace(/(.{4})/g, '$1 ').trim())
                  }}
                  disabled={isTimeLocked}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                {status === 'none'
                  ? 'First submission is auto-approved.'
                  : 'Updates require review and are locked for 30 days.'}
              </p>
              <button
                onClick={() => (status === 'none' ? handleConfirm() : setDialogOpen(true))}
                disabled={!canSubmit || pending}
                className="flex items-center gap-1.5 h-9 px-5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {pending && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
                {status === 'none' ? 'Save Bank Details' : 'Update Bank Details'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────────

export function BoosterVerificationView({ profile }: { profile?: Profile }) {
  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={ShieldCheck}
        title="Verification"
        subtitle="Complete identity verification and set up your bank payout details."
      />
      <VerificationSection />
      <BankSection profile={profile} />
    </main>
  )
}
