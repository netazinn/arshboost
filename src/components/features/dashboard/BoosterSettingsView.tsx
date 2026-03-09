'use client'

import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import {
  User, Bell, ShieldCheck, Building2,
  Monitor, Smartphone, LogOut, Pen, Eye, EyeOff,
  Settings, CheckCircle2, ChevronDown, Globe, AlertTriangle,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import type { Profile } from '@/types'

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',      label: 'General',        icon: User        },
  { id: 'notifications',label: 'Notifications',  icon: Bell        },
  { id: 'verification', label: 'ID Verification',icon: ShieldCheck },
  { id: 'bank',         label: 'Bank Details',   icon: Building2   },
] as const

type TabId = typeof TABS[number]['id']

// ── Language data ──────────────────────────────────────────────────────────────

const ALL_LANGUAGES = [
  { code: 'en', label: 'English',    flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'tr', label: 'Turkish',    flagUrl: 'https://flagcdn.com/w40/tr.png' },
  { code: 'de', label: 'German',     flagUrl: 'https://flagcdn.com/w40/de.png' },
  { code: 'fr', label: 'French',     flagUrl: 'https://flagcdn.com/w40/fr.png' },
  { code: 'es', label: 'Spanish',    flagUrl: 'https://flagcdn.com/w40/es.png' },
  { code: 'pt', label: 'Portuguese', flagUrl: 'https://flagcdn.com/w40/pt.png' },
  { code: 'it', label: 'Italian',    flagUrl: 'https://flagcdn.com/w40/it.png' },
  { code: 'nl', label: 'Dutch',      flagUrl: 'https://flagcdn.com/w40/nl.png' },
  { code: 'pl', label: 'Polish',     flagUrl: 'https://flagcdn.com/w40/pl.png' },
  { code: 'ru', label: 'Russian',    flagUrl: 'https://flagcdn.com/w40/ru.png' },
]

// ── Reusable sub-components ────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">{title}</h2>
      {subtitle && <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] mt-0.5">{subtitle}</p>}
    </div>
  )
}

