'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, MessageSquare, Copy, Users, KeyRound,
  Plus, CreditCard, Calendar, Tag,
  ChevronRight, Lock, Eye, EyeOff, X,
  CheckCircle2, AlertTriangle, HelpCircle, XCircle,
  MoreVertical, Send, Shield, ImagePlus, RefreshCw, Pencil, Trash2, Info, Loader2, UserCheck,
  Check, CheckCheck,
} from 'lucide-react'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { ChatMessage as DBChatMessage, Order } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { saveLoginsAction, deleteLoginsAction, updateOrderProgress, updateOrderActivity, executeOrderAction, approveAndReleaseAction, boosterMarkCompleteWithProof } from '@/lib/actions/orders'
import { sendMessage as sendMessageAction, sendSystemMessage, getSenderProfile } from '@/lib/actions/chat'
import { SystemMessageDivider, SYS_COLOR_MAP } from '@/components/features/dashboard/ChatPanel'
import { notifyRankUpdate } from '@/lib/actions/notifications'
import { calculateBoosterPayout } from '@/lib/payout'

// ─── Valorant tiers (shared) ──────────────────────────────────────────────────

const ALL_TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant']
const DIVISIONS = ['1', '2', '3']

interface RankOption { label: string; tier: string; division: string }

function buildAllRanks(): RankOption[] {
  const ranks: RankOption[] = []
  for (const tier of ALL_TIERS.filter((t) => t !== 'Radiant')) {
    for (const div of DIVISIONS) {
      ranks.push({ label: `${tier} ${div}`, tier, division: div })
    }
  }
  ranks.push({ label: 'Radiant', tier: 'Radiant', division: '' })
  return ranks
}

const ALL_RANKS = buildAllRanks()

// ─── Booster activity options ─────────────────────────────────────────────────
const ACTIVITY_OPTIONS = ['Waiting Action', 'Playing', 'Offline'] as const
type ActivityOption = typeof ACTIVITY_OPTIONS[number]

const ACTIVITY_TO_BOOSTER_STATUS: Record<string, BoosterStatus> = {
  'Waiting Action': 'Waiting',
  'Playing':        'Online',
  'Offline':        'Offline',
}

// Build rank options only between startRank and endRank (inclusive)
function ranksInRange(startLabel: string, endLabel: string): RankOption[] {
  const all = ALL_RANKS
  const si = all.findIndex((r) => r.label === startLabel)
  const ei = all.findIndex((r) => r.label === endLabel)
  if (si === -1 || ei === -1) return all
  return all.slice(si, ei + 1)
}

// ─── Display types ────────────────────────────────────────────────────────────

type PaymentStatus = 'Unpaid' | 'Processing' | 'Paid' | 'Refunded' | 'Partially Refunded'
type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Support Called' | 'Need Action' | 'Waiting Approval' | 'Cancel Requested'
type BoosterStatus = 'Online' | 'Offline' | 'Waiting'

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
  'Canceled':      'border border-red-500/40 text-red-400 bg-red-500/10',
  'Disputed':      'border border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Support Called':   'border border-blue-500/40 text-blue-400 bg-blue-500/10',
  'Need Action':       'border border-purple-500/40 text-purple-400 bg-purple-500/10',
  'Waiting Approval':  'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Cancel Requested':  'border border-red-500/40 text-red-400 bg-red-500/10',
}

// ─── Derive display values from real Order ────────────────────────────────────

function deriveDisplay(order: Order) {
  const d = (order.details ?? {}) as Record<string, unknown>

  const parseRank = (val: unknown) => {
    const str = String(val ?? '—')
    // Handle Immortal RR format: "Immortal 3 (230RR)" → tier: "Immortal", division: "3"
    const immortalMatch = str.match(/^Immortal\s+(\d+)\s*\(\d+RR\)$/i)
    if (immortalMatch) return { tier: 'Immortal', division: immortalMatch[1] }
    const parts = str.split(' ')
    return { tier: parts[0] ?? '—', division: parts.slice(1).join(' ') }
  }

  const start = parseRank(d.current_rank)
  const end   = parseRank(d.target_rank)

  const statusToPayment: Record<string, PaymentStatus> = {
    pending: 'Unpaid', awaiting_payment: 'Unpaid',
    in_progress: 'Paid', completed: 'Paid',
    cancelled: 'Refunded', dispute: 'Paid',
    waiting_action: 'Paid', cancel_requested: 'Paid',
  }
  const statusToCompletion: Record<string, CompletionStatus> = {
    pending: 'Waiting', awaiting_payment: 'Waiting',
    in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Canceled', dispute: 'Disputed', support: 'Support Called',
    waiting_action: 'Waiting Approval', cancel_requested: 'Cancel Requested',
  }

  const title =
    d.current_rank && d.target_rank
      ? `${d.current_rank} → ${d.target_rank}`
      : order.service?.label ?? 'Boost'

  // Support both nested options object (new) and flat fields (legacy)
  const opts = (d.options ?? {}) as Record<string, unknown>
  const extras: string[] = []
  if (opts.priority   || d.priority)     extras.push('Priority Queue')
  if (opts.stream     || d.stream_games) extras.push('Stream Games')
  if (opts.solo_queue) extras.push('Solo Queue')
  if (opts.bonus_win)  extras.push('Bonus Win')

  const agentNames = ((opts.agents ?? []) as string[])
  const discountCode = String(d.discount_code ?? opts.discount_code ?? '')

  const startFull = String(d.current_rank ?? '—')
  const endFull   = String(d.target_rank ?? '—')

  return {
    shortId:          order.id.slice(0, 8).toUpperCase(),
    gameName:         order.game?.name ?? 'Unknown',
    serviceLabel:     order.service?.label ?? 'Boost',
    orderTitle:       title,
    paymentStatus:    (statusToPayment[order.status]    ?? 'Paid')        as PaymentStatus,
    completionStatus: (statusToCompletion[order.status] ?? 'In Progress') as CompletionStatus,
    price:            Number(order.price),
    totalWithFee:     Math.round(Number(order.price) * 1.07 * 100) / 100,
    // boosterName: use joined profile if available; fall back to truthy sentinel so
    // Realtime payloads (which carry booster_id but no joined object) still trigger State 3.
    boosterName:      order.booster?.username ?? order.booster?.email ?? (order.booster_id ? 'Booster' : null),
    startTier:        start.tier,
    startDivision:    start.division,
    endTier:          end.tier,
    startRR:          d.start_immortal_rr != null ? String(d.start_immortal_rr) : String(d.rr_range ?? d.start_rr ?? ''),
    targetRR:         d.target_immortal_rr != null ? String(d.target_immortal_rr) : '',
    server:           String(d.server ?? '—'),
    queue:            String(d.queue ?? d.queue_type ?? ''),
    extras,
    agentNames,
    discountCode,
    startFull,
    endFull,
    createdDate: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }),
  }
}

// ─── Tier icon ────────────────────────────────────────────────────────────────

