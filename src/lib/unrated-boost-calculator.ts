// ─── Base price lookup tables ─────────────────────────────────────────────────

const UNRATED_BASE: Record<number, number> = {
   1:  3.39,
   2:  6.78,
   3: 10.19,
   4: 13.58,
   5: 16.97,
   6: 20.36,
   7: 23.75,
   8: 27.16,
   9: 30.55,
  10: 33.94,
  11: 37.33,
  12: 40.72,
  13: 44.13,
  14: 47.52,
  15: 50.91,
}

// Featured: proportionally cheaper — $47.51 / 15 ≈ $3.167 per match
const FEATURED_PRICE_PER_MATCH = 3.167

// ─── Shared constants ─────────────────────────────────────────────────────────

export const SERVER_MULTIPLIERS: Record<string, number> = {
  'Europe':        1.0,
  'North America': 1.072,
  'Asia Pacific':  1.072,
  'Brazil':        1.072,
  'Latin America': 1.072,
}

const DUO_MULTIPLIER = 1.50
const DISCOUNT_RATE  = 0.20

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type UnratedGameMode = 'unrated' | 'featured'

export interface UnratedBoostOptions {
  gameMode:            UnratedGameMode
  matches:             number // 1-15
  server:              string
  isDuo?:              boolean
  priorityCompletion?: boolean
  streamGames?:        boolean
  soloOnlyQueue?:      boolean
  premiumCoaching?:    boolean
}

// ─── Main calculator ──────────────────────────────────────────────────────────

export function calculateUnratedPrice(
  options: UnratedBoostOptions,
): { original: number; final: number } {
  const m = Math.max(1, Math.min(15, options.matches))

  // Step 1 — base subtotal
  let total: number
  if (options.gameMode === 'featured') {
    total = Number((FEATURED_PRICE_PER_MATCH * m).toFixed(4))
  } else {
    total = UNRATED_BASE[m] ?? Number((3.39 * m).toFixed(4))
  }

  // Step 2 — duo
  if (options.isDuo) total *= DUO_MULTIPLIER

  // Step 3 — server multiplier
  total *= SERVER_MULTIPLIERS[options.server] ?? 1.0

  // Step 4 — extra options
  if (options.priorityCompletion) total *= 1.25
  if (options.streamGames)        total *= 1.20
  if (options.soloOnlyQueue)      total *= 1.60
  if (options.premiumCoaching)    total *= 1.25

  // Step 5 — 20% discount
  const final = total * (1 - DISCOUNT_RATE)

  return {
    original: Number(total.toFixed(2)),
    final:    Number(final.toFixed(2)),
  }
}
