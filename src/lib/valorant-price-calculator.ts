// Valorant Rank Boost Price Calculator — client-safe pure math

export const RANK_DIVISION_COSTS: Record<string, number> = {
  iron:       5.28,
  bronze:    10.73,
  silver:     7.47,
  gold:       9.73,
  platinum:  13.62,
  diamond:   29.81,
  ascendant: 67.45,
}

export const RANK_ORDER = [
  'iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal',
] as const

export type RankTier = typeof RANK_ORDER[number] | 'radiant'

export const RR_DISCOUNT_RATES: Record<string, number> = {
  '0-20':   0.0,
  '21-40':  0.20,
  '41-60':  0.30,
  '61-80':  0.40,
  '81-100': 0.50,
}

export const SERVER_MULTIPLIERS: Record<string, number> = {
  'Europe':        1.0,
  'North America': 1.064,
  'Asia Pacific':  1.064,
  'Brazil':        1.064,
  'Latin America': 1.064,
}

const IMMORTAL_RR_BANDS = [
  { from: 0,   to: 100, rate: 0.698 },
  { from: 100, to: 200, rate: 0.908 },
  { from: 200, to: 300, rate: 1.496 },
  { from: 300, to: 400, rate: 1.825 },
  { from: 400, to: 500, rate: 2.118 },
]

export interface RankProps {
  tier: string
  division?: number // 1 | 2 | 3
  rr?: number       // Immortal only
}

export interface BoostOptions {
  currentRRRange: string
  server: string
  isDuo?: boolean
}

export interface BoostPrice {
  original: number // before 20% platform discount
  final: number    // after 20% platform discount
}

function round2(v: number): number {
  return Number(v.toFixed(2))
}

export function calculateImmortalPrice(startRR: number, endRR: number): number {
  if (endRR <= startRR) return 0
  let cost = 0
  let remaining = endRR - startRR
  let cursor = startRR
  for (const band of IMMORTAL_RR_BANDS) {
    if (cursor >= band.to) continue
    const bandStart = Math.max(cursor, band.from)
    const bandEnd   = Math.min(cursor + remaining, band.to)
    const rr        = bandEnd - bandStart
    if (rr <= 0) continue
    cost      += rr * band.rate
    remaining -= rr
    cursor     = bandEnd
    if (remaining <= 0) break
  }
  return round2(cost)
}

export function calculateRankBoostPrice(
  current: RankProps,
  desired: RankProps,
  options: BoostOptions,
): BoostPrice {
  const serverMult = SERVER_MULTIPLIERS[options.server] ?? 1.0
  const rrDiscount = RR_DISCOUNT_RATES[options.currentRRRange] ?? 0.0

  // Both Immortal
  if (current.tier === 'immortal' && desired.tier === 'immortal') {
    const startRR = current.rr ?? 0
    const endRR   = desired.rr ?? 0
    if (endRR <= startRR) return { original: 0, final: 0 }
    let price = calculateImmortalPrice(startRR, endRR)
    price *= serverMult
    if (options.isDuo) price *= 1.5
    return { original: round2(price), final: round2(price * 0.8) }
  }

  // Normal tier(s)
  const currentTierIdx    = RANK_ORDER.indexOf(current.tier as typeof RANK_ORDER[number])
  const desiredIsImmortal = desired.tier === 'immortal'
  const desiredTierIdx    = desiredIsImmortal
    ? RANK_ORDER.indexOf('immortal')
    : RANK_ORDER.indexOf(desired.tier as typeof RANK_ORDER[number])

  if (currentTierIdx < 0 || desiredTierIdx < 0) return { original: 0, final: 0 }

  const currentAbs = currentTierIdx * 3 + ((current.division ?? 1) - 1)
  const desiredAbs = desiredIsImmortal
    ? RANK_ORDER.indexOf('ascendant') * 3 + 3 // entry point of Immortal
    : desiredTierIdx * 3 + ((desired.division ?? 1) - 1)

  if (desiredAbs <= currentAbs) return { original: 0, final: 0 }

  let total   = 0
  let isFirst = true

  for (let abs = currentAbs; abs < desiredAbs; abs++) {
    const tierName = RANK_ORDER[Math.floor(abs / 3)]
    const divCost  = RANK_DIVISION_COSTS[tierName] ?? 0
    const discount = isFirst ? rrDiscount : 0
    total  += divCost * (1 - discount)
    isFirst = false
  }

  if (desiredIsImmortal) {
    total += calculateImmortalPrice(0, desired.rr ?? 0)
  }

  total *= serverMult
  if (options.isDuo) total *= 1.5

  return { original: round2(total), final: round2(total * 0.8) }
}