function TierIcon({ tier, size = 28 }: { tier: string; size?: number }) {
  const slug = tier.toLowerCase()
  return (
    <Image
      src={`/images/valorant/ranks/${slug}.webp`}
      alt={tier}
      width={size}
      height={size}
      className="object-contain drop-shadow-sm"
    />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#111111]">
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

// ─── Confirmation Modal ───────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

function ConfirmModal({ title, description, confirmLabel = 'Confirm', danger = false, isLoading = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[400px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-500/10' : 'bg-white/5'}`}>
            {danger
              ? <AlertTriangle size={15} strokeWidth={1.5} className="text-red-400" />
              : <Shield size={15} strokeWidth={1.5} className="text-[#a0a0a0]" />
            }
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{title}</p>
            <p className="mt-1 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#6e6d6f]">{description}</p>
          </div>
          <button onClick={onCancel} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:text-white">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={onCancel} className="flex h-[40px] flex-1 items-center justify-center rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex h-[40px] flex-1 items-center justify-center gap-2 rounded-md font-mono text-xs font-semibold tracking-[-0.07em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {isLoading && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Proof Upload Modal ───────────────────────────────────────────────────────

interface ProofUploadModalProps {
  orderId: string
  onCancel: () => void
  onSuccess: () => void
  onActivityReset: () => void
}

function ProofUploadModal({ orderId, onCancel, onSuccess, onActivityReset }: ProofUploadModalProps) {
  const [file, setFile]               = useState<File | null>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const proofFileRef                  = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setUploadError('Only image files are accepted.'); return }
    if (f.size > 10 * 1024 * 1024)   { setUploadError('File must be under 10 MB.'); return }
    setUploadError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('orderId', orderId)
      fd.append('file', file)
      const result = await boosterMarkCompleteWithProof(fd)
      if (result?.error) throw new Error(result.error)
      onActivityReset()
      onSuccess()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!uploading ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-[440px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 size={15} strokeWidth={1.5} className="text-green-400" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Mark Order as Complete</p>
            <p className="mt-1 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#6e6d6f]">
              Upload a screenshot of the final rank or match result as proof of completion.
            </p>
          </div>
          {!uploading && (
            <button onClick={onCancel} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:text-white">
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          <input ref={proofFileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Proof preview" className="w-full max-h-48 rounded-md object-cover border border-[#2a2a2a]" />
              {!uploading && (
                <button
                  onClick={() => { setFile(null); setPreview(null) }}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => proofFileRef.current?.click()}
              className="flex w-full h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[#2a2a2a] bg-[#0a0a0a] text-[#6e6d6f] transition-colors hover:border-[#4a4a4a] hover:text-white"
            >
              <ImagePlus size={20} strokeWidth={1.5} />
              <span className="font-mono text-[11px] tracking-[-0.05em]">Click to select a screenshot</span>
              <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">PNG, JPG, WEBP · max 10 MB</span>
            </button>
          )}
          {uploadError && (
            <p className="mt-2 font-mono text-[11px] tracking-[-0.05em] text-red-400">{uploadError}</p>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="flex h-[40px] flex-1 items-center justify-center rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex h-[40px] flex-1 items-center justify-center gap-2 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
            {uploading ? 'Uploading…' : 'Submit & Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Logins Modal ─────────────────────────────────────────────────────────

function AddLoginsModal({ gameName, orderTitle, serviceLabel, gameIcon, onClose, onSubmit, initialValues }: {
  gameName: string; orderTitle: string; serviceLabel: string
  gameIcon: string | undefined; onClose: () => void
  onSubmit?: (data: { ign: string; login: string; pwd: string; twoFa: boolean }) => void
  initialValues?: { ign: string; login: string; pwd: string; twoFa: boolean }
}) {
  const [ign, setIgn]         = useState(initialValues?.ign   ?? '')
  const [login, setLogin]     = useState(initialValues?.login ?? '')
  const [pwd, setPwd]         = useState(initialValues?.pwd   ?? '')
  const [showPwd, setShowPwd] = useState(false)
  const [twoFa, setTwoFa]     = useState(initialValues?.twoFa ?? false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:text-white">
          <X size={15} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-3 rounded-t-md border-b border-[#2a2a2a] bg-[#111111] px-5 py-4">
          {gameIcon
            ? <Image src={gameIcon} alt={gameName} width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2a2a2a]"><span className="font-sans text-xs font-bold text-white">{gameName.charAt(0)}</span></div>
          }
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{orderTitle}</p>
            <p className="mt-0.5 font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f]">{serviceLabel}</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit?.({ ign, login, pwd, twoFa }); onClose() }} className="flex flex-col gap-5 px-5 py-6">
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${twoFa ? 'bg-white' : 'bg-[#2a2a2a]'}`}>
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full shadow ring-0 transition-transform duration-150 ${twoFa ? 'translate-x-5 bg-black' : 'translate-x-0 bg-[#6e6d6f]'}`} />
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

// ─── Chat messages type ───────────────────────────────────────────────────────

interface LocalMsg {
  id: string
  sender: 'client' | 'booster' | 'system' | 'admin' | 'support' | 'accountant'
  text?: string
  imageUrl?: string
  time: string
  systemType?: string
  /** @deprecated use systemType + SYS_COLOR_MAP instead */
  systemColor?: 'orange' | 'blue' | 'red' | 'green'
  is_read?: boolean
}

const STAFF_ROLES = ['admin', 'support', 'accountant'] as const
type StaffRole = typeof STAFF_ROLES[number]

const MOCK_MESSAGES: LocalMsg[] = [
  { id: '1', sender: 'system',  text: 'Order started. Booster has been assigned.',  time: '10:01 AM' },
  { id: '2', sender: 'booster', text: 'Hey! I will start your boost shortly, I just need to log in.',  time: '10:03 AM' },
  { id: '3', sender: 'client',  text: 'Great, thanks! Let me know if you need anything.', time: '10:05 AM' },
  { id: '4', sender: 'booster', text: 'Currently in game, making great progress!',  time: '10:45 AM' },
]

// ─── Image compression helper ─────────────────────────────────────────────────

const MAX_FILE_SIZE    = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES    = ['image/jpeg', 'image/png', 'image/webp']
const COMPRESS_MAX_DIM = 1200
const COMPRESS_QUALITY = 0.82

async function compressImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
          const ratio = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height)
          width  = Math.round(width  * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', COMPRESS_QUALITY))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ─── Chat View ────────────────────────────────────────────────────────────────

type ConfirmAction = 'mark_completed' | 'open_dispute' | 'need_support' | 'cancel_request' | 'approve_release' | null

interface ActivityLogEvent {
  label: string
  time: string
  date: string
  active: boolean
}

interface Agent {
  name: string
  avatarUrl?: string
}

interface LiveStatus {
  status: BoosterStatus
  currentRankLabel: string
  currentRankTier: string
}

interface ChatViewProps {
  order: Order
  d: ReturnType<typeof deriveDisplay>
  gameIcon: string | undefined
  onBack: () => void
  liveStatus: LiveStatus
  onRankUpdate: (rankLabel: string, rankTier: string) => void
  onActivityUpdate: (status: BoosterStatus) => void
  isBooster?: boolean
  activityLogs: ActivityLogEvent[]
  agents: Agent[]
  initialMessages: DBChatMessage[]
  currentUserId: string
  logins?: { ign: string; login: string; pwd: string; twoFa: boolean } | null
}

function ChatView({ order, d, gameIcon, onBack, liveStatus, onRankUpdate, onActivityUpdate, isBooster = false, activityLogs, agents, initialMessages, currentUserId, logins }: ChatViewProps) {
  // Convert DB ChatMessage → local UI shape
  function dbToLocal(msg: DBChatMessage): LocalMsg {
    const _ts = new Date(msg.created_at)
    const time = `${_ts.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${_ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    // System messages are flagged in the DB; map them to the 'system' sender role.
    if (msg.is_system) {
      // For 'completed' system messages, the actor sees a localised confirmation.
      let text = msg.content
      if (msg.system_type === 'completed') {
        text = msg.sender_id === currentUserId
          ? 'Order marked as completed by you. Thank you! Waiting for confirmation.'
          : msg.content
      }
      return { id: msg.id, sender: 'system', text, time, systemType: msg.system_type ?? undefined }
    }
    // Staff role (admin/support/accountant) takes priority over the client/booster ID check
    const rawRole = msg.sender?.role as string | undefined
    const sender: LocalMsg['sender'] = (rawRole && (STAFF_ROLES as readonly string[]).includes(rawRole))
      ? (rawRole as StaffRole)
      : msg.sender_id === order.client_id ? 'client' : 'booster'
    if (msg.image_url) return { id: msg.id, sender, imageUrl: msg.image_url, time, is_read: msg.is_read ?? false }
    return { id: msg.id, sender, text: msg.content, time, is_read: msg.is_read ?? false }
  }

  const [messages, setMessages]   = useState<LocalMsg[]>(() => initialMessages.map(dbToLocal))
  // Ref mirror of messages so Realtime/timer callbacks can read current list without stale closure
  const messagesRef = useRef<LocalMsg[]>(initialMessages.map(dbToLocal))
  function setMessagesSync(updater: LocalMsg[] | ((prev: LocalMsg[]) => LocalMsg[])) {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      messagesRef.current = next
      return next
    })
  }
  const [isSending, setIsSending] = useState(false)
  const [input, setInput]         = useState('')
  const [kebabOpen, setKebabOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  const [proofUploadOpen, setProofUploadOpen] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; senderName: string; time: string } | null>(null)

  // Booster control panel state (also used for the sidebar controls in chat view)
  const [activitySelect, setActivitySelect] = useState<string>(() => {
    const det = (order.details as Record<string, unknown>)
    return String(det?.booster_activity_status ?? 'Waiting Action')
  })
  const [updatingActivity, setUpdatingActivity] = useState(false)
  const [updatingRankCtrl, setUpdatingRankCtrl] = useState(false)

  // Booster rank update
  const rankOptions = ranksInRange(d.startFull, d.endFull)
  const [selectedRank, setSelectedRank] = useState(liveStatus.currentRankLabel)

  const kebabRef       = useRef<HTMLDivElement>(null)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const fileRef        = useRef<HTMLInputElement>(null)
  // Tracks the current optimistic message ID so Realtime can swap it for the real DB row
  const pendingOptIdRef  = useRef<string | null>(null)
  // Broadcast channel — kept alive so we can nudge the Booster instantly after sending.
  const syncChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // ── Derived: chat lock + dynamic order status badge ──────────────────────────
  const isChatLocked   = ['dispute', 'cancelled', 'completed', 'cancel_requested'].includes(order.status)
  // Actions locked: order has reached a terminal/review state — buttons become disabled
  const isOrderLocked  = ['dispute', 'cancel_requested', 'completed', 'cancelled'].includes(order.status)
  const ORDER_STATUS_BADGE: Record<string, { cls: string; label: string }> = {
    in_progress:      { cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400', label: 'In Progress'      },
    completed:        { cls: 'border-green-500/30  bg-green-500/10  text-green-400',  label: 'Completed'        },
    dispute:          { cls: 'border-orange-500/30 bg-orange-500/10 text-orange-400', label: 'Dispute Opened'   },
    support:          { cls: 'border-blue-500/30   bg-blue-500/10   text-blue-400',   label: 'Support Called'   },
    cancelled:        { cls: 'border-red-500/30    bg-red-500/10    text-red-400',    label: 'Cancelled'        },
    pending:          { cls: 'border-gray-500/30   bg-gray-500/10   text-gray-400',   label: 'Pending'          },
    waiting_action:   { cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400', label: 'Waiting Approval' },
    cancel_requested: { cls: 'border-red-500/30    bg-red-500/10    text-red-400',    label: 'Cancel Requested' },
  }
  const statusBadgeEntry = ORDER_STATUS_BADGE[order.status] ?? ORDER_STATUS_BADGE.in_progress

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`chat-sync:${order.id}`)
    ch.subscribe()
    syncChannelRef.current = ch
    return () => { sb.removeChannel(ch); syncChannelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function handler(e: PointerEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  // Realtime: handle all INSERTs — own messages swap the opt- entry; other messages append.
  useEffect(() => {
    const supabase = createClient()
    console.log(`[ChatView][Realtime] Subscribing to chat_messages for order ${order.id}`)

    const channel = supabase
      .channel(`chat:${order.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${order.id}` },
        async (payload) => {
          const raw = payload.new as DBChatMessage
          console.log('[ChatView][Realtime] New message received:', raw.id, 'from:', raw.sender_id)

          // Dedup guard (fast check before any async work)
          if (messagesRef.current.some(m => m.id === raw.id)) return

          // System messages — synchronous append, no profile needed
          if (raw.is_system) {
            setMessagesSync(prev => {
              if (prev.some(m => m.id === raw.id)) return prev
              return [...prev, dbToLocal(raw)]
            })
            return
          }

          // Own message echo — swap the optimistic bubble synchronously
          if (raw.sender_id === currentUserId) {
            setMessagesSync(prev => {
              if (prev.some(m => m.id === raw.id)) return prev
              const optId = pendingOptIdRef.current
              pendingOptIdRef.current = null
              if (optId && prev.some(m => m.id === optId)) {
                return prev.map(m => m.id === optId ? dbToLocal(raw) : m)
              }
              const matchIdx = prev.findIndex(m => m.id.startsWith('opt-') && m.text === raw.content)
              if (matchIdx !== -1) {
                return prev.map((m, i) => i === matchIdx ? dbToLocal(raw) : m)
              }
              return prev
            })
            return
          }

          // Incoming message from another user — fetch sender profile so role styling works
          const senderProfile = await getSenderProfile(raw.sender_id)
          const enriched: DBChatMessage = senderProfile
            ? { ...raw, sender: senderProfile as DBChatMessage['sender'] }
            : raw
          setMessagesSync(prev => {
            if (prev.some(m => m.id === raw.id)) return prev
            return [...prev, dbToLocal(enriched)]
          })
          // Auto-mark incoming messages as read while the chat is visible
          handleMarkRead().catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${order.id}` },
        (payload) => {
          const raw = payload.new as DBChatMessage
          // Merge the updated DB row into local state AND keep the ref in sync immediately
          // so any concurrent handleMarkRead() guard sees the latest is_read values.
          // IMPORTANT: Preserve the existing `sender` — Realtime UPDATE payloads don't carry
          // profile joins, so dbToLocal(raw) would incorrectly reset a staff sender to 'booster'.
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id !== raw.id) return m
              const fromDB = dbToLocal(raw)
              return { ...m, ...fromDB, sender: m.sender }
            })
            messagesRef.current = updated // CRITICAL: update ref synchronously
            return updated
          })
        },
      )
      .subscribe((status, err) => {
        console.log('[ChatView][Realtime] Channel status:', status, err ? `| error: ${String(err)}` : '')
      })
    return () => {
      console.log(`[ChatView][Realtime] Unsubscribing from order ${order.id}`)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, currentUserId])

  // Mark all existing unread messages from the other party as read on chat open
  useEffect(() => {
    // Small delay so messagesRef is fully populated before the guard runs
    const t = setTimeout(() => handleMarkRead().catch(() => {}), 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Note: no polling fallback — Realtime INSERT + UPDATE handlers above cover
  // new messages and is_read changes without any periodic REST fetching.

  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return
    const _ts = new Date()
    const now = `${_ts.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${_ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    const optimisticId = `opt-${Date.now()}`
    pendingOptIdRef.current = optimisticId
    setMessages((prev) => [...prev, { id: optimisticId, sender: isBooster ? 'booster' : 'client', text, time: now }])
    setInput('')
    setIsSending(true)
    try {
      await sendMessageAction(order.id, text)
      // Instantly wake up the Booster's panel via broadcast (bypasses RLS on postgres_changes)
      syncChannelRef.current?.send({ type: 'broadcast', event: 'nudge', payload: {} })
    } catch {
      // On error, remove the optimistic bubble and clear the ref
      pendingOptIdRef.current = null
      setMessages((prev) => prev.filter(m => m.id !== optimisticId))
    } finally {
      setIsSending(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Only JPG, PNG or WebP images are allowed.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setImageError('Image must be under 5 MB.')
      return
    }

    const dataUrl = await compressImage(file)
    if (!dataUrl) { setImageError('Could not process image.'); return }

    const _ts = new Date()
    const now = `${_ts.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${_ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    const optimisticId = `opt-img-${Date.now()}`
    pendingOptIdRef.current = optimisticId
    setMessages((prev) => [...prev, { id: optimisticId, sender: isBooster ? 'booster' : 'client', imageUrl: dataUrl, time: now, is_read: false }])

    try {
      // Upload directly from the browser — storage policies are now configured
      const mimeType = file.type || 'image/jpeg'
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
      const storagePath = `${order.id}/${Date.now()}.${ext}`

      const blob = await fetch(dataUrl).then((r) => r.blob())
      const supabase = createClient()
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('chat-images')
        .upload(storagePath, blob, { contentType: mimeType, upsert: false })
      if (uploadErr || !uploadData) throw new Error(uploadErr?.message ?? 'Upload failed')

      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploadData.path)

      // Insert the chat_messages row — Realtime will broadcast to the other side
      const { error: insertError } = await supabase.from('chat_messages').insert({
        order_id:  order.id,
        sender_id: currentUserId,
        content:   '',
        image_url: publicUrl,
      })
      if (insertError) throw new Error(insertError.message)

      syncChannelRef.current?.send({ type: 'broadcast', event: 'nudge', payload: {} })
    } catch (err) {
      pendingOptIdRef.current = null
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setImageError((err as Error).message || 'Failed to send image.')
    }
  }

  function handleBoosterUpdate() {
    const opt = rankOptions.find((r) => r.label === selectedRank)
    if (!opt) return
    onRankUpdate(opt.label, opt.tier)
    setUpdatingRankCtrl(true)
    updateOrderProgress(order.id, opt.label)
      .catch(console.error)
      .finally(() => setUpdatingRankCtrl(false))
    sendSystemMessage(order.id, `Booster updated current rank to ${opt.label}`, 'rank_update').catch(console.error)
    notifyRankUpdate({ orderId: order.id, clientId: order.client_id, newRank: opt.label }).catch(console.error)
  }

  async function handleUpdateActivity() {
    setUpdatingActivity(true)
    const newStatus = ACTIVITY_TO_BOOSTER_STATUS[activitySelect] ?? 'Waiting'
    onActivityUpdate(newStatus)
    await updateOrderActivity(order.id, activitySelect).catch(console.error)
    setUpdatingActivity(false)
  }

  /** Mark all unread messages from the other party as read while this chat is open. */
  async function handleMarkRead() {
    // Guard: skip the DB round-trip if there is nothing to mark
    const hasUnread = messagesRef.current.some(
      (m) => m.sender !== 'system' && !m.is_read && m.sender !== (isBooster ? 'booster' : 'client')
    )
    if (!hasUnread) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('order_id', order.id)
      .neq('sender_id', currentUserId)
      .eq('is_read', false)
      .select()
    if (error) {
      console.error('[markRead] FAILED:', error.message, error.details, error.hint)
    } else if (data && data.length > 0) {
      console.log('[markRead] Marked', data.length, 'messages as read:', data.map(m => m.id))
    }
  }

  const CONFIRM_META: Record<NonNullable<ConfirmAction>, { title: string; description: string; label: string; danger: boolean }> = {
    mark_completed: {
      title: 'Mark as Completed?',
      description: 'This will mark your order as completed. The booster will be paid once you confirm.',
      label: 'Mark Completed',
      danger: false,
    },
    approve_release: {
      title: 'Approve & Release Funds?',
      description: 'This will mark the order as completed and release payment to the booster. This cannot be undone.',
      label: 'Approve & Release',
      danger: false,
    },
    open_dispute: {
      title: 'Open a Dispute?',
      description: 'Opening a dispute will pause the order and notify our support team to review the situation.',
      label: 'Open Dispute',
      danger: true,
    },
    need_support: {
      title: 'Contact Support?',
      description: 'A support agent will be added to this chat to help resolve any issues.',
      label: 'Contact Support',
      danger: false,
    },
    cancel_request: {
      title: 'Cancel this Request?',
      description: 'Cancelling will stop the boost. Depending on progress, a partial refund may apply.',
      label: 'Cancel Request',
      danger: true,
    },
  }

  const statusDotClass: Record<BoosterStatus, string> = {
    Online:  'bg-green-400',
    Offline: 'bg-[#6e6d6f]',
    Waiting: 'bg-yellow-400',
  }

  const statusBadgeClass: Record<BoosterStatus, string> = {
    Online:  'bg-green-400/10 border border-green-400/30 text-green-400',
    Offline: 'bg-[#6e6d6f]/15 border border-[#6e6d6f]/40 text-[#9e9d9f]',
    Waiting: 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-400',
  }

  const statusLabel: Record<BoosterStatus, string> = {
    Online:  'Online',
    Offline: 'Offline',
    Waiting: 'Waiting Action',
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-5">

        {/* ── Chat panel (70%) ─────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-[70] flex-col rounded-md border border-[#2a2a2a] bg-[#111111]">

          {/* Chat header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#2a2a2a] px-5 py-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={15} strokeWidth={1.5} className="text-[#6e6d6f]" />
              <span className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Order Chat</span>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-[-0.03em] ${statusBadgeEntry.cls}`}>
                {statusBadgeEntry.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Lock banner — shown instantly when Realtime fires a locking status update */}
              {isOrderLocked && (
                <div className="flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5">
                  <Lock size={11} strokeWidth={1.5} className="text-[#6e6d6f]" />
                  <span className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f]">Actions locked</span>
                </div>
              )}

              {isBooster ? (
                /* Booster: Mark as Complete — opens proof upload modal */
                <button
                  onClick={() => setProofUploadOpen(true)}
                  disabled={order.status !== 'in_progress' || isOrderLocked}
                  title={isOrderLocked ? 'Actions restricted while order is locked.' : undefined}
                  className="flex h-[34px] items-center gap-1.5 rounded-md border border-green-500 bg-green-500/10 px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale-[0.5]"
                >
                  <CheckCircle2 size={13} strokeWidth={2} /> Mark as Complete
                </button>
              ) : (
                /* Client: action depends on order status */
                <div className="flex items-center gap-1.5">
                  {order.status === 'waiting_action' ? (
                    /* Booster has marked complete — client can review proof then approve */
                    <>
                      {order.proof_image_url && (
                        <a
                          href={order.proof_image_url}
                          target="_blank"
                          rel="noreferrer"
                          title="View booster’s proof of completion"
                          className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 font-mono text-xs tracking-[-0.07em] text-[#9ca3af] transition-colors hover:border-[#6e6d6f] hover:text-white"
                        >
                          <Eye size={13} strokeWidth={1.5} /> View Proof
                        </a>
                      )}
                      <button
                        onClick={() => setConfirmAction('approve_release')}
                        className="flex h-[34px] items-center gap-1.5 rounded-md border border-green-500 bg-green-500/10 px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-green-500 transition-colors hover:bg-green-500/20"
                      >
                        <CheckCircle2 size={13} strokeWidth={2} /> Approve &amp; Release Funds
                      </button>
                    </>
                  ) : (order.status === 'in_progress' || isOrderLocked) ? (
                    /* In-progress (or locked): manual complete — tooltip only when active */
                    <>
                      {order.status === 'in_progress' && (
                        <div className="group relative mr-3">
                          <Info size={15} strokeWidth={1.5} className="text-gray-500 hover:text-gray-200 cursor-help transition-colors" />
                          <div className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-50 w-[28rem] rounded-lg border border-red-500/40 bg-[#1a0a0a] p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <p className="text-xs text-red-400 leading-relaxed">Please do not click &apos;Mark Completed&apos; until you are absolutely sure your order is done, regardless of what the booster tells you. Once payment is released to the booster, you cannot get a refund.</p>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setConfirmAction('mark_completed')}
                        disabled={isOrderLocked}
                        title={isOrderLocked ? 'Actions restricted while order is locked.' : undefined}
                        className="flex h-[34px] items-center gap-1.5 rounded-md border border-green-500 bg-green-500/10 px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale-[0.5]"
                      >
                        <CheckCircle2 size={13} strokeWidth={2} /> Mark Completed
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {/* Kebab menu — trigger disabled (and dropdown suppressed) when order is locked */}
              <div ref={kebabRef} className="relative">
                <button
                  onClick={() => !isOrderLocked && setKebabOpen((v) => !v)}
                  disabled={isOrderLocked}
                  title={isOrderLocked ? 'Actions restricted while order is locked.' : undefined}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MoreVertical size={15} strokeWidth={1.5} />
                </button>
                {kebabOpen && !isOrderLocked && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#111] py-1.5 shadow-2xl">
                    {([
                      { action: 'open_dispute'   as ConfirmAction, label: 'Open Dispute',   icon: <AlertTriangle size={13} strokeWidth={1.5} className="text-orange-400" /> },
                      { action: 'need_support'   as ConfirmAction, label: 'Need Support',   icon: <HelpCircle    size={13} strokeWidth={1.5} className="text-blue-400"   /> },
                      { action: 'cancel_request' as ConfirmAction, label: 'Cancel Request', icon: <XCircle       size={13} strokeWidth={1.5} className="text-red-400"    /> },
                    ] as const).map(({ action, label, icon }) => (
                      <button
                        key={action}
                        onClick={() => { setKebabOpen(false); setConfirmAction(action) }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 font-mono text-xs tracking-[-0.05em] text-[#9ca3af] transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => {
                if (msg.sender === 'system') {
                  const colorCls = (msg.systemType && SYS_COLOR_MAP[msg.systemType]) ?? undefined
                  return <SystemMessageDivider key={msg.id} text={msg.text ?? ''} colorCls={colorCls} />
                }
                const isClient = msg.sender === 'client'
                const isStaff  = (STAFF_ROLES as readonly string[]).includes(msg.sender)
                // isOwn: the current viewer sent this message
                const isOwn = isBooster ? msg.sender === 'booster' : isClient
                // Label shown above incoming messages
                const staffLabel = msg.sender === 'admin' ? '[SYSTEM ADMINISTRATOR]'
                  : msg.sender === 'support' ? '[SUPPORT]'
                  : msg.sender === 'accountant' ? '[ACCOUNTANT]'
                  : null
                const incomingLabel = staffLabel ?? (isBooster ? 'Client' : 'Booster')
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%]`}>
                      {(!isOwn || (isOwn && isStaff)) && (
                        <p className={`mb-1 font-mono text-[10px] tracking-[-0.05em] ${
                          isStaff
                            ? msg.sender === 'admin'
                              ? 'text-red-400 font-semibold'
                              : 'text-yellow-400 font-semibold'
                            : 'text-[#4a4a4a]'
                        }`}>{isOwn && isStaff ? `${staffLabel} You` : incomingLabel}</p>
                      )}
                      {msg.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imageUrl}
                          alt="uploaded"
                          className={`max-w-full rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity ${isOwn ? 'rounded-br-none' : 'rounded-bl-none'}`}
                          style={{ maxHeight: 240 }}
                          onClick={() => setLightbox({ url: msg.imageUrl!, senderName: isOwn ? 'You' : incomingLabel, time: msg.time })}
                        />
                      ) : (
                        <div className={`rounded-md px-3.5 py-2.5 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                          isStaff
                            ? msg.sender === 'admin'
                              ? isOwn
                                ? 'bg-red-500/10 border border-red-500/40 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.15)] rounded-br-none'
                                : 'bg-red-500/5 border border-red-500/30 text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.1)] rounded-bl-none'
                              : isOwn
                                ? 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.15)] rounded-br-none'
                                : 'bg-yellow-500/5 border border-yellow-500/30 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)] rounded-bl-none'
                            : isOwn
                              ? 'bg-[#e8e8e8] text-[#111111] rounded-br-none'
                              : 'border border-[#2a2a2a] bg-[#141414] text-[#d0d0d0] rounded-bl-none'
                        }`}>
                          {isStaff && (
                            <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <Shield size={9} strokeWidth={2} className={msg.sender === 'admin' ? 'text-red-400' : 'text-yellow-400'} />
                              <span className={`font-mono text-[8px] tracking-[0.02em] font-semibold uppercase ${
                                msg.sender === 'admin' ? 'text-red-400' : 'text-yellow-400'
                              }`}>
                                {msg.sender}
                              </span>
                            </div>
                          )}
                          {msg.text}
                        </div>
                      )}
                      <div className={`mt-1 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">{msg.time}</span>
                        {isOwn && (
                          msg.is_read
                            ? <CheckCheck size={11} strokeWidth={1.5} className="text-green-400 shrink-0" />
                            : <Check size={11} strokeWidth={1.5} className="text-[#4a4a4a] shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Image error */}
          {imageError && (
            <div className="shrink-0 mx-4 mb-0 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 text-red-400" />
              <span className="font-mono text-[10px] tracking-[-0.05em] text-red-400">{imageError}</span>
              <button onClick={() => setImageError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X size={12} /></button>
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 border-t border-[#2a2a2a] px-4 py-3">
            <div className={`flex items-center gap-2 transition-opacity ${isChatLocked ? 'opacity-50' : ''}`}>
              {/* Image upload button */}
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Upload image (JPG, PNG, WebP · max 5 MB)"
                disabled={isChatLocked}
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed"
              >
                <ImagePlus size={15} strokeWidth={1.5} />
              </button>

              <input
                type="text"
                placeholder={isChatLocked ? 'Chat is locked. Waiting for action...' : 'Type a message…'}
                value={input}
                disabled={isChatLocked}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isChatLocked) { e.preventDefault(); handleSend() } }}
                className={`h-[40px] flex-1 rounded-md border px-4 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none transition-colors ${
                  isChatLocked ? 'border-[#2a2a2a] bg-gray-800/50 cursor-not-allowed' : 'border-[#2a2a2a] bg-[#0f0f0f] focus:border-[#6e6d6f]'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || isChatLocked}
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md bg-white text-black transition-colors hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Summary sidebar (30%) ───────────────────────────────── */}
        <div className="flex min-h-0 flex-[30] flex-col">
          <div className="flex flex-col rounded-md border border-[#2a2a2a] bg-[#111111] h-full min-h-0 overflow-hidden">

            {/* Summary header */}
            <div className="shrink-0 border-b border-[#2a2a2a] px-5 py-3.5">
              <h3 className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">Order Summary</h3>
            </div>

            {/* ── 1. Activity Log (client) / Login Details (booster) ── */}
            {isBooster ? (
              <div className="flex-none px-5 py-4">
                <p className="font-mono text-[10px] tracking-[-0.07em] text-[#6e6d6f] uppercase mb-3">Login Details</p>
                {logins ? (
                  <div className="flex flex-col gap-2">
                    {([
                      { label: 'IGN',      value: logins.ign },
                      { label: 'Login',    value: logins.login },
                      { label: 'Password', value: logins.pwd },
                      { label: '2FA',      value: logins.twoFa ? 'Enabled' : 'Disabled' },
                    ] as { label: string; value: string }[]).map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="font-mono text-[9px] tracking-[0.04em] text-[#4a4a4a] uppercase">{label}</span>
                        <span className="font-mono text-[10px] tracking-[-0.04em] text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">No login details provided yet.</p>
                )}
              </div>
            ) : (
              <div className="flex-none overflow-y-auto max-h-[11rem] px-5 py-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2a2a2a] [&::-webkit-scrollbar-thumb]:rounded-full">
                <p className="font-mono text-[10px] tracking-[-0.07em] text-[#6e6d6f] uppercase mb-3">
                  Activity Log
                </p>
                <div className="relative flex flex-col">
                  {/* Vertical spine */}
                  <div className="absolute left-[4px] top-2 bottom-2 w-px bg-[#2a2a2a]" />
                  {activityLogs.map((event, i) => {
                    const isLast = event.active
                    return (
                      <div key={i} className={`relative flex items-start gap-3 ${i < activityLogs.length - 1 ? 'mb-3' : ''}`}>
                        <span className={`relative z-10 mt-[3px] shrink-0 h-[9px] w-[9px] rounded-full ${
                          isLast
                            ? 'bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                            : 'bg-[#111111] border border-[#3c3c3c]'
                        }`} />
                        <p className="font-mono text-[10px] tracking-[-0.05em] leading-snug">
                          <span className={isLast ? 'text-white font-medium' : 'text-[#6e6d6f]'}>{event.label}</span>
                          <span className="text-[#3c3c3c]"> — {event.time} — {event.date}</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 2. Live Order Status ──────────────────────────────────────── */}
            <div className="shrink-0 border-t border-[#2a2a2a] px-5 py-3 flex flex-col">
              {/* Header row: label + status badge */}
              <div className="flex items-center justify-between w-full">
                <p className="font-mono text-[10px] tracking-[-0.07em] text-[#6e6d6f] uppercase">
                  Live Order Status
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full font-mono text-[10px] tracking-[-0.05em] ${statusBadgeClass[liveStatus.status]}`}
                  style={{ animation: 'pulse-slow 3s ease-in-out infinite' }}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotClass[liveStatus.status]}`} />
                  {statusLabel[liveStatus.status]}
                </span>
              </div>

              {/* Rank progression — centered in remaining space */}
              <div className="flex items-center justify-center w-full mt-3">
                {/* Current rank */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <TierIcon tier={liveStatus.currentRankTier} size={32} />
                  <span className="font-mono text-[10px] tracking-[-0.04em] text-gray-400 text-center leading-tight">
                    {liveStatus.currentRankLabel}
                  </span>
                </div>

                {/* Stepped rank progress nodes */}
                {(() => {
                  const progressRanks = ranksInRange(d.startFull, d.endFull)
                  const progressIdx = progressRanks.findIndex((r) => r.label === liveStatus.currentRankLabel)
                  // Cap to 9 nodes max; sample evenly, always keeping first + last
                  const MAX_NODES = 9
                  let nodes = progressRanks
                  if (progressRanks.length > MAX_NODES) {
                    const step = (progressRanks.length - 1) / (MAX_NODES - 1)
                    nodes = Array.from({ length: MAX_NODES }, (_, i) =>
                      progressRanks[Math.round(i * step)]
                    )
                  }
                  return (
                    <div className="flex items-center gap-1 mx-3 shrink-0">
                      {nodes.map((rank) => {
                        const origIdx = progressRanks.findIndex((r) => r.label === rank.label)
                        const isDone    = origIdx <= progressIdx
                        const isCurrent = rank.label === liveStatus.currentRankLabel
                        return (
                          <div
                            key={rank.label}
                            title={rank.label}
                            className={[
                              'rounded-full transition-all duration-500 shrink-0',
                              isCurrent
                                ? 'h-3 w-3 ring-2 ring-green-400/60 bg-green-500'
                                : isDone
                                  ? 'h-2 w-2 bg-green-500'
                                  : 'h-2 w-2 bg-white/15',
                            ].join(' ')}
                          />
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Target rank */}
                <div className="flex flex-col items-center gap-1.5 shrink-0 opacity-40">
                  <TierIcon tier={d.endTier} size={32} />
                  <span className="font-mono text-[10px] tracking-[-0.04em] text-gray-400 text-center leading-tight">
                    {d.endFull}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Booster Control Panel ───────────────────────────────────── */}
            {isBooster && (
              <div className="flex-none border-t border-[#2a2a2a] px-5 py-3 flex flex-col gap-3">
                <p className="font-mono text-[10px] tracking-[-0.07em] text-[#6e6d6f] uppercase flex items-center gap-1.5">
                  <Shield size={10} strokeWidth={1.5} /> Live Status &amp; Progression
                </p>

                {/* Section A: Activity Status */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-[#4a4a4a] uppercase">Activity Status</span>
                  <div className="flex gap-1.5">
                    <select
                      value={activitySelect}
                      onChange={(e) => setActivitySelect(e.target.value)}
                      className="flex-1 h-[30px] rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 font-mono text-[10px] tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] appearance-none cursor-pointer"
                    >
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleUpdateActivity}
                      disabled={updatingActivity}
                      className="h-[30px] px-2.5 rounded-md border border-[#2a2a2a] font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white transition-colors disabled:opacity-40 flex items-center"
                    >
                      {updatingActivity ? <Loader2 size={9} className="animate-spin" /> : 'Update'}
                    </button>
                  </div>
                </div>

                {/* Section B: Rank Progression */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-[#4a4a4a] uppercase">Current Rank</span>
                  <p className="font-mono text-[9px] tracking-[-0.03em] text-[#3c3c3c]">{d.startFull} → {d.endFull}</p>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedRank}
                      onChange={(e) => setSelectedRank(e.target.value)}
                      className="flex-1 h-[30px] rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 font-mono text-[10px] tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] appearance-none cursor-pointer"
                    >
                      {rankOptions.map((r) => (
                        <option key={r.label} value={r.label}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBoosterUpdate}
                      disabled={updatingRankCtrl}
                      className="h-[30px] px-2.5 rounded-md bg-white font-mono text-[10px] font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      {updatingRankCtrl ? <Loader2 size={9} className="animate-spin" /> : <><RefreshCw size={9} strokeWidth={2} /> Update</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 3. Order Details — compact, never scrolls ────────────────── */}
            <div className="flex-none border-t border-[#2a2a2a] px-5 py-3">
              {/* Game icon + title */}
              <div className="flex items-center gap-2.5 mb-3">
                {gameIcon
                  ? <Image src={gameIcon} alt={d.gameName} width={28} height={28} className="h-7 w-7 shrink-0 rounded-md object-cover" />
                  : <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]"><span className="font-sans text-xs font-bold text-white">{d.gameName.charAt(0)}</span></div>
                }
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white truncate">{d.orderTitle}</p>
                  <p className="font-mono text-[9px] tracking-[-0.05em] text-[#6e6d6f]">{d.serviceLabel}</p>
                </div>
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: 'Game',    value: d.gameName },
                  { label: isBooster ? 'Your Earnings' : 'Price', value: `$${isBooster ? calculateBoosterPayout(d.price).boosterPayout.toFixed(2) : d.price.toFixed(2)}` },
                  { label: 'Server',  value: d.server },
                  { label: 'Date',    value: d.createdDate },
                  ...(d.startRR  ? [{ label: 'Start RR',  value: `${d.startRR} RR`  }] : []),
                  ...(d.targetRR ? [{ label: 'Target RR', value: `${d.targetRR} RR` }] : []),
                  ...(d.queue    ? [{ label: 'Queue',     value: d.queue             }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-white uppercase">{label}</span>
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] truncate">{value}</span>
                  </div>
                ))}
              </div>

              {/* Options + Agents — side by side */}
              <div className="flex gap-4 mt-2 pt-2 border-t border-[#222]">
                {/* Options */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-white uppercase">Options</span>
                  {d.extras.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {d.extras.map((extra) => (
                        <span key={extra} className="inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-px font-mono text-[9px] tracking-[-0.03em] text-[#a0a0a0]">{extra}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#3c3c3c]">None</span>
                  )}
                </div>

                {/* Agents */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-white uppercase">Agents</span>
                  {agents.length > 0 ? (
                    <div className="flex items-center">
                      {agents.map((agent, idx) => (
                        <div
                          key={agent.name}
                          title={agent.name}
                          style={{ marginLeft: idx === 0 ? 0 : '-6px', zIndex: idx }}
                          className="relative h-6 w-6 shrink-0 rounded-full border border-[#111] overflow-hidden"
                        >
                          {agent.avatarUrl ? (
                            <Image src={agent.avatarUrl} alt={agent.name} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#2a2a2a] font-mono text-[8px] font-bold text-white uppercase">
                              {agent.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#3c3c3c]">Unassigned</span>
                  )}
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt="Full size"
            className="max-h-[85vh] max-w-[85vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-6 font-mono text-xs tracking-tight text-white/50">
            {lightbox.senderName} • {lightbox.time}
          </div>
        </div>
      )}

      {proofUploadOpen && (
        <ProofUploadModal
          orderId={order.id}
          onCancel={() => setProofUploadOpen(false)}
          onSuccess={() => setProofUploadOpen(false)}
          onActivityReset={() => {
            setActivitySelect('Waiting Action')
            updateOrderActivity(order.id, 'Waiting Action').catch(console.error)
            onActivityUpdate('Waiting' as BoosterStatus)
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          title={CONFIRM_META[confirmAction].title}
          description={CONFIRM_META[confirmAction].description}
          confirmLabel={CONFIRM_META[confirmAction].label}
          danger={CONFIRM_META[confirmAction].danger}
          isLoading={isActionPending}
          onCancel={() => { if (!isActionPending) setConfirmAction(null) }}
          onConfirm={async () => {
            const action = confirmAction!
            const actorRole: 'Client' | 'Booster' = isBooster ? 'Booster' : 'Client'
            setIsActionPending(true)
            try {
              if (action === 'approve_release') {
                const result = await approveAndReleaseAction(order.id)
                if (result?.error) throw new Error(result.error)
              } else {
                const result = await executeOrderAction(order.id, action, actorRole)
                if (result?.error) throw new Error(result.error)
              }
              setConfirmAction(null)
            } catch (err) {
              console.error('[OrderAction] failed:', err)
              // Keep modal open on error so the user can retry or cancel
            } finally {
              setIsActionPending(false)
            }
          }}
        />
      )}
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrderDetailView({ order, messages = [], userId = '', defaultChat = false, isBooster = false }: {
  order: Order
  messages?: DBChatMessage[]
  userId?: string
  defaultChat?: boolean
  isBooster?: boolean
}) {
  const router = useRouter()
  const [loginsModalOpen, setLoginsModalOpen] = useState(false)
  const [deleteLoginsConfirm, setDeleteLoginsConfirm] = useState(false)
  const [chatOpen, setChatOpen] = useState(defaultChat)

  // Guards router.refresh() so it only fires once when the booster is first assigned.
  // Prevents the orders Realtime UPDATE (activity/progress writes) from triggering full page hydration on every change.
  const boosterHydratedRef = useRef(!!order.booster_id)

  // ── Single source of truth ──────────────────────────────────────────────────
  // liveOrder is the canonical order object for all UI derivations.
  // It starts from the server-fetched prop and is:
  //   (a) updated immediately by Supabase Realtime UPDATE payloads (flat columns)
  //   (b) re-synced to the full joined object after router.refresh()
  const [liveOrder, setLiveOrder] = useState<Order>(order)

  // When the server sends a fresh order prop (after router.refresh()), fully sync.
  // We key on booster_id + status + updatedAt to avoid infinite loops.
  useEffect(() => {
    setLiveOrder(order)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.booster_id, order.status, order.updated_at, JSON.stringify(order.details)])

  // ── submittedLogins ─────────────────────────────────────────────────────────
  // Seeded from liveOrder.details.logins (DB). Only overwrites if currently null
  // so optimistic UI from handleLoginSubmit is never clobbered.
  function extractLogins(o: Order) {
    const raw = (o.details as Record<string, unknown>)?.logins
    if (!raw || typeof raw !== 'object') return null
    const l = raw as Record<string, unknown>
    if (typeof l.ign === 'string' && typeof l.login === 'string') {
      return { ign: l.ign, login: l.login, pwd: typeof l.pwd === 'string' ? l.pwd : '', twoFa: !!l.twoFa }
    }
    return null
  }

  const [submittedLogins, setSubmittedLogins] = useState<{ ign: string; login: string; pwd: string; twoFa: boolean } | null>(
    () => extractLogins(order)
  )
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [chatToast, setChatToast] = useState<string | null>(null)

  // Re-sync logins from server when liveOrder updates (e.g. another session saved them)
  useEffect(() => {
    const fromDb = extractLogins(liveOrder)
    if (fromDb) {
      // Only fill in if we have no local state (don't overwrite optimistic UI)
      setSubmittedLogins(prev => prev ?? fromDb)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOrder.details])

  function showChatToast(msg: string) {
    setChatToast(msg)
    setTimeout(() => setChatToast(null), 3000)
  }

  async function handleLoginSubmit(data: { ign: string; login: string; pwd: string; twoFa: boolean }) {
    setSubmittedLogins(data)
    setLoginSuccess(true)
    setTimeout(() => setLoginSuccess(false), 2500)
    saveLoginsAction(order.id, data).catch(console.error)
  }

  // Derive all display values from liveOrder — NOT the stale prop
  const d = deriveDisplay(liveOrder)
  const gameIcon = GAME_ICONS[d.gameName]

  const createdDate = new Date(liveOrder.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Live rank status — seeded from DB (current_progress_rank / booster_activity_status in details)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(() => {
    const det = (order.details ?? {}) as Record<string, unknown>
    const progressRank   = det.current_progress_rank   as string | undefined
    const activityStatus = det.booster_activity_status as string | undefined
    const found = progressRank ? ALL_RANKS.find((r) => r.label === progressRank) : null
    return {
      status:           (activityStatus ? (ACTIVITY_TO_BOOSTER_STATUS[activityStatus] ?? 'Waiting') : 'Waiting'),
      currentRankLabel: found?.label ?? d.startFull,
      currentRankTier:  found?.tier  ?? d.startTier,
    }
  })

  // Keep liveStatus in sync when Realtime fires an orders UPDATE (details column changes)
  useEffect(() => {
    const det = (liveOrder.details ?? {}) as Record<string, unknown>
    const progressRank   = det.current_progress_rank   as string | undefined
    const activityStatus = det.booster_activity_status as string | undefined
    setLiveStatus((prev) => {
      const found = progressRank ? ALL_RANKS.find((r) => r.label === progressRank) : null
      const newLabel  = found?.label ?? prev.currentRankLabel
      const newTier   = found?.tier  ?? prev.currentRankTier
      const newStatus = activityStatus ? (ACTIVITY_TO_BOOSTER_STATUS[activityStatus] ?? prev.status) : prev.status
      if (newLabel === prev.currentRankLabel && newTier === prev.currentRankTier && newStatus === prev.status) return prev
      return { status: newStatus, currentRankLabel: newLabel, currentRankTier: newTier }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOrder.details])

  function handleRankUpdate(rankLabel: string, rankTier: string) {
    setLiveStatus((prev) => ({ ...prev, currentRankLabel: rankLabel, currentRankTier: rankTier }))
  }

  function handleActivityUpdate(status: BoosterStatus) {
    setLiveStatus((prev) => ({ ...prev, status }))
  }

  // ── Booster Control Panel state (non-chat view) ─────────────────────────────
  const [boosterRankSelect, setBoosterRankSelect] = useState(() => {
    const det = (order.details as Record<string, unknown>)
    const pr = det?.current_progress_rank as string | undefined
    return pr && ALL_RANKS.some((r) => r.label === pr) ? pr : d.startFull
  })
  const [boosterActivitySelect, setBoosterActivitySelect] = useState(() => {
    const det = (order.details as Record<string, unknown>)
    return String(det?.booster_activity_status ?? 'Waiting Action')
  })
  const [updatingRankMain,     setUpdatingRankMain]     = useState(false)
  const [updatingActivityMain, setUpdatingActivityMain] = useState(false)

  async function handleRankUpdateMain() {
    const opt = ALL_RANKS.find((r) => r.label === boosterRankSelect)
    if (!opt) return
    setUpdatingRankMain(true)
    handleRankUpdate(opt.label, opt.tier)
    await updateOrderProgress(liveOrder.id, boosterRankSelect).catch(console.error)
    setUpdatingRankMain(false)
  }

  async function handleActivityUpdateMain() {
    setUpdatingActivityMain(true)
    const newStatus = ACTIVITY_TO_BOOSTER_STATUS[boosterActivitySelect] ?? 'Waiting'
    handleActivityUpdate(newStatus)
    await updateOrderActivity(liveOrder.id, boosterActivitySelect).catch(console.error)
    setUpdatingActivityMain(false)
  }

  // ── Realtime: orders UPDATE ─────────────────────────────────────────────────
  // We merge payload.new directly into liveOrder so the UI snaps to State 3
  // the instant booster_id is written — no round-trip needed.
  // router.refresh() follows to hydrate the full booster profile from the server.
  useEffect(() => {
    const supabase = createClient()
    console.log(`[Realtime] Subscribing to orders UPDATE for order ${order.id}`)

    const channel = supabase
      .channel(`order-status:${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>
          console.log('[Realtime] orders UPDATE received — booster_id:', raw.booster_id, '| status:', raw.status)
          // Immediately merge flat columns into liveOrder
          setLiveOrder(prev => {
            const statusChanged  = raw.status     !== prev.status
            const boosterChanged = raw.booster_id !== prev.booster_id
            if (statusChanged || boosterChanged) {
              // Schedule the refresh outside the updater to avoid calling router.refresh()
              // during a React render (which causes the "setState during render" warning).
              if (!boosterHydratedRef.current) {
                boosterHydratedRef.current = true
              }
              setTimeout(() => router.refresh(), 0)
            }
            return {
              ...prev,
              status:          (raw.status          as Order['status'])  ?? prev.status,
              booster_id:      (raw.booster_id      as string | null)    ?? prev.booster_id,
              details:         (raw.details         as Order['details']) ?? prev.details,
              updated_at:      (raw.updated_at      as string)           ?? prev.updated_at,
              proof_image_url: (raw.proof_image_url as string | null)    ?? prev.proof_image_url,
              booster: raw.booster_id ? (prev.booster ?? null) : null,
            }
          })
        },
      )
      .subscribe((status, err) => {
        console.log('[Realtime] orders channel status:', status, err ? `| error: ${String(err)}` : '')
      })
    return () => {
      console.log(`[Realtime] Unsubscribing from orders channel for order ${order.id}`)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])

  return (
    <>
      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <div className="w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-7 h-full">

          {/* Header */}
          <div className="shrink-0 flex flex-col gap-5">
            <button onClick={() => chatOpen ? setChatOpen(false) : router.back()} className="flex w-fit items-center gap-1.5 font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:text-white">
              <ArrowLeft size={13} strokeWidth={1.5} /> {chatOpen ? 'Back to Order' : 'Go Back'}
            </button>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {gameIcon
                  ? <Image src={gameIcon} alt={d.gameName} width={52} height={52} className="h-[52px] w-[52px] shrink-0 rounded-md object-cover" />
                  : <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111111]"><span className="font-sans text-lg font-bold text-white">{d.gameName.charAt(0)}</span></div>
                }
                <div>
                  <h1 className="font-sans text-2xl font-semibold leading-tight tracking-[-0.07em] text-white">{d.orderTitle}</h1>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                    <span className="font-mono text-[10px]">{d.shortId}</span>
                    <CopyButton value={liveOrder.id} />
                    <span className="text-[#2a2a2a]">·</span>
                    <span>{d.serviceLabel}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span>{d.server}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span className="font-semibold text-white">${isBooster ? calculateBoosterPayout(d.price).boosterPayout.toFixed(2) : d.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!chatOpen && (() => {
                  const hasLogins  = !!submittedLogins
                  // Check booster_id (flat column, instantly updated by Realtime)
                  // OR the joined booster object (available after router.refresh())
                  const hasBooster = !!(liveOrder.booster_id || liveOrder.booster)
                  const canOpen    = hasLogins && hasBooster
                  return (
                    <div className="relative flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => {
                          if (!hasLogins) { showChatToast('Enter your login details.'); return }
                          if (!hasBooster) { showChatToast('Please wait for a booster to be assigned.'); return }
                          setChatOpen(true)
                        }}
                        className={`flex h-[42px] items-center gap-2 rounded-md bg-white px-5 font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90 ${
                          canOpen ? '' : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <MessageSquare size={14} strokeWidth={2} /> Open Chat
                      </button>
                      {chatToast && (
                        <div className="absolute top-full mt-2 right-0 z-50 flex items-center gap-2 whitespace-nowrap rounded-md border border-red-500/30 bg-[#1a0808] px-3 py-2 shadow-lg">
                          <AlertTriangle size={11} strokeWidth={1.5} className="shrink-0 text-red-400" />
                          <span className="font-mono text-[11px] tracking-[-0.04em] text-red-400">{chatToast}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Content */}
          {chatOpen ? (
            <ChatView
              order={liveOrder}
              d={d}
              gameIcon={gameIcon}
              onBack={() => setChatOpen(false)}
              liveStatus={liveStatus}
              onRankUpdate={handleRankUpdate}
              onActivityUpdate={handleActivityUpdate}
              isBooster={isBooster}
              initialMessages={messages}
              currentUserId={userId}
              logins={submittedLogins}
              activityLogs={[
                { label: 'Order created',     time: new Date(liveOrder.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: d.createdDate, active: false },
                { label: 'Payment confirmed', time: new Date(liveOrder.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: d.createdDate, active: false },
                { label: 'Booster assigned',  time: new Date(liveOrder.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: d.createdDate, active: false },
                { label: 'Order in progress', time: new Date(liveOrder.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: d.createdDate, active: true  },
              ]}
              agents={d.agentNames.map((n) => ({ name: n, avatarUrl: `/images/valorant/agents/${n.toLowerCase()}.webp` }))}
            />
          ) : (
            /* 2-column layout */
            <div className="grid grid-cols-[1fr_340px] gap-5 xl:grid-cols-[1fr_360px] items-stretch">

              {/* Left */}
              <div className="flex flex-col gap-5">
                <SectionCard title="Boost Data">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-6">
                    <DataField label="Start Tier"><TierIcon tier={d.startTier} />{d.startTier}</DataField>
                    <DataField label="Start Division">{d.startDivision || '—'}</DataField>
                    <DataField label="End Tier"><TierIcon tier={d.endTier} />{d.endTier}</DataField>
                    {(d.startRR || d.targetRR) && (
                      <div className="col-span-3 border-t border-[#2a2a2a] pt-5">
                        <div className="grid grid-cols-3 gap-x-6">
                          {d.startRR  && <DataField label="Start RR">{d.startRR} RR</DataField>}
                          {d.targetRR && <DataField label="Target RR">{d.targetRR} RR</DataField>}
                        </div>
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
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] ${COMPLETION_BADGE[d.completionStatus]}`}>
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
                        <DataField label={isBooster ? 'Your Earnings' : 'Price'}>${isBooster ? calculateBoosterPayout(d.price).boosterPayout.toFixed(2) : d.price.toFixed(2)}</DataField>
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
              <div className="flex flex-col gap-3 h-full">
                {isBooster ? (
                  /* ── Booster view: Read-only logins + Control Panel ─── */
                  <>
                    {/* Client Login Details — read-only for booster */}
                    <div className="flex-1 flex flex-col rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-4">
                      {submittedLogins ? (
                        <div className="flex flex-col gap-3 h-full">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
                              <KeyRound size={12} strokeWidth={1.5} className="text-green-400" />
                            </div>
                            <div>
                              <p className="font-mono text-[11px] font-semibold tracking-[-0.07em] text-white">Login Details</p>
                              <p className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">Provided by client</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 mt-1">
                            {[
                              { label: 'IGN',      value: submittedLogins.ign   || '—' },
                              { label: 'Login',    value: submittedLogins.login || '—' },
                              { label: 'Password', value: submittedLogins.pwd   || '—' },
                              { label: '2FA',      value: submittedLogins.twoFa ? 'Enabled' : 'Off' },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex flex-col gap-1 rounded-sm border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2.5 min-w-0">
                                <p className="font-mono text-[9px] font-medium tracking-[0.04em] uppercase text-[#6e6d6f]">{label}</p>
                                <div className="flex items-center gap-1 min-w-0">
                                  <p className="font-mono text-[11px] tracking-[-0.05em] text-white truncate flex-1">{value}</p>
                                  {label !== '2FA' && value !== '—' && <CopyButton value={value} />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                            <KeyRound size={15} strokeWidth={1.5} className="text-[#4a4a4a]" />
                          </div>
                          <div>
                            <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Login Details</p>
                            <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Waiting for client to<br />provide credentials.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Booster Control Panel */}
                    <div className="flex-none rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-4 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[#2a2a2a] pb-3">
                        <Shield size={13} strokeWidth={1.5} className="text-[#6e6d6f]" />
                        <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">Live Status &amp; Progression</p>
                      </div>

                      {/* Section A: Activity Status */}
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-[#6e6d6f] uppercase">Activity Status</span>
                        <select
                          value={boosterActivitySelect}
                          onChange={(e) => setBoosterActivitySelect(e.target.value)}
                          className="h-[38px] w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] appearance-none cursor-pointer"
                        >
                          {ACTIVITY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleActivityUpdateMain}
                          disabled={updatingActivityMain}
                          className="flex h-[36px] w-full items-center justify-center rounded-md border border-[#2a2a2a] font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white transition-colors disabled:opacity-40"
                        >
                          {updatingActivityMain ? <Loader2 size={12} className="animate-spin" /> : 'Update Status'}
                        </button>
                      </div>

                      {/* Section B: Rank Progression */}
                      <div className="flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
                        <span className="font-mono text-[9px] font-medium tracking-[0.04em] text-[#6e6d6f] uppercase">Rank Progression</span>
                        <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">{d.startFull} → {d.endFull}</p>
                        <select
                          value={boosterRankSelect}
                          onChange={(e) => setBoosterRankSelect(e.target.value)}
                          className="h-[38px] w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none focus:border-[#6e6d6f] appearance-none cursor-pointer"
                        >
                          {ranksInRange(d.startFull, d.endFull).map((r) => (
                            <option key={r.label} value={r.label}>{r.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleRankUpdateMain}
                          disabled={updatingRankMain}
                          className="flex h-[36px] w-full items-center justify-center gap-1.5 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.05em] text-black hover:bg-white/90 transition-colors disabled:opacity-40"
                        >
                          {updatingRankMain ? <Loader2 size={12} className="animate-spin" /> : <><RefreshCw size={11} strokeWidth={2} /> Update Rank</>}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── Client view: Booster card + Login card + Payment card ─── */
                  <>
                    {/* Booster card */}
                    <div className="flex-1 flex flex-col rounded-md border border-[#2a2a2a] bg-[#111111] px-5 py-4">
                  {/* State 3: check booster_id (flat, from Realtime) OR joined booster object (from server refresh) */}
                  {(liveOrder.booster_id || d.boosterName) ? (
                    // State 3: Booster assigned
                    <div className="flex items-center gap-3 h-full">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
                        <UserCheck size={16} strokeWidth={1.5} className="text-green-500" />
                      </div>
                      <div>
                        <p className="font-mono text-xs tracking-[-0.07em] text-green-500 font-semibold">Booster Assigned</p>
                        <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#6e6d6f]">We found a match! You can now communicate<br />with your booster via Open Chat.</p>
                      </div>
                    </div>
                  ) : submittedLogins ? (
                    // State 2: Logins saved, searching for booster
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                        <Loader2 size={15} strokeWidth={1.5} className="text-[#6e6d6f] animate-spin" />
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white animate-pulse">Searching available boosters...</p>
                        <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Your details are securely saved. We are<br />currently matching you with a professional.</p>
                      </div>
                    </div>
                  ) : (
                    // State 1: No logins yet
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                        <Users size={15} strokeWidth={1.5} className="text-[#4a4a4a]" />
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Boosters Found</p>
                        <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Once your order is paid, a booster<br />will be assigned to your order.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Login card */}
                <div className="flex-1 flex flex-col rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-4">
                  {submittedLogins ? (
                    <div className="flex flex-col gap-3 h-full">
                      {/* Header row: icon + title + action buttons */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
                          <KeyRound size={12} strokeWidth={1.5} className="text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-semibold tracking-[-0.07em] text-white">
                            Logins Saved
                            {loginSuccess && (
                              <span className="ml-1.5 inline-flex items-center gap-1 text-green-400">
                                <CheckCircle2 size={10} strokeWidth={2} />
                                <span className="text-[9px] tracking-[-0.03em]">Saved</span>
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">Encrypted &amp; secured</p>
                        </div>
                        {/* Icon-only action buttons in top-right */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setLoginsModalOpen(true)}
                            title="Edit logins"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <Pencil size={11} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => setDeleteLoginsConfirm(true)}
                            title="Delete saved logins"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6e6d6f] transition-colors hover:bg-red-500/5 hover:text-red-500"
                          >
                            <Trash2 size={11} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                      {/* 2-col data grid with bordered cells */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {[
                          { label: 'IGN',      value: submittedLogins.ign || '—' },
                          { label: 'Login',    value: submittedLogins.login.length > 2 ? submittedLogins.login.slice(0, 2) + '•'.repeat(Math.min(submittedLogins.login.length - 2, 6)) : '••' },
                          { label: 'Password', value: '••••••••' },
                          { label: '2FA',      value: submittedLogins.twoFa ? 'Enabled' : 'Off' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col gap-1 rounded-sm border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2.5 min-w-0">
                            <p className="font-mono text-[9px] font-medium tracking-[0.04em] uppercase text-[#6e6d6f]">{label}</p>
                            <p className="font-mono text-[11px] tracking-[-0.05em] text-white truncate">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                      <button
                        onClick={() => setLoginsModalOpen(true)}
                        title="Add logins"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
                      >
                        <Plus size={16} strokeWidth={1.5} />
                      </button>
                      <div>
                        <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Logins Provided</p>
                        <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Add your account credentials<br />for the booster to access.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment card */}
                <div className="flex-none rounded-md border border-[#2a2a2a] bg-[#111111] px-4 py-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f] uppercase">Total Amount</p>
                      <p className="mt-0.5 font-sans text-2xl font-bold tracking-[-0.07em] text-white">${d.price.toFixed(2)}</p>
                    </div>
                    <span className={`mt-0.5 inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[-0.03em] ${PAYMENT_BADGE[d.paymentStatus]}`}>
                      {d.paymentStatus}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
                    <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em]">
                      {d.discountCode ? (
                        <>
                          <Tag size={12} strokeWidth={1.5} className="shrink-0 text-green-400" />
                          <span className="text-green-400">{d.discountCode}</span>
                          <span className="ml-auto rounded border border-green-500/30 bg-green-500/10 px-1.5 py-px text-[10px] text-green-400">Applied</span>
                        </>
                      ) : (
                        <>
                          <Tag size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" />
                          <span className="text-[#6e6d6f]">No Discount</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                      <CreditCard size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" /> Debit/Credit Cards (Ecommpay)
                    </div>
                    <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">
                      <Calendar size={12} strokeWidth={1.5} className="shrink-0 text-[#4a4a4a]" /> {createdDate}
                    </div>
                  </div>
                  {(d.paymentStatus === 'Unpaid' || d.paymentStatus === 'Processing') && (
                    <button className="flex h-[40px] w-full items-center justify-center gap-1.5 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.05em] text-black transition-colors hover:bg-white/90">
                      Pay Now <ChevronRight size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
                  </>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {loginsModalOpen && (
        <AddLoginsModal
          gameName={d.gameName}
          orderTitle={d.orderTitle}
          serviceLabel={d.serviceLabel}
          gameIcon={gameIcon}
          onClose={() => setLoginsModalOpen(false)}
          onSubmit={handleLoginSubmit}
          initialValues={submittedLogins ?? undefined}
        />
      )}

      {deleteLoginsConfirm && (
        <ConfirmModal
          title="Delete Saved Logins?"
          description="This will permanently remove your saved account credentials. You will need to re-enter them for the booster to continue."
          confirmLabel="Delete Logins"
          danger
          onCancel={() => setDeleteLoginsConfirm(false)}
          onConfirm={() => {
            setSubmittedLogins(null)
            setLoginSuccess(false)
            setDeleteLoginsConfirm(false)
            deleteLoginsAction(liveOrder.id).catch(console.error)
          }}
        />
      )}
    </>
  )
}
