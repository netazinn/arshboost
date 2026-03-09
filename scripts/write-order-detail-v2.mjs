import { writeFileSync } from 'fs'

// TIERS in order (no Radiant/Unranked for divisions, Radiant has no division)
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal']
const TIERS_WITH_RADIANT = [...TIERS, 'Radiant']
const ROMAN = ['1', '2', '3']

// Build all rank options: Iron 1, Iron 2, Iron 3, Bronze 1... Immortal 3, Radiant
function buildAllRanks() {
  const ranks = []
  for (const tier of TIERS) {
    for (const div of ROMAN) {
      ranks.push({ label: `${tier} ${div}`, tier, division: div })
    }
  }
  ranks.push({ label: 'Radiant', tier: 'Radiant', division: '' })
  return ranks
}

const ALL_RANKS = buildAllRanks()

const content = `'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, MessageSquare, Copy, Users, KeyRound,
  Plus, CreditCard, Calendar, Tag,
  ChevronRight, Lock, Eye, EyeOff, X,
  CheckCircle2, AlertTriangle, HelpCircle, XCircle,
  MoreVertical, Send, Shield, ImagePlus, RefreshCw,
} from 'lucide-react'
import { GAME_ICONS } from '@/lib/config/game-icons'
import type { Order } from '@/types'

// ─── Valorant tiers (shared) ──────────────────────────────────────────────────

const ALL_TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant']
const DIVISIONS = ['1', '2', '3']

interface RankOption { label: string; tier: string; division: string }

function buildAllRanks(): RankOption[] {
  const ranks: RankOption[] = []
  for (const tier of ALL_TIERS.filter((t) => t !== 'Radiant')) {
    for (const div of DIVISIONS) {
      ranks.push({ label: \`\${tier} \${div}\`, tier, division: div })
    }
  }
  ranks.push({ label: 'Radiant', tier: 'Radiant', division: '' })
  return ranks
}

const ALL_RANKS = buildAllRanks()

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
type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Need Action'
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
    boosterName:      order.booster?.username ?? order.booster?.email ?? null,
    startTier:        start.tier,
    startDivision:    start.division,
    endTier:          end.tier,
    startRR:          String(d.start_rr ?? ''),
    server:           String(d.server ?? '—'),
    queue:            String(d.queue_type ?? ''),
    extras,
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
      src={\`/images/valorant/ranks/\${slug}.webp\`}
      alt={tier}
      width={size}
      height={size}
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

// ─── Confirmation Modal ───────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[400px] mx-4 rounded-md border border-[#2a2a2a] bg-[#111]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <div className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-full \${danger ? 'bg-red-500/10' : 'bg-white/5'}\`}>
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
            className={\`flex h-[40px] flex-1 items-center justify-center rounded-md font-mono text-xs font-semibold tracking-[-0.07em] transition-colors \${
              danger
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-white text-black hover:bg-white/90'
            }\`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Logins Modal ─────────────────────────────────────────────────────────

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

// ─── Chat messages type ───────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  sender: 'client' | 'booster' | 'system'
  text?: string
  imageUrl?: string
  time: string
}

const MOCK_MESSAGES: ChatMessage[] = [
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

type ConfirmAction = 'mark_completed' | 'open_dispute' | 'need_support' | 'cancel_request' | null

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
  isBooster?: boolean
}

function ChatView({ order, d, gameIcon, onBack, liveStatus, onRankUpdate, isBooster = false }: ChatViewProps) {
  const [messages, setMessages]   = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [input, setInput]         = useState('')
  const [kebabOpen, setKebabOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // Booster rank update
  const rankOptions = ranksInRange(d.startFull, d.endFull)
  const [selectedRank, setSelectedRank] = useState(liveStatus.currentRankLabel)

  const kebabRef  = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

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

  function sendMessage() {
    const text = input.trim()
    if (!text) return
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: isBooster ? 'booster' : 'client', text, time: now }])
    setInput('')
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

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: isBooster ? 'booster' : 'client', imageUrl: dataUrl, time: now }])
  }

  function handleBoosterUpdate() {
    const opt = rankOptions.find((r) => r.label === selectedRank)
    if (!opt) return
    onRankUpdate(opt.label, opt.tier)
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, {
      id: String(Date.now()),
      sender: 'system',
      text: \`Booster updated current rank to \${opt.label}\`,
      time: now,
    }])
  }

  const CONFIRM_META: Record<NonNullable<ConfirmAction>, { title: string; description: string; label: string; danger: boolean }> = {
    mark_completed: {
      title: 'Mark as Completed?',
      description: 'This will mark your order as completed. The booster will be paid once you confirm.',
      label: 'Mark Completed',
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

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-5">

        {/* ── Chat panel (70%) ─────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-[70] flex-col rounded-md border border-[#2a2a2a] bg-[#191919]">

          {/* Chat header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#2a2a2a] px-5 py-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={15} strokeWidth={1.5} className="text-[#6e6d6f]" />
              <span className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Order Chat</span>
              <span className="inline-flex items-center rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[-0.03em] text-yellow-400">
                {d.completionStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isBooster ? (
                /* Booster rank update */
                <>
                  <select
                    value={selectedRank}
                    onChange={(e) => setSelectedRank(e.target.value)}
                    className="h-[34px] rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f] appearance-none cursor-pointer"
                  >
                    {rankOptions.map((r) => (
                      <option key={r.label} value={r.label}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBoosterUpdate}
                    className="flex h-[34px] items-center gap-1.5 rounded-md bg-white px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90"
                  >
                    <RefreshCw size={12} strokeWidth={2} /> Update
                  </button>
                </>
              ) : (
                /* Client: Mark Completed */
                <button
                  onClick={() => setConfirmAction('mark_completed')}
                  className="flex h-[34px] items-center gap-1.5 rounded-md bg-white px-4 font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90"
                >
                  <CheckCircle2 size={13} strokeWidth={2} /> Mark Completed
                </button>
              )}

              {/* Kebab menu */}
              <div ref={kebabRef} className="relative">
                <button
                  onClick={() => setKebabOpen((v) => !v)}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
                >
                  <MoreVertical size={15} strokeWidth={1.5} />
                </button>
                {kebabOpen && (
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
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-2">
                      <div className="h-px flex-1 bg-[#2a2a2a]" />
                      <span className="font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">{msg.text}</span>
                      <div className="h-px flex-1 bg-[#2a2a2a]" />
                    </div>
                  )
                }
                const isClient = msg.sender === 'client'
                return (
                  <div key={msg.id} className={\`flex \${isClient ? 'justify-end' : 'justify-start'}\`}>
                    <div className={\`max-w-[70%]\`}>
                      {!isClient && (
                        <p className="mb-1 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">Booster</p>
                      )}
                      {msg.imageUrl ? (
                        <img
                          src={msg.imageUrl}
                          alt="uploaded"
                          className={\`max-w-full rounded-md object-cover \${isClient ? 'rounded-br-none' : 'rounded-bl-none'}\`}
                          style={{ maxHeight: 240 }}
                        />
                      ) : (
                        <div className={\`rounded-md px-3.5 py-2.5 font-mono text-xs tracking-[-0.05em] leading-relaxed \${
                          isClient
                            ? 'bg-white text-black rounded-br-none'
                            : 'border border-[#2a2a2a] bg-[#141414] text-[#d0d0d0] rounded-bl-none'
                        }\`}>
                          {msg.text}
                        </div>
                      )}
                      <p className={\`mt-1 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a] \${isClient ? 'text-right' : 'text-left'}\`}>{msg.time}</p>
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
            <div className="flex items-center gap-2">
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
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
              >
                <ImagePlus size={15} strokeWidth={1.5} />
              </button>

              <input
                type="text"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                className="h-[40px] flex-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none transition-colors focus:border-[#6e6d6f]"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-md bg-white text-black transition-colors hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Summary sidebar (30%) ───────────────────────────────── */}
        <div className="flex min-h-0 flex-[30] flex-col">
          <div className="flex flex-col rounded-md border border-[#2a2a2a] bg-[#191919] h-full">

            {/* Summary header */}
            <div className="shrink-0 border-b border-[#2a2a2a] px-5 py-3.5">
              <h3 className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">Order Summary</h3>
            </div>

            {/* Summary content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Game + title */}
              <div className="flex items-center gap-3">
                {gameIcon
                  ? <Image src={gameIcon} alt={d.gameName} width={36} height={36} className="h-9 w-9 shrink-0 rounded-md object-cover" />
                  : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]"><span className="font-sans text-sm font-bold text-white">{d.gameName.charAt(0)}</span></div>
                }
                <div>
                  <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">{d.orderTitle}</p>
                  <p className="mt-0.5 font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f]">{d.serviceLabel}</p>
                </div>
              </div>

              {/* Key-value rows */}
              <div className="flex flex-col gap-1.5 border-t border-[#2a2a2a] pt-3.5">
                {[
                  { label: 'Game',    value: d.gameName },
                  { label: 'Service', value: d.serviceLabel },
                  { label: 'Server',  value: d.server },
                  { label: 'Price',   value: \`$\${d.price.toFixed(2)}\` },
                  { label: 'Date',    value: d.createdDate },
                  ...(d.queue   ? [{ label: 'Queue',    value: d.queue    }] : []),
                  ...(d.startRR ? [{ label: 'Start RR', value: d.startRR }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">{label}</span>
                    <span className="font-mono text-[11px] tracking-[-0.07em] text-white">{value}</span>
                  </div>
                ))}
              </div>

              {/* Boost options / extras */}
              {d.extras.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-[#2a2a2a] pt-3">
                  <span className="font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">Boost Options</span>
                  <div className="flex flex-wrap gap-1.5">
                    {d.extras.map((extra) => (
                      <span key={extra} className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] tracking-[-0.03em] text-[#a0a0a0]">{extra}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Divider → Live Order Status ─────────────────────── */}
              <div className="border-t border-[#2a2a2a] pt-3.5">
                <p
                  className="font-mono text-[10px] tracking-[-0.07em] text-[#6e6d6f] uppercase mb-3"
                  style={{ animation: 'pulse-slow 3s ease-in-out infinite' }}
                >
                  Live Order Status
                </p>

                {/* Current Rank row */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">Current Rank</span>
                  <div className="flex items-center gap-1.5">
                    <TierIcon tier={liveStatus.currentRankTier} size={18} />
                    <span className="font-mono text-[11px] tracking-[-0.07em] text-white">{liveStatus.currentRankLabel}</span>
                  </div>
                </div>

                {/* Booster status row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] tracking-[-0.07em] text-[#6e6d6f]">Status</span>
                  <div
                    className="flex items-center gap-1.5"
                    style={{ animation: 'pulse-slow 3s ease-in-out infinite' }}
                  >
                    <span className={\`inline-block h-2 w-2 rounded-full \${statusDotClass[liveStatus.status]}\`} />
                    <span className="font-mono text-[11px] tracking-[-0.07em] text-white">{liveStatus.status}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          title={CONFIRM_META[confirmAction].title}
          description={CONFIRM_META[confirmAction].description}
          confirmLabel={CONFIRM_META[confirmAction].label}
          danger={CONFIRM_META[confirmAction].danger}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => { setConfirmAction(null) }}
        />
      )}
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrderDetailView({ order, defaultChat = false, isBooster = false }: {
  order: Order
  defaultChat?: boolean
  isBooster?: boolean
}) {
  const router = useRouter()
  const [loginsModalOpen, setLoginsModalOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(defaultChat)

  const d = deriveDisplay(order)
  const gameIcon = GAME_ICONS[d.gameName]

  const createdDate = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Live order status — starts at the order's current rank, Waiting
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({
    status: 'Waiting',
    currentRankLabel: d.startFull,
    currentRankTier: d.startTier,
  })

  function handleRankUpdate(rankLabel: string, rankTier: string) {
    setLiveStatus({ status: 'Online', currentRankLabel: rankLabel, currentRankTier: rankTier })
  }

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
                    <span className="font-semibold text-white">$\${d.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!chatOpen && (
                  <button
                    onClick={() => setChatOpen(true)}
                    className="flex h-[42px] items-center gap-2 rounded-md bg-white px-5 font-mono text-xs font-semibold tracking-[-0.07em] text-black transition-colors hover:bg-white/90"
                  >
                    <MessageSquare size={14} strokeWidth={2} /> Open Chat
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {chatOpen ? (
            <ChatView
              order={order}
              d={d}
              gameIcon={gameIcon}
              onBack={() => setChatOpen(false)}
              liveStatus={liveStatus}
              onRankUpdate={handleRankUpdate}
              isBooster={isBooster}
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
                        <DataField label="Price">$\${d.price.toFixed(2)}</DataField>
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
              <div className="flex flex-col gap-4 h-full">

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
                <div className="rounded-md border border-[#2a2a2a] bg-[#191919] px-5 py-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                      <KeyRound size={16} strokeWidth={1.5} className="text-[#4a4a4a]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-[-0.07em] text-white">No Logins Provided</p>
                      <p className="mt-0.5 font-mono text-[11px] leading-snug tracking-[-0.05em] text-[#4a4a4a]">Click the button below to add the<br />logins of your account.</p>
                    </div>
                    <button onClick={() => setLoginsModalOpen(true)}
                      className="flex h-[34px] w-full items-center justify-center gap-2 rounded-md border border-[#2a2a2a] bg-transparent font-mono text-xs tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white">
                      <Plus size={13} strokeWidth={1.5} /> Add Logins
                    </button>
                  </div>
                </div>

                {/* Payment card */}
                <div className="flex-1 rounded-md border border-[#2a2a2a] bg-[#191919] px-5 py-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] tracking-[-0.1em] text-[#6e6d6f] uppercase">Total Amount</p>
                      <p className="mt-1 font-sans text-2xl font-bold tracking-[-0.07em] text-white">$\${d.totalWithFee.toFixed(2)}</p>
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
                  {(d.paymentStatus === 'Unpaid' || d.paymentStatus === 'Processing') && (
                    <button className="flex h-[40px] w-full items-center justify-center gap-1.5 rounded-md bg-white font-mono text-xs font-semibold tracking-[-0.05em] text-black transition-colors hover:bg-white/90">
                      Pay Now <ChevronRight size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>

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
        />
      )}
    </>
  )
}
`

writeFileSync('/Users/ruzgar/Desktop/arshboost/src/components/features/dashboard/OrderDetailView.tsx', content)
console.log('✓ Written')