function FieldWrapper({ label, helper, children }: { label: string; helper?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">{label}</label>
      {children}
      {helper && <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">{helper}</p>}
    </div>
  )
}

function Toggle({ label, description, defaultOn = false }: { label: string; description?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-none">
      <div>
        <p className="font-mono text-[11px] tracking-[-0.05em] text-white">{label}</p>
        {description && <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => setOn(v => !v)}
        className={`shrink-0 relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-white' : 'bg-[#2a2a2a]'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full shadow transition-transform ${on ? 'translate-x-4 bg-black' : 'translate-x-0 bg-[#6e6d6f]'}`} />
      </button>
    </div>
  )
}

// ── Language Popover ──────────────────────────────────────────────────────────

function LanguageSelector({ selected, onChange }: { selected: string[]; onChange: (codes: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const MAX = 5

  useEffect(() => {
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code))
    } else if (selected.length < MAX) {
      onChange([...selected, code])
    }
  }

  const selectedLangs = ALL_LANGUAGES.filter(l => selected.includes(l.code))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Overlapping flag avatars */}
        {selectedLangs.length > 0 && (
          <div className="flex">
            {selectedLangs.map((l, i) => (
              <div
                key={l.code}
                title={l.label}
                style={{ zIndex: i }}
                className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/30 ring-2 ring-[#111111] ${i > 0 ? '-ml-2' : ''}`}
              >
                <Image src={l.flagUrl} alt={l.label} fill className="object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Trigger button */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
          >
            <Globe size={11} strokeWidth={1.5} />
            Select Languages
            <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-52 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] py-1.5 shadow-2xl">
              <p className="px-4 pb-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[#4a4a4a]">
                {selected.length}/{MAX} selected
              </p>
              {ALL_LANGUAGES.map(l => {
                const isSelected = selected.includes(l.code)
                const isDisabled = !isSelected && selected.length >= MAX
                return (
                  <button
                    key={l.code}
                    onClick={() => toggle(l.code)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 font-mono text-xs tracking-[-0.05em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      isSelected ? 'bg-white/5 text-white' : 'text-[#9ca3af] hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    <div className="relative h-4 w-6 shrink-0 overflow-hidden rounded-sm">
                      <Image src={l.flagUrl} alt={l.label} fill className="object-cover" />
                    </div>
                    {l.label}
                    {isSelected && <CheckCircle2 size={11} strokeWidth={2} className="ml-auto text-green-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">Up to {MAX} languages. Select the languages you can communicate in while boosting.</p>
    </div>
  )
}

// ── Bank Confirm Dialog ────────────────────────────────────────────────────────

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

// ── Reset Password Card ───────────────────────────────────────────────────────

function ResetPasswordCard() {
  const [current, setCurrent]   = useState('')
  const [next,    setNext]      = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext,    setShowNext]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm

  function PasswordInput({ value, onChange, show, onToggle, placeholder }: {
    value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string
  }) {
    return (
      <div className="flex items-center gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          className="h-9 flex-1 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none focus:border-[#6e6d6f] transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
        >
          {show ? <EyeOff size={12} strokeWidth={1.5} /> : <Eye size={12} strokeWidth={1.5} />}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7 flex flex-col">
      <SectionHeading title="Reset Password" subtitle="Change your login password." />
      <div className="flex flex-col gap-6 w-1/2">
        <FieldWrapper label="Current Password">
          <PasswordInput value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
        </FieldWrapper>
        <FieldWrapper label="New Password">
          <PasswordInput value={next} onChange={setNext} show={showNext} onToggle={() => setShowNext(v => !v)} />
        </FieldWrapper>
        <FieldWrapper label="Confirm New Password" helper={mismatch ? <span className="text-red-400">Passwords do not match.</span> : undefined}>
          <PasswordInput value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
        </FieldWrapper>
      </div>
      <div className="mt-auto pt-7 flex justify-end">
        <button
          disabled={!current || !next || !confirm || mismatch}
          className="h-9 px-5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Update Password
        </button>
      </div>
    </div>
  )
}

// ── Tab content ────────────────────────────────────────────────────────────────

function GeneralTab({ profile }: { profile?: Profile }) {
  const ASSIGNED_GAMES = ['Valorant']
  const [selectedLangs, setSelectedLangs] = useState(['en', 'tr'])
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [phone, setPhone] = useState('')

  const SESSIONS: { id: string; ip: string; device: string; icon: React.ElementType; current: boolean }[] = []

  return (
    <div className="flex flex-col gap-6">
      {/* User Information + Reset Password — side by side */}
      <div className="grid grid-cols-2 gap-6 items-stretch">

        {/* User Information */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7 flex flex-col">
          <SectionHeading title="User Information" subtitle="Basic account details visible to internal systems." />
          <div className="grid gap-6 grid-cols-2">

            {/* Username */}
            <FieldWrapper label="Username" helper="You can change your username once every 90 days.">
              <input
              defaultValue={profile?.username ?? ''}
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors"
              />
            </FieldWrapper>

            {/* User-ID */}
            <FieldWrapper label="User-ID" helper="Unique identifier. Cannot be changed.">
              <input
                value={profile?.id ?? ''}
                disabled
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none opacity-40 cursor-not-allowed"
              />
            </FieldWrapper>

            {/* Email */}
            <FieldWrapper label="Email Address">
              <input
                value={profile?.email ?? ''}
                disabled
                className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none opacity-40 cursor-not-allowed"
              />
              <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                To change your email, you must{' '}
                <button className="text-[#6e6d6f] underline underline-offset-2 hover:text-white transition-colors">contact support</button>.
              </p>
            </FieldWrapper>

            {/* Phone */}
            <FieldWrapper label="Phone Number" helper="Editable once every 90 days.">
              <div className="flex items-center gap-2">
                <input
                  value={phone}
                  disabled={!phoneEditing}
                  onChange={e => setPhone(e.target.value)}
                  className={`h-9 flex-1 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors ${!phoneEditing ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
                <button
                  onClick={() => setPhoneEditing(v => !v)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${phoneEditing ? 'border-[#6e6d6f] text-white' : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'}`}
                >
                  <Pen size={12} strokeWidth={1.5} />
                </button>
              </div>
            </FieldWrapper>

          </div>

          <div className="mt-auto pt-7 flex justify-end">
            <button className="h-9 px-5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-opacity">
              Save Changes
            </button>
          </div>
        </div>

        {/* Reset Password */}
        <ResetPasswordCard />

      </div>{/* end grid */}

      {/* Languages & Games + Login Sessions — side by side */}
      <div className="grid grid-cols-2 gap-6 items-stretch">

        {/* Languages & Games */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
          <SectionHeading title="Languages & Games" subtitle="Languages you communicate in and games you are assigned to." />
        <div className="flex flex-col gap-5">
          {/* Languages */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Languages</label>
            <LanguageSelector selected={selectedLangs} onChange={setSelectedLangs} />
          </div>

          {/* Games */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Games</label>
            <div className="flex flex-wrap gap-2">
              {ASSIGNED_GAMES.map(g => (
                <div key={g} className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]">
                  <Image src="/icons/valorant.png" alt={g} fill className="object-cover" />
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
              Assigned by administration.{' '}
              <button className="text-[#6e6d6f] underline underline-offset-2 hover:text-white transition-colors">Contact support</button>{' '}
              to request access to more games.
            </p>
          </div>
        </div>
      </div>

      {/* Login Sessions */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7 flex flex-col">
        <div className="flex items-start justify-between mb-5">
          <SectionHeading title="Login Sessions" subtitle="Active sessions across all your devices." />
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-red-500/30 bg-red-500/10 font-mono text-[10px] tracking-[-0.04em] text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
            <LogOut size={11} strokeWidth={1.5} />
            Logout All Devices
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {SESSIONS.map(s => {
            const DeviceIcon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
                <DeviceIcon size={16} strokeWidth={1.5} className="shrink-0 text-[#6e6d6f]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[11px] tracking-[-0.05em] text-white">{s.device}</p>
                    {s.current && (
                      <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-1.5 py-px font-mono text-[9px] text-green-400">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] mt-0.5">{s.ip}</p>
                </div>
                {!s.current && (
                  <button className="h-7 px-2.5 rounded-md border border-[#2a2a2a] font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] hover:border-red-500/30 hover:text-red-400 transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* end grid */}
    </div>
  )
}

function NotificationsTab() {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
      <SectionHeading title="Notifications" subtitle="Choose which events should notify you." />
      <Toggle label="New boost available"        description="Get notified when a new order matching your games is listed." defaultOn />
      <Toggle label="Order claimed confirmation"  description="Receive a confirmation when you claim an order." defaultOn />
      <Toggle label="Client message"             description="Push notification when the client sends you a message." defaultOn />
      <Toggle label="Payout processed"           description="Get notified when your withdrawal has been sent." defaultOn />
      <Toggle label="System announcements"       description="Platform updates, maintenance notices, and policy changes." defaultOn={false} />
      <Toggle label="Marketing emails"           description="Tips, promotions, and platform highlights." defaultOn={false} />
    </div>
  )
}

function VerificationTab() {
  // Mock: Discord already connected and locked
  const DISCORD_CONNECTED = true
  const DISCORD_HANDLE    = 'booster#1234'

  return (
    <div className="grid grid-cols-2 gap-6 items-stretch">
      {/* ID Steps */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
        <SectionHeading title="ID Verification" subtitle="Verify your identity to unlock full payout capabilities." />
        <div className="flex flex-col gap-3">
          {[
            { step: '1', label: 'Government ID (Passport / National ID)', status: 'Uploaded',      done: true  },
            { step: '2', label: 'Selfie with ID',                         status: 'Pending review', done: false },
            { step: '3', label: 'Proof of address',                       status: 'Not uploaded',   done: false },
          ].map(item => (
            <div key={item.step} className={`flex items-center gap-3 rounded-md border px-4 py-3 ${item.done ? 'border-green-500/20 bg-green-500/5' : 'border-[#2a2a2a] bg-[#0d0d0d]'}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${item.done ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-[#2a2a2a] text-[#4a4a4a]'}`}>
                {item.step}
              </div>
              <div className="flex-1">
                <p className="font-mono text-[11px] tracking-[-0.05em] text-white">{item.label}</p>
                <p className={`font-mono text-[10px] tracking-[-0.04em] mt-0.5 ${item.done ? 'text-green-400' : 'text-[#4a4a4a]'}`}>{item.status}</p>
              </div>
              {!item.done && (
                <button className="h-7 px-3 rounded-md border border-[#2a2a2a] font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] hover:border-white/20 hover:text-white transition-colors">
                  Upload
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Discord */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
        <SectionHeading title="Discord Account" subtitle="Link your primary Discord to verify your identity." />

        <div className={`flex items-center justify-between gap-4 rounded-md border px-4 py-3 ${DISCORD_CONNECTED ? 'border-green-500/20 bg-green-500/5' : 'border-[#2a2a2a] bg-[#0d0d0d]'}`}>
          <div className="flex items-center gap-3">
            {/* Discord logo mark */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${DISCORD_CONNECTED ? 'bg-[#5865F2]/20 text-[#5865F2]' : 'bg-[#1a1a1a] text-[#6e6d6f]'}`}>
              D
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[-0.05em] text-white">Discord</p>
              {DISCORD_CONNECTED ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={10} strokeWidth={2} className="text-green-400" />
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-green-400">Connected as {DISCORD_HANDLE}</p>
                </div>
              ) : (
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] mt-0.5">Not connected</p>
              )}
            </div>
          </div>
          <button
            disabled={DISCORD_CONNECTED}
            className="flex h-7 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {DISCORD_CONNECTED ? 'Connected' : 'Connect Discord'}
          </button>
        </div>

        {/* Warning */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0 text-yellow-400" />
          <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-yellow-400/80">
            You must connect your <span className="font-semibold text-yellow-400">primary</span> Discord account. This can only be linked{' '}
            <span className="font-semibold text-yellow-400">ONCE</span> and cannot be changed later.
          </p>
        </div>
      </div>
    </div>
  )
}

function BankTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saved, setSaved]           = useState(false)

  function handleConfirm() {
    setDialogOpen(false)
    setSaved(true)
  }

  return (
    <>
      <BankConfirmDialog open={dialogOpen} onCancel={() => setDialogOpen(false)} onConfirm={handleConfirm} />

      <div className="w-1/2 rounded-xl border border-[#2a2a2a] bg-[#111111] px-7 py-7">
        {/* Header row with status badge */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">Bank Details</h2>
            <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] mt-0.5">Your payout destination. Used for all withdrawal requests.</p>
          </div>
          {/* Status badge — swap to green/Verified once support approves */}
          <span className="inline-flex shrink-0 items-center rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1.5 font-mono text-[10px] tracking-[-0.03em] text-yellow-400">
            Under Review
          </span>
        </div>

        <div className="grid gap-6 grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Holder Name</label>
            <input defaultValue="" className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Bank Name</label>
            <input defaultValue="" className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">SWIFT / BIC</label>
            <input defaultValue="" className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">IBAN</label>
            <input defaultValue="" className="h-9 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] transition-colors" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
            Bank details can only be updated once every 30 days.
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[-0.04em] text-green-400">
                <CheckCircle2 size={11} strokeWidth={2} />
                Submitted for review
              </span>
            )}
            <button
              onClick={() => setDialogOpen(true)}
              className="h-9 px-5 rounded-md bg-white font-mono text-[11px] font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-opacity"
            >
              Update Bank Details
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BoosterSettingsView({ initialTab, profile }: { initialTab?: TabId; profile?: Profile } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'general')

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    general:       <GeneralTab profile={profile} />,
    notifications: <NotificationsTab />,
    verification:  <VerificationTab />,
    bank:          <BankTab />,
  }

  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your account, notifications, and payout details."
      />

      {/* ── Tab bar ── */}
      <div className="flex gap-px overflow-hidden rounded-md border border-[#2a2a2a] w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] tracking-[-0.05em] transition-colors ${
              activeTab === id ? 'bg-white text-black' : 'bg-[#111111] text-[#6e6d6f] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Icon size={12} strokeWidth={1.5} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="w-full">
        {TAB_CONTENT[activeTab]}
      </div>
    </main>
  )
}
