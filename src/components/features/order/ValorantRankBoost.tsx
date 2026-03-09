'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'
import {
  RANK_ORDER,
  calculateRankBoostPrice,
} from '@/lib/valorant-price-calculator'
import { calculateWinBoostPrice } from '@/lib/win-boost-calculator'
import { calculatePlacementsPrice } from '@/lib/placements-boost-calculator'
import { calculateUnratedPrice, type UnratedGameMode } from '@/lib/unrated-boost-calculator'
import { ValorantPlacementsBoost, UnrankedIcon } from './ValorantPlacementsBoost'
import { ValorantUnratedBoost } from './ValorantUnratedBoost'
import { createOrderAction } from '@/lib/actions/orders'

// ─── Constants ────────────────────────────────────────────────────────────────

// Smoothly counts from previous value to target over ~400ms
function useCountUp(target: number, decimals = 2, duration = 400): string {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  const raf  = useRef<number>(0)

  useEffect(() => {
    const from  = prev.current
    const to    = target
    prev.current = target
    if (from === to) return

    const start = performance.now()
    const tick  = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // ease out cubic
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * ease)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return display.toFixed(decimals)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Iron',      slug: 'iron',      color: '#8C8C8C' },
  { name: 'Bronze',    slug: 'bronze',    color: '#C8874B' },
  { name: 'Silver',    slug: 'silver',    color: '#D4D4D4' },
  { name: 'Gold',      slug: 'gold',      color: '#E5B941' },
  { name: 'Platinum',  slug: 'platinum',  color: '#3FC4C4' },
  { name: 'Diamond',   slug: 'diamond',   color: '#9B6EFF' },
  { name: 'Ascendant', slug: 'ascendant', color: '#3FCA71' },
  { name: 'Immortal',  slug: 'immortal',  color: '#FF4655' },
]

const TIERS_WITH_RADIANT = [
  ...TIERS,
  { name: 'Radiant', slug: 'radiant', color: '#FFFFA0' },
]

const ROMAN = ['I', 'II', 'III']
const RR_RANGES = ['0-20', '21-40', '41-60', '61-80', '81-100']
const SERVERS = ['Europe', 'North America', 'Asia Pacific', 'Brazil', 'Latin America']
const SERVICES = ['Rank Boost', 'Win Boost', 'Placements Boost', 'Unrated Boost']
const SERVICE_SLUGS = ['rank-boost', 'win-boost', 'placements-boost', 'unrated-boost']

const AGENTS = [
  'Jett', 'Reyna', 'Raze', 'Phoenix', 'Brimstone', 'Viper',
  'Omen', 'Killjoy', 'Cypher', 'Sova', 'Sage', 'Breach',
  'Yoru', 'Skye', 'Astra', 'KAY/O', 'Chamber', 'Neon',
  'Fade', 'Harbor', 'Gekko', 'Deadlock', 'Iso', 'Clove',
  'Vyse', 'Tejo', 'Waylay', 'Veto',
]

function agentSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const VALID_DISCOUNT_CODES: Record<string, number> = {
  ARSH10:  0.10,
  ARSH20:  0.20,
  BOOST10: 0.10,
}

function tierColor(slug: string) {
  return TIERS.find(t => t.slug === slug)?.color ?? '#ffffff'
}

function rankLabel(tier: string, division: number, rr?: number) {
  const name = tier.charAt(0).toUpperCase() + tier.slice(1)
  if (tier === 'immortal') return rr != null ? `Immortal ${rr} RR` : 'Immortal'
  return `${name} ${ROMAN[division - 1] ?? ''}`
}

function absIndex(tier: string, division: number) {
  const idx = RANK_ORDER.indexOf(tier as typeof RANK_ORDER[number])
  return idx * 3 + (division - 1)
}

// ─── Sub-component: RankSelector ─────────────────────────────────────────────

interface RankSelectorProps {
  label: string
  subtitle: string
  selectedTier: string
  selectedDivision: number
  onTierChange: (t: string) => void
  onDivisionChange: (d: number) => void
  minAbsIndex?: number
  rr?: number
  onRRChange?: (v: number) => void
  rrMin?: number
  rrMax?: number
}

function RankSelector({
  label,
  subtitle,
  selectedTier,
  selectedDivision,
  onTierChange,
  onDivisionChange,
  minAbsIndex = -1,
  rr = 0,
  onRRChange,
  rrMin = 0,
  rrMax = 750,
}: RankSelectorProps) {
  const color = tierColor(selectedTier)
  const isImmortal = selectedTier === 'immortal'

  // Local display state — allows free typing without forcing min mid-input
  const [rrInput, setRrInput] = useState(String(rr))

  // Sync display when prop changes (e.g. from +/- buttons)
  useEffect(() => { setRrInput(String(rr)) }, [rr])

  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col gap-4">
      {/* Header row: icon + title */}
      <div className="flex items-stretch gap-3">
        {/* Rank icon circle */}
        <div
          className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#111111]"
          style={{ boxShadow: `0 0 0 2px ${color}33` }}
        >
          <Image
            src={`/images/valorant/ranks/${selectedTier}.webp`}
            alt={selectedTier}
            width={40}
            height={40}
            className="object-contain drop-shadow-md"
          />
        </div>
        {/* Title bar */}
        <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
          <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">{label}</p>
          <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">{subtitle}</p>
        </div>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-8 gap-2">
        {TIERS.map((tier) => {
          const isSelected = selectedTier === tier.slug
          return (
            <button
              key={tier.slug}
              onClick={() => {
                onTierChange(tier.slug)
                onDivisionChange(1)
              }}
              className="flex h-[62px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
              style={{ border: isSelected ? `1.5px solid ${tier.color}` : '1.5px solid transparent' }}
            >
              <Image
                src={`/images/valorant/ranks/${tier.slug}.webp`}
                alt={tier.name}
                width={28}
                height={28}
                className="object-contain"
                style={{ opacity: 1 }}
              />
            </button>
          )
        })}
      </div>

      {/* Division grid OR Immortal RR stepper */}
      {isImmortal ? (
        <div className="grid grid-cols-8 gap-2">
          <div className="col-span-3 flex items-center gap-1.5">
            <button
              onClick={() => onRRChange?.(Math.max(rrMin, rr - 1))}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-lg text-[#a0a0a0] transition-all duration-200 hover:bg-[#1a1a1a] hover:text-white hover:border-[#6e6d6f]"
            >
              −
            </button>
            <div className="flex h-[46px] flex-1 items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#111111] px-3 transition-all duration-200">
              <span className="font-mono text-xs tracking-[-0.07em] text-[#6e6d6f]">RR</span>
              <input
                type="number"
                min={rrMin}
                max={rrMax}
                value={rrInput}
                onChange={e => setRrInput(e.target.value)}
                onBlur={() => {
                  const parsed = Number(rrInput)
                  const clamped = isNaN(parsed) ? rrMin : Math.min(rrMax, Math.max(rrMin, parsed))
                  setRrInput(String(clamped))
                  onRRChange?.(clamped)
                }}
                className="w-full bg-transparent font-mono text-sm tracking-[-0.07em] text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <button
              onClick={() => onRRChange?.(Math.min(rrMax, rr + 1))}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-lg text-[#a0a0a0] transition-all duration-200 hover:bg-[#1a1a1a] hover:text-white hover:border-[#6e6d6f]"
            >
              +
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-2">
          {[1, 2, 3].map((div) => {
            const abs = absIndex(selectedTier, div)
            const isDisabled = abs <= minAbsIndex
            const isSelected = selectedDivision === div
            return (
              <button
                key={div}
                disabled={isDisabled}
                onClick={() => onDivisionChange(div)}
                className="flex h-[46px] items-center justify-center rounded-md bg-[#111111] font-mono text-sm tracking-[-0.07em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ border: isSelected ? `1.5px solid ${color}` : '1.5px solid transparent',
                         color: isSelected ? color : '#6e6d6f' }}
              >
                {ROMAN[div - 1]}
              </button>
            )
          })}
          {[4, 5, 6, 7, 8].map((i) => <div key={i} />)}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: OptionRow ─────────────────────────────────────────────────

interface OptionRowProps {
  label: string
  badge?: string
  active: boolean
  disabled?: boolean
  isInput?: boolean
  inputValue?: string
  onInputChange?: (v: string) => void
  onInputSubmit?: () => void
  onToggle: () => void
  onOpen?: () => void // for popup options
  isPopup?: boolean
  agentAvatars?: string[]
  discountStatus?: 'idle' | 'applied' | 'invalid'
}

function OptionRow({
  label,
  badge,
  active,
  disabled = false,
  isInput = false,
  inputValue = '',
  onInputChange,
  onInputSubmit,
  onToggle,
  onOpen,
  isPopup = false,
  agentAvatars,
  discountStatus = 'idle',
}: OptionRowProps) {
  if (isInput) {
    return (
      <div className={`flex h-[52px] items-center gap-3 rounded-md border bg-[#0f0f0f] px-4 transition-all duration-200 ${discountStatus === 'applied' ? 'border-green-500/60' : 'border-[#2a2a2a] focus-within:border-[#6e6d6f]'}`}>
        <input
          type="text"
          placeholder={label}
          value={inputValue}
          onChange={e => onInputChange?.(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onInputSubmit?.()}
          className="flex-1 bg-transparent font-mono text-sm leading-none tracking-[-0.07em] text-[#a0a0a0] placeholder:text-[#6e6d6f] focus:outline-none"
        />
        {discountStatus === 'applied' && (
          <span className="font-mono text-xs leading-none text-[#22c55e]">Applied</span>
        )}
        {discountStatus === 'invalid' && (
          <span className="font-mono text-xs text-[#ef4444]">Invalid</span>
        )}
        {inputValue && discountStatus !== 'applied' && (
          <button
            onClick={onInputSubmit}
            className="font-mono text-xs text-[#a0a0a0] hover:text-white"
          >
            Apply
          </button>
        )}
      </div>
    )
  }

  if (isPopup) {
    return (
      <button
        disabled={disabled}
        onClick={onOpen}
        className="flex h-[52px] w-full items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[#1a1a1a]"
        style={{ outline: active ? '1.5px solid #6e6d6f' : 'none', outlineOffset: '-1.5px' }}
      >
        <span className="font-mono text-sm tracking-[-0.07em] text-[#a0a0a0]">{label}</span>
        <div className="flex items-center gap-1.5">
          {agentAvatars && agentAvatars.length > 0 && (
            <div className="flex items-center">
              {agentAvatars.slice(0, 3).map((slug, i) => (
                <div
                  key={slug}
                  className="relative h-5 w-5 overflow-hidden rounded-full border border-[#2a2a2a]"
                  style={{ marginLeft: i > 0 ? '-6px' : 0 }}
                >
                  <Image src={`/images/valorant/agents/${slug}.webp`} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <ChevronDown size={14} strokeWidth={1.5} className="text-[#6e6d6f]" />
        </div>
      </button>
    )
  }

  return (
    <button
      disabled={disabled}
      onClick={onToggle}
      className="flex h-[52px] w-full items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[#1a1a1a]"
      style={{ outline: active ? '1.5px solid #6e6d6f' : 'none', outlineOffset: '-1.5px' }}
    >
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm tracking-[-0.07em] text-[#a0a0a0]">{label}</span>
        {badge && (
          <span className="px-1.5 py-0.5 font-mono text-[10px] font-semibold rounded border border-green-500/30 bg-green-500/10 text-green-400 leading-none">
            {badge}
          </span>
        )}
      </span>
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-150"
        style={{ border: active ? '1.5px solid #22c55e' : '1px solid #6e6d6f',
                 backgroundColor: active ? '#22c55e' : 'transparent' }}
      >
        {active && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ValorantRankBoost() {
  const params = useParams()
  const router = useRouter()
  const activeService = Math.max(0, SERVICE_SLUGS.indexOf(params.service as string))

  // Ranks
  const [currentTier, setCurrentTier]         = useState('iron')
  const [currentDivision, setCurrentDivision] = useState(1)
  const [currentRRRange, setCurrentRRRange]   = useState('0-20')
  const [currentImmortalRR, setCurrentImmortalRR] = useState(0)
  const [desiredTier, setDesiredTier]         = useState('bronze')
  const [desiredDivision, setDesiredDivision] = useState(1)
  const [desiredImmortalRR, setDesiredImmortalRR] = useState(10)
  const [server, setServer]                   = useState('Europe')

  // Queue
  const [queueType, setQueueType] = useState<'solo' | 'duo'>('solo')

  // Options
  const [priorityBoost,    setPriorityBoost]    = useState(false)
  const [streamGames,      setStreamGames]      = useState(false)
  const [soloOnlyQueue,    setSoloOnlyQueue]    = useState(false)
  const [bonusWin,         setBonusWin]         = useState(false)
  const [premiumCoaching,  setPremiumCoaching]  = useState(false)

  // Reset all add-on options whenever the queue type changes (Solo ↔ Duo)
  useEffect(() => {
    setPriorityBoost(false)
    setStreamGames(false)
    setSoloOnlyQueue(false)
    setBonusWin(false)
    setPremiumCoaching(false)
  }, [queueType])

  // Agents
  const [showAgentModal,   setShowAgentModal]   = useState(false)
  const [selectedAgents,   setSelectedAgents]   = useState<string[]>([])

  // Discount
  const [discountInput,    setDiscountInput]    = useState('')
  const [discountStatus,   setDiscountStatus]   = useState<'idle' | 'applied' | 'invalid'>('idle')
  const [discountRate,     setDiscountRate]     = useState(0)

  // Checkout
  const [checkoutError,     setCheckoutError]     = useState<string | null>(null)
  const [isCheckingOut,     startCheckoutTransition] = useTransition()

  // Win Boost state
  const [wbTier,     setWbTier]     = useState('iron')
  const [wbDivision, setWbDivision] = useState(1)
  const [wbWins,     setWbWins]     = useState(3)
  const [wbServer,   setWbServer]   = useState('Europe')

  // Placements Boost state
  const [plTier,     setPlTier]     = useState('unranked')
  const [plDivision, setPlDivision] = useState(1)
  const [plMatches,  setPlMatches]  = useState(3)
  const [plServer,   setPlServer]   = useState('Europe')

  // Unrated Boost state
  const [ubMode,     setUbMode]     = useState<UnratedGameMode>('unrated')
  const [ubMatches,  setUbMatches]  = useState(5)
  const [ubServer,   setUbServer]   = useState('Europe')

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentAbs = absIndex(currentTier, currentDivision)
  const desiredAbs = absIndex(desiredTier, desiredDivision)
  const isDuo      = queueType === 'duo'

  function handleDesiredTierChange(t: string) {
    setDesiredTier(t)
    setDesiredDivision(1)
  }

  function handleDesiredDivisionChange(d: number) {
    // Don't allow going below current
    if (absIndex(desiredTier, d) <= currentAbs) return
    setDesiredDivision(d)
  }

  function handleCurrentTierChange(t: string) {
    setCurrentTier(t)
    setCurrentDivision(1)
    // Push desired up if needed
    const newCurrent = absIndex(t, 1)
    if (absIndex(desiredTier, desiredDivision) <= newCurrent) {
      const newDesiredAbs = newCurrent + 1
      const newTierIdx = Math.min(Math.floor(newDesiredAbs / 3), TIERS.length - 1)
      const newDiv     = (newDesiredAbs % 3) + 1
      setDesiredTier(TIERS[newTierIdx]?.slug ?? 'bronze')
      setDesiredDivision(Math.min(newDiv, 3))
    }
  }

  function handleCurrentDivisionChange(d: number) {
    setCurrentDivision(d)
    const newCurrent = absIndex(currentTier, d)
    if (absIndex(desiredTier, desiredDivision) <= newCurrent) {
      const newDesiredAbs = newCurrent + 1
      const newTierIdx = Math.min(Math.floor(newDesiredAbs / 3), TIERS.length - 1)
      const newDiv     = (newDesiredAbs % 3) + 1
      setDesiredTier(TIERS[newTierIdx]?.slug ?? 'bronze')
      setDesiredDivision(Math.min(newDiv, 3))
    }
  }

  function applyDiscount() {
    const rate = VALID_DISCOUNT_CODES[discountInput.toUpperCase()]
    if (rate != null) {
      setDiscountRate(rate)
      setDiscountStatus('applied')
    } else {
      setDiscountStatus('invalid')
    }
  }

  function toggleAgent(agent: string) {
    setSelectedAgents(prev =>
      prev.includes(agent)
        ? prev.filter(a => a !== agent)
        : prev.length < 3
          ? [...prev, agent]
          : prev
    )
  }

  const price = useMemo(() => {
    const base = calculateRankBoostPrice(
      { tier: currentTier, division: currentDivision, rr: currentTier === 'immortal' ? currentImmortalRR : undefined },
      { tier: desiredTier, division: desiredDivision, rr: desiredTier === 'immortal' ? desiredImmortalRR : undefined },
      { currentRRRange: currentTier === 'immortal' ? '0-20' : currentRRRange, server, isDuo },
    )

    let mult = 1.0
    if (priorityBoost)                   mult += 0.25
    if (streamGames   && !isDuo)         mult += 0.20
    if (soloOnlyQueue && !isDuo)         mult += 0.60
    if (premiumCoaching && isDuo)        mult += 0.25
    if (bonusWin) {
      const divs = Math.max(0, desiredAbs - currentAbs)
      mult += divs * 0.03
    }

    const orig = Number((base.original * mult).toFixed(2))
    let   fin  = Number((base.final    * mult).toFixed(2))
    if (discountRate > 0) fin = Number((fin * (1 - discountRate)).toFixed(2))
    return { original: orig, final: fin }
  }, [
    currentTier, currentDivision, currentImmortalRR, desiredTier, desiredDivision, desiredImmortalRR,
    currentRRRange, server, isDuo, priorityBoost, streamGames,
    soloOnlyQueue, bonusWin, premiumCoaching, discountRate,
    currentAbs, desiredAbs,
  ])

  const displayOriginal = useCountUp(price.original)
  const displayFinal    = useCountUp(price.final)

  const winPrice = useMemo(() =>
    calculateWinBoostPrice(
      { tier: wbTier, division: wbDivision, wins: wbWins },
      {
        server: wbServer,
        isDuo,
        priorityCompletion: priorityBoost,
        streamGames,
        soloOnlyQueue,
        premiumCoaching,
      },
    )
  , [wbTier, wbDivision, wbWins, wbServer, isDuo, priorityBoost, streamGames, soloOnlyQueue, premiumCoaching])

  const wbDisplayOriginal = useCountUp(winPrice.original)
  const wbDisplayFinal    = useCountUp(winPrice.final)

  const placementsPrice = useMemo(() =>
    calculatePlacementsPrice(
      { tier: plTier, division: plDivision, matches: plMatches },
      {
        server:              plServer,
        isDuo,
        priorityCompletion: priorityBoost,
        streamGames,
        soloOnlyQueue,
        premiumCoaching,
      },
    )
  , [plTier, plDivision, plMatches, plServer, isDuo, priorityBoost, streamGames, soloOnlyQueue, premiumCoaching])

  const plDisplayOriginal = useCountUp(placementsPrice.original)
  const plDisplayFinal    = useCountUp(placementsPrice.final)

  const unratedPrice = useMemo(() =>
    calculateUnratedPrice({
      gameMode:           ubMode,
      matches:            ubMatches,
      server:             ubServer,
      isDuo,
      priorityCompletion: priorityBoost,
      streamGames,
      soloOnlyQueue,
      premiumCoaching,
    })
  , [ubMode, ubMatches, ubServer, isDuo, priorityBoost, streamGames, soloOnlyQueue, premiumCoaching])

  const ubDisplayOriginal = useCountUp(unratedPrice.original)
  const ubDisplayFinal    = useCountUp(unratedPrice.final)

  const activeDisplayOriginal = activeService === 0 ? displayOriginal : activeService === 1 ? wbDisplayOriginal : activeService === 2 ? plDisplayOriginal : activeService === 3 ? ubDisplayOriginal : displayOriginal
  const activeDisplayFinal    = activeService === 0 ? displayFinal    : activeService === 1 ? wbDisplayFinal    : activeService === 2 ? plDisplayFinal    : activeService === 3 ? ubDisplayFinal    : displayFinal
  const activePrice           = activeService === 0 ? price.final     : activeService === 1 ? winPrice.final    : activeService === 2 ? placementsPrice.final : unratedPrice.final

  function handleCheckout() {
    setCheckoutError(null)
    const serviceSlug = SERVICE_SLUGS[activeService] ?? 'rank-boost'

    const tierName = (slug: string) => TIERS_WITH_RADIANT.find(t => t.slug === slug)?.name ?? slug

    // Returns Immortal division number (1/2/3) based on RR thresholds
    const immortalDivFromRR = (rr: number): number => {
      if (rr >= 200) return 3
      if (rr >= 90)  return 2
      return 1
    }

    // Formats a rank label, with special handling for Immortal RR
    const rankLabel = (tier: string, division: number, immortalRR: number): string => {
      if (tier === 'immortal') {
        const div = immortalDivFromRR(immortalRR)
        return `Immortal ${div} (${immortalRR}RR)`
      }
      return `${tierName(tier)} ${division}`
    }

    let details: Record<string, unknown> = {}
    if (activeService === 0) {
      details = {
        current_rank: rankLabel(currentTier, currentDivision, currentImmortalRR),
        target_rank:  rankLabel(desiredTier, desiredDivision, desiredImmortalRR),
        server,
        queue:        queueType,
        rr_range:     currentRRRange,
        ...(currentTier === 'immortal' ? { start_immortal_rr: currentImmortalRR } : {}),
        ...(desiredTier  === 'immortal' ? { target_immortal_rr: desiredImmortalRR  } : {}),
        options: { priority: priorityBoost, stream: streamGames, solo_queue: soloOnlyQueue, bonus_win: bonusWin, agents: selectedAgents },
      }
    } else if (activeService === 1) {
      details = { tier: tierName(wbTier), division: wbDivision, wins: wbWins, server: wbServer }
    } else if (activeService === 2) {
      details = { tier: tierName(plTier), division: plDivision, matches: plMatches, server: plServer }
    } else {
      details = { game_mode: ubMode, matches: ubMatches, server: ubServer }
    }

    startCheckoutTransition(async () => {
      const result = await createOrderAction({ serviceSlug, price: activePrice, details })
      if (result.error) {
        setCheckoutError(result.error)
        return
      }
      router.push('/dashboard/orders')
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Main layout — always 12-col grid so tabs are scoped to left column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div className="col-span-1 lg:col-span-7 flex flex-col gap-6">

          {/* Service tabs — width locked to left column */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SERVICES.map((svc, i) => (
              <button
                key={svc}
                onClick={() => router.push(`/valorant/${SERVICE_SLUGS[i]}`, { scroll: false })}
                className="flex h-[54px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-sm tracking-[-0.07em] transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{ border: activeService === i ? '1.5px solid #ffffff' : '1.5px solid transparent',
                         color: activeService === i ? '#ffffff' : '#a0a0a0' }}
              >
                {svc}
              </button>
            ))}
          </div>

          {activeService === 0 ? (<>

            {/* Current Rank */}
            <RankSelector
              label="Current Rank"
              subtitle="Select your current tier and division."
              selectedTier={currentTier}
              selectedDivision={currentDivision}
              onTierChange={handleCurrentTierChange}
              onDivisionChange={handleCurrentDivisionChange}
              rr={currentImmortalRR}
              onRRChange={setCurrentImmortalRR}
              rrMin={0}
              rrMax={750}
            />

            {/* RR Range + Server dropdowns (RR range hidden for immortal) */}
            <div className="grid grid-cols-2 gap-3">
              {currentTier !== 'immortal' && (
                <div className="relative col-span-1">
                  <select
                    value={currentRRRange}
                    onChange={e => setCurrentRRRange(e.target.value)}
                    className="h-[52px] w-full appearance-none rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] focus:outline-none hover:border-[#6e6d6f] transition-all cursor-pointer"
                  >
                    {RR_RANGES.map(r => (
                      <option key={r} value={r}>{r} RR</option>
                    ))}
                  </select>
                  <ChevronDown size={13} strokeWidth={1.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6d6f]" />
                </div>
              )}
              <div className="relative col-span-1">
                <select
                  value={server}
                  onChange={e => setServer(e.target.value)}
                  className="h-[52px] w-full appearance-none rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] focus:outline-none hover:border-[#6e6d6f] transition-all cursor-pointer"
                >
                  {SERVERS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={13} strokeWidth={1.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6d6f]" />
              </div>
            </div>

            {/* Desired Rank */}
            <RankSelector
              label="Desired Rank"
              subtitle="Select your desired tier and division."
              selectedTier={desiredTier}
              rr={desiredImmortalRR}
              onRRChange={setDesiredImmortalRR}
              rrMin={10}
              rrMax={800}
              selectedDivision={desiredDivision}
              onTierChange={handleDesiredTierChange}
              onDivisionChange={handleDesiredDivisionChange}
              minAbsIndex={currentAbs}
            />
          </>) : activeService === 1 ? (
            /* ── Win Boost Left Panel ─────────────────────────────────────── */
            <div className="flex flex-col gap-6 h-full">

              {/* Current Rank box */}
              <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-stretch gap-3">
                  <div
                    className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#111111]"
                    style={{ boxShadow: `0 0 0 2px ${(TIERS_WITH_RADIANT.find(t => t.slug === wbTier)?.color ?? '#fff') + '33'}` }}
                  >
                    <Image
                      src={`/images/valorant/ranks/${wbTier}.webp`}
                      alt={wbTier}
                      width={40}
                      height={40}
                      className="object-contain drop-shadow-md"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
                    <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">Current Rank</p>
                    <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">Select your current tier and division.</p>
                  </div>
                </div>

                {/* Row 1: Iron → Immortal */}
                <div className="grid grid-cols-8 gap-2">
                  {TIERS_WITH_RADIANT.slice(0, 8).map((tier) => {
                    const isSelected = wbTier === tier.slug
                    return (
                      <button
                        key={tier.slug}
                        onClick={() => setWbTier(tier.slug)}
                        className="flex h-[62px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
                        style={{ border: isSelected ? `1.5px solid ${tier.color}` : '1.5px solid transparent' }}
                      >
                        <Image
                          src={`/images/valorant/ranks/${tier.slug}.webp`}
                          alt={tier.name}
                          width={28}
                          height={28}
                          className="object-contain"
                        />
                      </button>
                    )
                  })}
                </div>

                {/* Row 2: Division buttons (cols 1-3) + Radiant pinned to col 8 */}
                <div className="grid grid-cols-8 gap-2">
                  {/* Division buttons — disabled (not unmounted) when Radiant is selected */}
                  <div className={`col-span-3 grid grid-cols-3 gap-2 transition-opacity duration-200 ${wbTier === 'radiant' ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                    {[1, 2, 3].map((div) => {
                      const wbColor = TIERS_WITH_RADIANT.find(t => t.slug === wbTier)?.color ?? '#fff'
                      const isSelected = wbDivision === div
                      return (
                        <button
                          key={div}
                          onClick={() => setWbDivision(div)}
                          className="flex h-[46px] items-center justify-center rounded-md bg-[#111111] font-mono text-sm tracking-[-0.07em] transition-all duration-200"
                          style={{
                            border: isSelected ? `1.5px solid ${wbColor}` : '1.5px solid transparent',
                            color: isSelected ? wbColor : '#6e6d6f',
                          }}
                        >
                          {ROMAN[div - 1]}
                        </button>
                      )
                    })}
                  </div>
                  {/* Radiant — pinned under Immortal (col 8) */}
                  {(() => {
                    const radiant = TIERS_WITH_RADIANT[8]
                    const isSelected = wbTier === 'radiant'
                    return (
                      <button
                        onClick={() => { setWbTier('radiant'); setWbDivision(1) }}
                        className="col-start-8 flex h-[46px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
                        style={{ border: isSelected ? `1.5px solid ${radiant.color}` : '1.5px solid transparent' }}
                      >
                        <Image
                          src="/images/valorant/ranks/radiant.webp"
                          alt="Radiant"
                          width={28}
                          height={28}
                          className="object-contain"
                        />
                      </button>
                    )
                  })()}
                </div>
              </div>

              {/* Server dropdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative col-span-1">
                  <select
                    value={wbServer}
                    onChange={e => setWbServer(e.target.value)}
                    className="h-[52px] w-full appearance-none rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] focus:outline-none hover:border-[#6e6d6f] transition-all cursor-pointer"
                  >
                    {SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={13} strokeWidth={1.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6d6f]" />
                </div>
              </div>

              {/* Wins Amount box */}
              <div className="flex-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col justify-between gap-10">
                {/* Header row: circle badge + title bar */}
                <div className="flex items-stretch gap-3">
                  <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#111111]">
                    <span className="font-sans text-3xl font-bold tracking-[-0.07em] text-white">{wbWins}</span>
                  </div>
                  <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
                    <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">Wins Amount</p>
                    <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">Select your desired amount of wins.</p>
                  </div>
                </div>
                {/* Progress indicator + Slider */}
                <div className="flex flex-col gap-5">
                  {/* Segmented progress indicator — clickable segments */}
                  <div className="flex gap-[3px]">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => setWbWins(n)}
                        className="flex-1 h-10 transition-all duration-200 cursor-pointer"
                        style={{
                          background: n <= wbWins ? 'white' : '#1e1e1e',
                          boxShadow: n <= wbWins ? '0 0 8px rgba(255,255,255,0.35)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                  {/* Slider */}
                  <div className="flex flex-col gap-2 mt-4">
                    <style>{`
                      .wb-slider { -webkit-appearance: none; appearance: none; background: transparent; }
                      .wb-slider::-webkit-slider-runnable-track { height: 3px; background: linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) calc((${wbWins - 1}) / 4 * 100%), #2a2a2a calc((${wbWins - 1}) / 4 * 100%), #2a2a2a 100%); }
                      .wb-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: white; margin-top: -6.5px; cursor: pointer; box-shadow: 0 0 8px rgba(255,255,255,0.25); }
                      .wb-slider::-moz-range-track { height: 3px; background: #2a2a2a; }
                      .wb-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: white; border: none; cursor: pointer; }
                      .wb-slider::-moz-range-progress { height: 3px; background: rgba(255,255,255,0.8); }
                    `}</style>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={wbWins}
                      onChange={e => setWbWins(Number(e.target.value))}
                      className="wb-slider w-full cursor-pointer"
                    />
                    <div className="flex justify-between">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className="font-mono text-[10px] tracking-[-0.05em]" style={{ color: n <= wbWins ? 'rgba(255,255,255,0.5)' : '#3a3a3a' }}>{n}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeService === 2 ? (
            /* ── Placements Boost Left Panel ──────────────────────────────── */
            <ValorantPlacementsBoost
              plTier={plTier}       setPlTier={setPlTier}
              plDivision={plDivision} setPlDivision={setPlDivision}
              plMatches={plMatches}  setPlMatches={setPlMatches}
              plServer={plServer}    setPlServer={setPlServer}
            />
          ) : activeService === 3 ? (
            /* ── Unrated Boost Left Panel ───────────────────────────────── */
            <ValorantUnratedBoost
              ubMode={ubMode}       setUbMode={setUbMode}
              ubMatches={ubMatches} setUbMatches={setUbMatches}
              ubServer={ubServer}   setUbServer={setUbServer}
            />
          ) : (
            /* Placeholder for future services */
            <div className="flex flex-1 items-center justify-center py-24">
              <p className="font-mono text-sm tracking-[-0.07em] text-[#6e6d6f]">
                {SERVICES[activeService]} — coming soon.
              </p>
            </div>
          )}
        </div>{/* end left col-span-7 */}

        {/* ── Right panel — all four services ──────────────────────── */}
        {(activeService === 0 || activeService === 1 || activeService === 2 || activeService === 3) && (
          <div className="col-span-1 lg:col-span-5 flex flex-col gap-6 h-full">

            {/* Header */}
            <div className="flex h-[54px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f]">
              <p className="font-mono text-sm tracking-[-0.07em] text-white" style={{ animation: 'pulse-slow 3s ease-in-out infinite' }}>
                Add extra options to your boost order.
              </p>
            </div>

            {/* Order summary */}
            <div className="flex h-[74px] items-center justify-center gap-4 rounded-md border border-[#2a2a2a] bg-[#0f0f0f]">
              {activeService === 0 ? (<>
                <div className="flex items-center gap-2">
                  <Image src={`/images/valorant/ranks/${currentTier}.webp`} alt={currentTier} width={28} height={28} className="object-contain drop-shadow-sm" />
                  <span className="font-mono text-sm tracking-[-0.07em]" style={{ color: tierColor(currentTier) }}>
                    {rankLabel(currentTier, currentDivision, currentTier === 'immortal' ? currentImmortalRR : undefined)}
                  </span>
                </div>
                <span className="font-mono text-base text-[#6e6d6f]">→</span>
                <div className="flex items-center gap-2">
                  <Image src={`/images/valorant/ranks/${desiredTier}.webp`} alt={desiredTier} width={28} height={28} className="object-contain drop-shadow-sm" />
                  <span className="font-mono text-sm tracking-[-0.07em]" style={{ color: tierColor(desiredTier) }}>
                    {rankLabel(desiredTier, desiredDivision, desiredTier === 'immortal' ? desiredImmortalRR : undefined)}
                  </span>
                </div>
              </>) : activeService === 1 ? (
                <div className="flex items-center gap-3">
                  <Image src={`/images/valorant/ranks/${wbTier}.webp`} alt={wbTier} width={28} height={28} className="object-contain drop-shadow-sm" />
                  <span className="font-mono text-sm tracking-[-0.07em]" style={{ color: TIERS_WITH_RADIANT.find(t => t.slug === wbTier)?.color ?? '#fff' }}>
                    {wbTier === 'radiant' ? 'Radiant' : wbTier === 'immortal' ? `Immortal ${wbDivision}` : `${wbTier.charAt(0).toUpperCase() + wbTier.slice(1)} ${ROMAN[wbDivision - 1]}`}
                  </span>
                  <span className="font-mono text-base text-[#6e6d6f]">•</span>
                  <span className="font-mono text-sm tracking-[-0.07em] text-[#a0a0a0]">{wbWins} Win{wbWins > 1 ? 's' : ''}</span>
                </div>
              ) : activeService === 2 ? (
                /* Placements Boost summary */
                <div className="flex items-center gap-3">
                  {plTier === 'unranked' ? (
                    <UnrankedIcon size={28} />
                  ) : (
                    <Image src={`/images/valorant/ranks/${plTier}.webp`} alt={plTier} width={28} height={28} className="object-contain drop-shadow-sm" />
                  )}
                  <span className="font-mono text-sm tracking-[-0.07em]" style={{ color: plTier === 'unranked' ? '#5a5a5a' : (TIERS_WITH_RADIANT.find(t => t.slug === plTier)?.color ?? '#fff') }}>
                    {plTier === 'unranked' ? 'Unranked' : plTier === 'radiant' ? 'Radiant' : `${plTier.charAt(0).toUpperCase() + plTier.slice(1)} ${ROMAN[plDivision - 1]}`}
                  </span>
                  <span className="font-mono text-base text-[#6e6d6f]">•</span>
                  <span className="font-mono text-sm tracking-[-0.07em] text-[#a0a0a0]">{plMatches} Match{plMatches > 1 ? 'es' : ''}</span>
                </div>
              ) : (
                /* Unrated Boost summary */
                <div className="flex items-center gap-3">
                  {ubMode === 'unrated' ? (
                    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="16" cy="16" r="13" fill="#1a1a1a" stroke="#FFFFA0" strokeWidth="1.5" />
                      <circle cx="16" cy="16" r="7" fill="#FFFFA0" opacity="0.85" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="16,2 30,16 16,30 2,16" fill="#1a1a1a" stroke="#FF4655" strokeWidth="1.5" />
                      <polygon points="16,8 24,16 16,24 8,16" fill="#FF4655" opacity="0.8" />
                    </svg>
                  )}
                  <span className="font-mono text-sm tracking-[-0.07em] text-white">
                    {ubMode === 'unrated' ? 'Unrated' : 'Featured'}
                  </span>
                  <span className="font-mono text-base text-[#6e6d6f]">•</span>
                  <span className="font-mono text-sm tracking-[-0.07em] text-[#a0a0a0]">{ubMatches} Match{ubMatches > 1 ? 'es' : ''}</span>
                </div>
              )}
            </div>

            {/* Solo / Duo toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setQueueType('solo')}
                className="flex h-[52px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-sm tracking-[-0.07em] transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{ outline: queueType === 'solo' ? '1.5px solid #ffffff' : 'none', outlineOffset: '-1.5px',
                         color: queueType === 'solo' ? '#ffffff' : '#a0a0a0' }}
              >
                Solo
              </button>
              <button
                onClick={() => setQueueType('duo')}
                className="flex h-[52px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-sm tracking-[-0.07em] transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{ outline: queueType === 'duo' ? '1.5px solid #ffffff' : 'none', outlineOffset: '-1.5px',
                         color: queueType === 'duo' ? '#ffffff' : '#a0a0a0' }}
              >
                Duo
              </button>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left col */}
              <div className="flex flex-col gap-3">
                <OptionRow label="Priority Completion" badge="+25%" active={priorityBoost} onToggle={() => setPriorityBoost(p => !p)} />
                <OptionRow label="Solo Only Queue" badge="+60%"      active={soloOnlyQueue} disabled={isDuo}   onToggle={() => setSoloOnlyQueue(p => !p)} />
                <OptionRow label="+1 Bonus Win"    badge="Auto"      active={bonusWin}      disabled={activeService === 1 || activeService === 2 || activeService === 3} onToggle={() => setBonusWin(p => !p)} />
                <OptionRow
                  label={`Agent Selection${selectedAgents.length > 0 ? ` (${selectedAgents.length})` : ''}`}
                  active={selectedAgents.length > 0}
                  disabled={isDuo}
                  isPopup
                  agentAvatars={selectedAgents.map(agentSlug)}
                  onToggle={() => {}}
                  onOpen={() => setShowAgentModal(true)}
                />
              </div>
              {/* Right col */}
              <div className="flex flex-col gap-3">
                <OptionRow label="Stream Games"    badge="+20%" active={streamGames}     disabled={isDuo}  onToggle={() => setStreamGames(p => !p)} />
                <OptionRow label="Premium Coaching" badge="+25%" active={premiumCoaching} disabled={!isDuo} onToggle={() => setPremiumCoaching(p => !p)} />
                <OptionRow
                  label="Discount Code"
                  active={discountStatus === 'applied'}
                  isInput
                  inputValue={discountInput}
                  onInputChange={v => { setDiscountInput(v); setDiscountStatus('idle'); setDiscountRate(0) }}
                  onInputSubmit={applyDiscount}
                  discountStatus={discountStatus}
                  onToggle={() => {}}
                />
                <OptionRow
                  label={`Your Agents${selectedAgents.length > 0 ? ` (${selectedAgents.length})` : ''}`}
                  active={selectedAgents.length > 0}
                  disabled={!isDuo}
                  isPopup
                  agentAvatars={selectedAgents.map(agentSlug)}
                  onToggle={() => {}}
                  onOpen={() => setShowAgentModal(true)}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#2a2a2a]" />

            {/* Total price + Checkout — pinned to bottom */}
            <div className="mt-auto flex flex-col gap-3">

            {/* Total price */}
            <div className="flex items-end justify-between rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-5 py-4">
              <p className="font-sans text-4xl font-semibold tracking-[-0.07em] text-[#a0a0a0] leading-none">
                Total Price:
              </p>
              <div className="flex items-end gap-2">
                <span className="relative mb-0.5 inline-block font-mono text-base font-semibold tracking-[-0.07em] text-[#a0a0a0]">
                  ${activeDisplayOriginal}
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <line x1="5" y1="95" x2="95" y2="5" stroke="#a0a0a0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                </span>
                <span className="font-sans text-4xl font-semibold tracking-[-0.07em] text-white leading-none" style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.45)', textShadow: '0 0 12px rgba(255,255,255,0.12)' }}>
                  ${activeDisplayFinal}
                </span>
              </div>
            </div>

            {/* Checkout */}
            {checkoutError && (
              <p className="text-red-400 text-xs font-mono tracking-[-0.04em] text-center">{checkoutError}</p>
            )}
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="flex h-[60px] w-full items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] transition-all duration-300 hover:bg-[#1a1a1a] hover:text-white hover:border-[#6e6d6f] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? 'Processing…' : 'Checkout'}
            </button>
            </div>{/* end mt-auto wrapper */}
          </div>
        )}
      </div>

      {/* ── Agent Selection Modal ──────────────────────────────────────────── */}
      {showAgentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAgentModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] rounded-md border border-[#2a2a2a] bg-[#111] p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-sans text-base font-semibold tracking-[-0.07em] text-white">
                  Select Agents
                </p>
                <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#6e6d6f]">
                  Choose up to 3 agents (free)
                </p>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] transition-all duration-200 hover:border-[#6e6d6f] hover:text-white"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {AGENTS.map(agent => {
                const isSelected = selectedAgents.includes(agent)
                const isDisabled = !isSelected && selectedAgents.length >= 3
                return (
                  <button
                    key={agent}
                    disabled={isDisabled}
                    onClick={() => toggleAgent(agent)}
                    className="flex flex-col items-center justify-center gap-1 rounded-md bg-[#111111] py-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[#1a1a1a]"
                    style={{ border: isSelected ? '1.5px solid #a0a0a0' : '1.5px solid transparent' }}
                  >
                    <div className="relative h-9 w-9 overflow-hidden rounded-sm">
                      <Image
                        src={`/images/valorant/agents/${agentSlug(agent)}.webp`}
                        alt={agent}
                        fill
                        className="object-cover object-top"
                      />
                    </div>
                    <span
                      className="font-mono text-[8px] leading-none tracking-[-0.03em]"
                      style={{ color: isSelected ? '#ffffff' : '#6e6d6f' }}
                    >
                      {agent}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setShowAgentModal(false)}
              className="mt-4 flex h-[46px] w-full items-center justify-center rounded-md bg-[#111111] font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] transition-all duration-200 hover:text-white border border-[#2a2a2a] hover:border-[#6e6d6f]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
