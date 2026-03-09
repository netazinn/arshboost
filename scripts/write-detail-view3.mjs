import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '../src/components/features/dashboard/OrderDetailView.tsx')

const content = `'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, CheckCircle, MoreVertical, Copy, Users, KeyRound,
  Plus, CreditCard, Calendar, Tag, AlertTriangle, HelpCircle,
  ChevronRight, Lock, Eye, EyeOff, X,
} from 'lucide-react'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order } from '@/types'

// ─── Display types ────────────────────────────────────────────────────────────

type PaymentStatus = 'Unpaid' | 'Processing' | 'Paid' | 'Refunded' | 'Partially Refunded'
type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Need Action'

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  'Unpaid':             'border border-red-500/40 text-red-400 bg-red-500/10',
  'Processing':         'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Paid':               'border border-green-500/40 text-green-400 bg-green-500/10',
  'Refunded':           'border border-blue-500/40 text-blue-400 bg-blue-500/10',
  'Partially Refunded': 'border border-orange-500/40 text-orange-400 bg-orange-500/10',
}

const COMPLETION_BADGE: Record<CompletionStatus, string> = {
  'Waiting':     'border border-white/20 text-[#6e6d6f] bg-white/5',
  'In Progress': 'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Completed':   'border border-green-500/40 text-green-400 bg-green-500/10',
  'Canceled':    'border border-red-500/40 text-red-400 bg-red-500/10',
  'Disputed':    'border border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Need Action': 'border border-purple-500/40 text-purple-400 bg-purple-500/10',
}

// ─── Derive display values from real Order ────────────────────────────────────

function deriveDisplay(order: Order) {
  const d = (order.details ?? {}) as Record<string, unknown>

  const parseRank = (val: unknown) => {
    const parts = String(val ?? '—').split(' ')
    return { tier: parts[0] ?? '—', division: parts.slice(1).join(' ') }
  }

  const start = parseRank(d.current_rank)
  const end   = parseRank(d.target_rank)

  const statusToPayment: Record<string, PaymentStatus> = {
    pending: 'Unpaid', awaiting_payment: 'Unpaid',
    in_progress: 'Paid', completed: 'Paid',
    cancelled: 'Refunded', dispute: 'Paid',
  }
  const statusToCompletion: Record<string, CompletionStatus> = {
    pending: 'Waiting', awaiting_payment: 'Waiting',
    in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Canceled', dispute: 'Disputed',
  }

  const title =
    d.current_rank && d.target_rank
      ? \`\${d.current_rank} → \${d.target_rank}\`
      : order.service?.label ?? 'Boost'

  const extras: string[] = []
  if (d.priority)     extras.push('Priority Queue')
  if (d.stream_games) extras.push('Stream Games')

  return {
    shortId:          order.id.slice(0, 8).toUpperCase(),
    gameName:         order.game?.name ?? 'Unknown',
    serviceLabel:     order.service?.label ?? 'Boost',
    orderTitle:       title,
    paymentStatus:    (statusToPayment[order.status]    ?? 'Paid')        as PaymentStatus,
    completionStatus: (statusToCompletion[order.status] ?? 'In Progress') as CompletionStatus,
    price:            Number(order.price),
    totalWithFee:     Math.round(Number(order.price) * 1.07 * 100) / 100,
    boosterName:      order.booster?.username ?? order.booster?.email ?? null,
    startTier:        start.tier,
    startDivision:    start.division,
    endTier:          end.tier,
    startRR:          String(d.start_rr ?? ''),
    server:           String(d.server ?? '—'),
    queue:            String(d.queue_type ?? ''),
    extras,
  }
}

// ─── Tier icon ────────────────────────────────────────────────────────────────

function TierIcon({ tier }: { tier: string }) {
  const slug = tier.toLowerCase()
  return (
    <Image
      src={\`/images/valorant/ranks/\${slug}.webp\`}
      alt={tier}
      width={28}
      height={28}
      className="object-contain drop-shadow-sm"
    />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#191919]">
      <div className="px-6 py-4 border-b border-[#2a2a2a]">
        <h2 className="font-sans text-sm font-semibold tracking-[-0.04em] text-white">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function DataField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f] uppercase">{label}</span>
      <div className="flex items-center gap-2 font-mono text-sm tracking-[-0.07em] text-white">{children}</div>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 rounded p-0.5 text-[#4a4a4a] transition-colors hover:text-white"
    >
      <Copy size={11} strokeWidth={1.5} className={copied ? 'text-green-400' : ''} />
    </button>
  )
}

function OptionsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#191919] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
        <MoreVertical size={15} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-md border border-[#2a2a2a] bg-[#191919]">
          <button onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0] transition-colors hover:bg-white/5 hover:text-white">
            <AlertTriangle size={13} strokeWidth={1.5} className="text-orange-400" /> Open Dispute
          </button>
          <div className="mx-4 border-t border-[#2a2a2a]" />
          <button onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0] transition-colors hover:bg-white/5 hover:text-white">
            <HelpCircle size={13} strokeWidth={1.5} className="text-[#6e6d6f]" /> Need Support
          </button>
        </div>
      )}
    </div>
  )
}

function AddLoginsModal({ gameName, orderTitle, serviceLabel, gameIcon, onClose }: {
  gameName: string; orderTitle: string; serviceLabel: string
  gameIcon: string | undefined; onClose: () => void
}) {
  const [ign, setIgn]         = useState('')
  const [login, setLogin]     = useState('')
  const [pwd, setPwd]         = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [twoFa, setTwoFa]     = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:text-white">
          <X size={15} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-3 rounded-t-md border-b border-[#2a2a2a] bg-[#191919] px-5 py-4">
          {gameIcon
            ? <Image src={gameIcon} alt={gameName} width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2a2a2a]"><span className="font-sans text-xs font-bold text-white">{gameName.charAt(0)}</span></div>
          }
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{orderTitle}</p>
            <p className="mt-0.5 font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f]">{serviceLabel}</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onClose() }} className="flex flex-col gap-5 px-5 py-6">
          {[
            { label: 'In-Game Name', val: ign, set: setIgn, ph: 'e.g. HideOnBush#EUW1' },
            { label: 'Login', val: login, set: setLogin, ph: 'Your account username' },
          ].map(({ label, val, set, ph }) => (
            <div key={label} className="flex flex-col gap-2">
              <label className="font-mono text-xs tracking-[-0.1em] text-[#a0a0a0]">{label}</label>
              <input type="text" placeholder={ph} value={val} onChange={(e) => set(e.target.value)}
                className="h-[46px] w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-sm tracking-[-0.07em] text-white placeholder:text-[#3a3a3a] outline-none transition-colors focus:border-[#6e6d6f]" />
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-xs tracking-[-0.1em] text-[#a0a0a0]">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} placeholder="Your account password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                className="h-[46px] w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 pr-10 font-mono text-sm tracking-[-0.07em] text-white placeholder:text-[#3a3a3a] outline-none transition-colors focus:border-[#6e6d6f]" />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a4a] transition-colors hover:text-[#a0a0a0]">
                {showPwd ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">Is 2FA enabled?</span>
            <button type="button" onClick={() => setTwoFa((v) => !v)} role="switch" aria-checked={twoFa}
              className={\`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 \${twoFa ? 'bg-white' : 'bg-[#2a2a2a]'}\`}>
              <span className={\`pointer-events-none inline-block h-5 w-5 rounded-full shadow ring-0 transition-transform duration-150 \${twoFa ? 'translate-x-5 bg-black' : 'translate-x-0 bg-[#6e6d6f]'}\`} />
            </button>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-4 py-3.5">
            <Lock size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-yellow-400" />
            <p className="font-mono text-[11px] leading-relaxed tracking-[-0.05em] text-yellow-400/80">
              Your login credentials are secured using state-of-the-art encryption and are only visible to you and the booster.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex h-[44px] flex-1 items-center justify-center rounded-md border border-[#2a2a2a] bg-transparent font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
              Cancel
            </button>
            <button type="submit" className="flex h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90">
              <Plus size={13} strokeWidth={2} /> Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrderDetailView({ order }: { order: Order }) {
  const router = useRouter()
  const [loginsModalOpen, setLoginsModalOpen] = useState(false)

  const d = deriveDisplay(order)
  const gameIcon = GAME_ICONS[d.gameName]

  const createdDate = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto w-full">
        <div className="w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-7">

          {/* Header */}
          <div className="flex flex-col gap-5">
            <button onClick={() => router.back()} className="flex w-fit items-center gap-1.5 font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:text-white">
              <ArrowLeft size={13} strokeWidth={1.5} /> Go Back
            </button>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {gameIcon
                  ? <Image src={gameIcon} alt={d.gameName} width={52} height={52} className="h-[52px] w-[52px] shrink-0 rounded-md object-cover" />
                  : <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#191919]"><span className="font-sans text-lg font-bold text-white">{d.gameName.charAt(0)}</span></div>
                }
                <div>
                  <h1 className="font-sans text-2xl font-semibold leading-tight tracking-[-0.07em] text-white">{d.orderTitle}</h1>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                    <span className="font-mono text-[10px]">{d.shortId}</span>
                    <CopyButton value={order.id} />
                    <span className="text-[#2a2a2a]">·</span>
                    <span>{d.serviceLabel}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span>{d.server}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span className="font-semibold text-white">\${d.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {d.completionStatus !== 'Completed' && (
                  <button className="flex h-[42px] items-center gap-2 rounded-md bg-white px-5 font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90">
                    <CheckCircle size={14} strokeWidth={2} /> Mark Completed
                  </button>
                )}
                <OptionsMenu />
              </div>
            </div>
          </div>

          {/* 2-column layout */}
          <div className="grid grid-cols-[1fr_340px] gap-5 xl:grid-cols-[1fr_360px]">

            {/* Left */}
            <div className="flex flex-col gap-5">
              <SectionCard title="Boost Data">
                <div className="grid grid-cols-3 gap-x-6 gap-y-6">
                  <DataField label="Start Tier"><TierIcon tier={d.startTier} />{d.startTier}</DataField>
                  <DataField label="Start Division">{d.startDivision || '—'}</DataField>
                  <DataField label="End Tier"><TierIcon tier={d.endTier} />{d.endTier}</DataField>
                  {d.startRR && (
                    <div className="col-span-3 border-t border-[#2a2a2a] pt-5">
                      <DataField label="Start Rank Ratings">{d.startRR}</DataField>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Boost Information">
                <div className="grid grid-cols-3 gap-x-6 gap-y-6">
                  <DataField label="Title">{d.orderTitle}</DataField>
                  <DataField label="Boost ID">
                    <span className="font-mono text-[11px]">{d.shortId}</span>
                    <CopyButton value={order.id} />
                  </DataField>
                  <DataField label="Status">
                    <span className={\`inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] \${COMPLETION_BADGE[d.completionStatus]}\`}>
                      {d.completionStatus}
                    </span>
                  </DataField>

                  <div className="col-span-3 border-t border-[#2a2a2a] pt-5">
                    <div className="grid grid-cols-3 gap-x-6">
                      <DataField label="Game">{d.gameName}</DataField>
                      <DataField label="Type">{d.serviceLabel}</DataField>
                      <DataField label="Server">{d.server}</DataField>
                    </div>
                  </div>

                  <div className="col-span-3 border-t border-[#2a2a2a] pt-5">
                    <div className="grid grid-cols-3 gap-x-6 gap-y-6">
                      <DataField label="Price">\${d.price.toFixed(2)}</DataField>
                      {d.queue && <DataField label="Queue">{d.queue}</DataField>}
                      {d.extras.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f] uppercase">Extras</span>
                          <div className="flex flex-wrap gap-1.5">
                            {d.extras.map((extra) => (
                              <span key={extra} className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] tracking-[-0.03em] text-[#a0a0a0]">{extra}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Right */}
            <div className="flex flex-col gap-4">

              {/* Booster card */}
              <div className="rounded-md border border-[#2a2a2a] bg-[#191919] px-5 py-5">
                {d.boosterName ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                      <Users size={16} strokeWidth={1.5} className="text-[#6e6d6f]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] uppercase">Assigned Booster</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tracking-[-0.07em] text-white">{d.boosterName}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                      <Users size={16} strokeWidth={1.5} className="text-[#4a4a4a]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Boosters Found</p>
                      <p className="mt-1 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Once your order is paid, a booster<br />will be assigned to your order.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Login card */}
              <div className="rounded-md border border-[#2a2a2a] bg-[#191919] px-5 py-5">
                <div className="flex flex-col items-center gap-3 py-1 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                    <KeyRound size={16} strokeWidth={1.5} className="text-[#4a4a4a]" />
                  </div>
                  <div>
                    <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Logins Provided</p>
                    <p className="mt-1 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Click the button below to add the<br />logins of your account.</p>
                  </div>
                  <button onClick={() => setLoginsModalOpen(true)}
                    className="mt-1 flex h-[38px] w-full items-center justify-center gap-2 rounded-md border border-[#2a2a2a] bg-transparent font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
                    <Plus size={13} strokeWidth={1.5} /> Add Logins
                  </button>
                </div>
              </div>

              {/* Payment card */}
              <div className="rounded-md border border-[#2a2a2a] bg-[#191919] px-5 py-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f] uppercase">Total Amount</p>
                    <p className="mt-1 font-sans text-2xl font-bold tracking-[-0.07em] text-white">\${d.totalWithFee.toFixed(2)}</p>
                  </div>
                  <span className={\`mt-1 inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] \${PAYMENT_BADGE[d.paymentStatus]}\`}>
                    {d.paymentStatus}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 border-t border-[#2a2a2a] pt-4">
                  <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                    <Tag size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" /> No Discount
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                    <CreditCard size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" /> Debit/Credit Cards (Ecommpay)
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                    <Calendar size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" /> {createdDate}
                  </div>
                </div>
                {(d.paymentStatus === 'Unpaid' || d.paymentStatus === 'Processing') ? (
                  <button className="flex h-[40px] w-full items-center justify-center gap-1.5 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.05em] text-black transition-colors hover:bg-white/90">
                    Pay Now <ChevronRight size={13} strokeWidth={2} />
                  </button>
                ) : d.paymentStatus === 'Paid' ? (
                  <button className="flex h-[40px] w-full items-center justify-center gap-1.5 rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
                    View Receipt <ChevronRight size={13} strokeWidth={1.5} />
                  </button>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </div>

      {loginsModalOpen && (
        <AddLoginsModal
          gameName={d.gameName}
          orderTitle={d.orderTitle}
          serviceLabel={d.serviceLabel}
          gameIcon={gameIcon}
          onClose={() => setLoginsModalOpen(false)}
        />
      )}
    </>
  )
}
`

writeFileSync(out, content, 'utf-8')
console.log('✓ OrderDetailView.tsx written', out)
