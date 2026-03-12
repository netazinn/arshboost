import type { ServiceType } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceInput {
  basePrice: number
  serviceType: ServiceType
  /** Specific to rank_boost: number of rank tiers to climb */
  rankDelta?: number
  /** Specific to win_boost / placement_matches / unrated_matches: number of games */
  gameCount?: number
  /** Duo boost adds a fixed premium */
  isDuo?: boolean
  /** Priority queue surcharge */
  isPriority?: boolean
  /** VPN protection surcharge */
  hasVpn?: boolean
  /** Appearance offline surcharge */
  isOfflineMode?: boolean
}

export interface PriceBreakdown {
  base: number
  rankDeltaFee: number
  gameCountFee: number
  duoPremium: number
  priorityFee: number
  vpnFee: number
  offlineModeFee: number
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Multiplier per additional rank tier for rank_boost */
const RANK_DELTA_MULTIPLIER = 0.12 // +12% per tier above 1

/** Per-game flat rate for win/placement/unrated services */
const PER_GAME_RATE: Record<Extract<ServiceType, 'win_boost' | 'placement_matches' | 'unrated_matches'>, number> = {
  win_boost: 3.5,
  placement_matches: 4.0,
  unrated_matches: 3.0,
}

/** Flat surcharges (in dollars) */
const SURCHARGES = {
  duo: 0.3,     // +30% of base — overridable via SurchargeOverrides
  priority: 0.2, // +20% of base — overridable via SurchargeOverrides
  vpn: 2.0,      // flat $2
  offlineMode: 1.5, // flat $1.50
} as const

/** Optional overrides for the dynamic surcharges (fetched from global_settings). */
export interface SurchargeOverrides {
  /** Fraction of subtotal added for duo boost, e.g. 0.30 = +30% */
  duo?: number
  /** Fraction of subtotal added for priority queue, e.g. 0.20 = +20% */
  priority?: number
}

// ─── Calculator ───────────────────────────────────────────────────────────────

/**
 * Server-side price calculation. All inputs validated; returns an immutable breakdown.
 * Must NOT be called from client components — import only in Server Actions / Route Handlers.
 */
export function calculatePrice(input: PriceInput, overrides?: SurchargeOverrides): PriceBreakdown {
  const {
    basePrice,
    serviceType,
    rankDelta = 1,
    gameCount = 1,
    isDuo = false,
    isPriority = false,
    hasVpn = false,
    isOfflineMode = false,
  } = input

  if (basePrice < 0) throw new Error('basePrice must be >= 0')
  if (rankDelta < 1) throw new Error('rankDelta must be >= 1')
  if (gameCount < 1) throw new Error('gameCount must be >= 1')

  let rankDeltaFee = 0
  let gameCountFee = 0

  if (serviceType === 'rank_boost') {
    // Each tier beyond the first adds a percentage of the base price
    rankDeltaFee = basePrice * RANK_DELTA_MULTIPLIER * (rankDelta - 1)
  }

  if (serviceType === 'win_boost' || serviceType === 'placement_matches' || serviceType === 'unrated_matches') {
    gameCountFee = PER_GAME_RATE[serviceType] * gameCount
  }

  const subtotal = basePrice + rankDeltaFee + gameCountFee

  const duoRate      = overrides?.duo      ?? SURCHARGES.duo
  const priorityRate = overrides?.priority ?? SURCHARGES.priority

  const duoPremium     = isDuo        ? subtotal * duoRate          : 0
  const priorityFee    = isPriority   ? subtotal * priorityRate     : 0
  const vpnFee         = hasVpn       ? SURCHARGES.vpn              : 0
  const offlineModeFee = isOfflineMode ? SURCHARGES.offlineMode     : 0

  const total = round2(subtotal + duoPremium + priorityFee + vpnFee + offlineModeFee)

  return {
    base: round2(basePrice),
    rankDeltaFee: round2(rankDeltaFee),
    gameCountFee: round2(gameCountFee),
    duoPremium: round2(duoPremium),
    priorityFee: round2(priorityFee),
    vpnFee: round2(vpnFee),
    offlineModeFee: round2(offlineModeFee),
    total,
  }
}

/** Format a price to locale string (USD) */
export function formatPrice(amount: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
