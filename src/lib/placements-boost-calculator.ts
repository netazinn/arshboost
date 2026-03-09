// ─── Base price per match ──────────────────────────────────────────────────────

const BASE_PRICE_PER_MATCH: Record<string, number | Record<number, number>> = {
  unranked:  2.29,
  iron:      1.90,
  bronze:    2.20,
  silver:    2.29,
  gold:      2.88,
  platinum:  3.34,
  diamond:   { 1: 4.60, 2: 4.90, 3: 5.20 },
  ascendant: { 1: 5.42, 2: 5.78, 3: 5.93 },
  immortal:  { 1: 6.94, 2: 9.24, 3: 11.56 },
  radiant:   17.35,
}

// ─── Shared constants (identical to win-boost-calculator) ─────────────────────

const SERVER_MULTIPLIERS: Record<string, number> = {
  'Europe':        1.0,
  'North America': 1.072,
  'Asia Pacific':  1.072,
  'Brazil':        1.072,
  'Latin America': 1.072,
}

const DUO_MULTIPLIER  = 1.50
const DISCOUNT_RATE   = 0.20

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PlacementsBoostRank {
  tier:       string   // e.g. 'gold', 'unranked', 'radiant'
  division?:  number   // 1 | 2 | 3 — ignored for unranked/radiant
  matches:    number   // 1-5
}

export interface PlacementsBoostOptions {
  server:              string
  isDuo?:              boolean
  priorityCompletion?: boolean
  streamGames?:        boolean
  soloOnlyQueue?:      boolean
  premiumCoaching?:    boolean
}

// ─── Main calculator ──────────────────────────────────────────────────────────

export function calculatePlacementsPrice(
  rank:    PlacementsBoostRank,
  options: PlacementsBoostOptions,
): { original: number; final: number } {
  const tier = rank.tier.toLowerCase()
  const div  = rank.division ?? 1

  // Step 1 — base price per match
  const entry = BASE_PRICE_PER_MATCH[tier]
  let basePricePerMatch: number

  if (typeof entry === 'number') {
    basePricePerMatch = entry
  } else if (entry && typeof entry === 'object') {
    basePricePerMatch = entry[div] ?? entry[1]
  } else {
    basePricePerMatch = 0
  }

  // Step 2 — multiply by match count
  let total = basePricePerMatch * rank.matches

  // Step 3 — server multiplier
  total *= SERVER_MULTIPLIERS[options.server] ?? 1.0

  // Step 4 — queue type
  if (options.isDuo) total *= DUO_MULTIPLIER

  // Step 5 — extra options
  if (options.priorityCompletion) total *= 1.25
  if (options.streamGames)        total *= 1.20
  if (options.soloOnlyQueue)      total *= 1.60
  if (options.premiumCoaching)    total *= 1.25

  // Step 6 — 20% discount for final price
  const final = total * (1 - DISCOUNT_RATE)

  return {
    original: Number(total.toFixed(2)),
    final:    Number(final.toFixed(2)),
  }
}
