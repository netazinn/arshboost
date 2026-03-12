import { describe, it, expect } from 'vitest'
import {
  calculateBoosterPayout,
  calcTieredCut,
  DEFAULT_TIERS,
  MICRO_ORDER_THRESHOLD,
} from '@/lib/payout'

// ─── calcTieredCut ────────────────────────────────────────────────────────────

describe('calcTieredCut', () => {
  it('applies 20% for orders at the $0–$25 tier boundary', () => {
    expect(calcTieredCut(25)).toBe(5)   // 25 * 0.20
  })

  it('applies 18% for orders in the $25–$50 tier', () => {
    expect(calcTieredCut(50)).toBe(9)   // 50 * 0.18
  })

  it('applies 15% for orders in the $50–$100 tier', () => {
    expect(calcTieredCut(100)).toBe(15) // 100 * 0.15
  })

  it('applies 12% for orders above $100', () => {
    expect(calcTieredCut(200)).toBe(24) // 200 * 0.12
  })

  it('rounds to 2 decimal places', () => {
    // 63.42 * 0.15 = 9.513 → rounds to 9.51
    expect(calcTieredCut(63.42)).toBeCloseTo(9.51, 2)
  })

  it('returns 0 for a $0 order', () => {
    expect(calcTieredCut(0)).toBe(0)
  })

  it('respects custom tier overrides', () => {
    const custom = [{ upTo: Infinity, rate: 0.30 }]
    expect(calcTieredCut(100, custom)).toBe(30)
  })
})

// ─── calculateBoosterPayout — micro-order threshold (≤ $10) ──────────────────

describe('calculateBoosterPayout — micro-order threshold', () => {
  it('MICRO_ORDER_THRESHOLD is $10', () => {
    expect(MICRO_ORDER_THRESHOLD).toBe(10)
  })

  it('does NOT apply flat-fee floor for orders ≤ $10 (only takes tiered %)', () => {
    // $8 × 20% = $1.60; flat_fee = $4 is ignored
    const r = calculateBoosterPayout(8, 4)
    expect(r.tieredCut).toBeCloseTo(1.60, 2)
    expect(r.platformFee).toBeCloseTo(1.60, 2)
    expect(r.boosterPayout).toBeCloseTo(6.40, 2)
  })

  it('exactly at threshold ($10) is still a micro-order', () => {
    // $10 × 20% = $2.00; flat_fee $4 is ignored
    const r = calculateBoosterPayout(10, 4)
    expect(r.tieredCut).toBe(2)
    expect(r.platformFee).toBe(2)
    expect(r.boosterPayout).toBe(8)
  })

  it('$0 order yields $0 platform fee and $0 payout', () => {
    const r = calculateBoosterPayout(0, 4)
    expect(r.tieredCut).toBe(0)
    expect(r.platformFee).toBe(0)
    expect(r.boosterPayout).toBe(0)
  })
})

// ─── calculateBoosterPayout — flat-fee floor (> $10) ─────────────────────────

describe('calculateBoosterPayout — flat-fee floor applied for orders > $10', () => {
  it('flat fee wins when tiered cut is lower ($20 order, 20% = $4 exactly = flat fee)', () => {
    // tieredCut = 20 * 0.20 = $4; max($4, $4) = $4
    const r = calculateBoosterPayout(20, 4)
    expect(r.tieredCut).toBe(4)
    expect(r.platformFee).toBe(4)
    expect(r.boosterPayout).toBe(16)
  })

  it('tiered cut wins when it exceeds the flat fee ($63.42 order)', () => {
    // tieredCut ~ 63.42 * 0.15 = 9.51; max(9.51, 4) = 9.51
    const r = calculateBoosterPayout(63.42, 4)
    expect(r.platformFee).toBeCloseTo(9.51, 2)
    expect(r.boosterPayout).toBeCloseTo(53.91, 2)
  })

  it('flat fee wins on a small above-threshold order ($11, 20% = $2.20 < $4)', () => {
    const r = calculateBoosterPayout(11, 4)
    expect(r.tieredCut).toBeCloseTo(2.2, 2)
    expect(r.platformFee).toBe(4)
    expect(r.boosterPayout).toBeCloseTo(7, 2)
  })

  it('large order uses tiered cut (12% on $200 = $24, flat $4 is irrelevant)', () => {
    const r = calculateBoosterPayout(200, 4)
    expect(r.tieredCut).toBe(24)
    expect(r.platformFee).toBe(24)
    expect(r.boosterPayout).toBe(176)
  })

  it('flat fee of $0 means tiered cut is always the platformFee', () => {
    const r = calculateBoosterPayout(20, 0)
    expect(r.tieredCut).toBe(4)   // 20 * 0.20
    expect(r.platformFee).toBe(4) // max(4, 0)
    expect(r.boosterPayout).toBe(16)
  })
})

// ─── Return shape & invariants ────────────────────────────────────────────────

describe('calculateBoosterPayout — invariants', () => {
  it('always returns all four fields in the breakdown', () => {
    const r = calculateBoosterPayout(15, 5)
    expect(r).toHaveProperty('grossPrice')
    expect(r).toHaveProperty('tieredCut')
    expect(r).toHaveProperty('platformFee')
    expect(r).toHaveProperty('boosterPayout')
  })

  it('grossPrice always equals the original orderPrice argument', () => {
    const price = 42.5
    expect(calculateBoosterPayout(price, 10).grossPrice).toBe(price)
  })

  it('boosterPayout is never negative', () => {
    // Even if somehow price < platformFee
    expect(calculateBoosterPayout(0.01, 999).boosterPayout).toBeGreaterThanOrEqual(0)
  })

  it('accepts custom tiers via third parameter', () => {
    const allFlat30 = [{ upTo: Infinity, rate: 0.30 }]
    const r = calculateBoosterPayout(100, 4, allFlat30)
    expect(r.tieredCut).toBe(30)      // 100 * 0.30
    expect(r.platformFee).toBe(30)    // max(30, 4)
    expect(r.boosterPayout).toBe(70)
  })
})

