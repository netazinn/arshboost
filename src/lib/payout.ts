export interface PayoutBreakdown {
  grossPrice:    number
  tieredCut:     number  // raw percentage-based commission before the flat-fee floor
  platformFee:   number  // final platform cut applied (= tieredCut or flatPlatformFee, whichever wins)
  boosterPayout: number
}

// ─── Commission tiers (game-agnostic; override per-game via CommissionTable) ──

/**
 * Each tier covers all order prices up to `upTo` (inclusive).
 * Tiers must be ordered lowest → highest.
 */
export interface CommissionTier { upTo: number; rate: number }

export const DEFAULT_TIERS: CommissionTier[] = [
  { upTo: 25,       rate: 0.20 },  // 20% for orders up to $25
  { upTo: 50,       rate: 0.18 },  // 18% for orders $25–$50
  { upTo: 100,      rate: 0.15 },  // 15% for orders $50–$100
  { upTo: Infinity, rate: 0.12 },  // 12% for orders above $100
]

/**
 * Below this threshold the flat platform fee is NOT applied as a floor —
 * the platform only takes the raw percentage commission to protect booster
 * motivation on micro-orders.
 */
export const MICRO_ORDER_THRESHOLD = 10

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calcTieredCut(price: number, tiers = DEFAULT_TIERS): number {
  const tier = tiers.find(({ upTo }) => price <= upTo) ?? tiers[tiers.length - 1]
  return Math.round(price * tier.rate * 100) / 100
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Calculates booster net payout with tiered commission + optional flat-fee floor.
 *
 * Rules:
 *  - Percentage tier is applied first (`tieredCut`).
 *  - If `orderPrice > MICRO_ORDER_THRESHOLD ($10)`: the flat fee acts as a floor.
 *      `platformFee = Math.max(tieredCut, flatPlatformFee)`
 *  - If `orderPrice ≤ $10`: only the percentage cut is taken (no flat-fee floor).
 *      `platformFee = tieredCut`
 *  - `boosterPayout` is clamped to ≥ 0.
 *
 * @param orderPrice      - Total order price charged to the client.
 * @param flatPlatformFee - Flat-fee floor (default 4). Fetch the live value via
 *                          getGlobalSettings() wherever precision matters.
 * @param tiers           - Override commission tiers (defaults to DEFAULT_TIERS).
 */
export function calculateBoosterPayout(
  orderPrice:      number,
  flatPlatformFee  = 4,
  tiers            = DEFAULT_TIERS,
): PayoutBreakdown {
  const tieredCut  = calcTieredCut(orderPrice, tiers)
  const platformFee =
    orderPrice <= MICRO_ORDER_THRESHOLD
      ? tieredCut
      : Math.round(Math.max(tieredCut, flatPlatformFee) * 100) / 100
  const boosterPayout = Math.round(Math.max(0, orderPrice - platformFee) * 100) / 100

  return {
    grossPrice: orderPrice,
    tieredCut,
    platformFee,
    boosterPayout,
  }
}

