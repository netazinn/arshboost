import { describe, it, expect } from 'vitest'
import { calculatePrice, formatPrice } from '@/lib/price-calculator'

describe('calculatePrice', () => {
  // ─── rank_boost ─────────────────────────────────────────────────────────────

  it('returns base price for rank_boost with rankDelta = 1', () => {
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', rankDelta: 1 })
    expect(result.base).toBe(10)
    expect(result.rankDeltaFee).toBe(0)
    expect(result.total).toBe(10)
  })

  it('adds 12% per extra tier beyond first for rank_boost', () => {
    // 3 tiers → +2 deltas → +2 * 12% * 10 = +2.40
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', rankDelta: 3 })
    expect(result.rankDeltaFee).toBeCloseTo(2.4)
    expect(result.total).toBeCloseTo(12.4)
  })

  // ─── win_boost ──────────────────────────────────────────────────────────────

  it('calculates win_boost by gameCount', () => {
    // 5 games * $3.50 = $17.50, base = 0
    const result = calculatePrice({ basePrice: 0, serviceType: 'win_boost', gameCount: 5 })
    expect(result.gameCountFee).toBe(17.5)
    expect(result.total).toBe(17.5)
  })

  // ─── placement_matches ──────────────────────────────────────────────────────

  it('calculates placement_matches by gameCount', () => {
    // 10 games * $4.00 = $40
    const result = calculatePrice({ basePrice: 0, serviceType: 'placement_matches', gameCount: 10 })
    expect(result.gameCountFee).toBe(40)
    expect(result.total).toBe(40)
  })

  // ─── unrated_matches ────────────────────────────────────────────────────────

  it('calculates unrated_matches by gameCount', () => {
    const result = calculatePrice({ basePrice: 0, serviceType: 'unrated_matches', gameCount: 3 })
    expect(result.gameCountFee).toBe(9)
    expect(result.total).toBe(9)
  })

  // ─── surcharges ─────────────────────────────────────────────────────────────

  it('adds duo premium (30% of subtotal)', () => {
    // base 10, no delta/game fees, subtotal=10, duo=3.00
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', isDuo: true })
    expect(result.duoPremium).toBeCloseTo(3)
    expect(result.total).toBeCloseTo(13)
  })

  it('adds priority fee (20% of subtotal)', () => {
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', isPriority: true })
    expect(result.priorityFee).toBeCloseTo(2)
    expect(result.total).toBeCloseTo(12)
  })

  it('adds flat VPN fee ($2)', () => {
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', hasVpn: true })
    expect(result.vpnFee).toBe(2)
    expect(result.total).toBeCloseTo(12)
  })

  it('adds flat offline mode fee ($1.50)', () => {
    const result = calculatePrice({ basePrice: 10, serviceType: 'rank_boost', isOfflineMode: true })
    expect(result.offlineModeFee).toBe(1.5)
    expect(result.total).toBeCloseTo(11.5)
  })

  it('stacks all surcharges correctly', () => {
    // base=10, duo=3, priority=2, vpn=2, offline=1.5 → total=18.5
    const result = calculatePrice({
      basePrice: 10,
      serviceType: 'rank_boost',
      isDuo: true,
      isPriority: true,
      hasVpn: true,
      isOfflineMode: true,
    })
    expect(result.total).toBeCloseTo(18.5)
  })

  // ─── edge cases ─────────────────────────────────────────────────────────────

  it('throws for negative basePrice', () => {
    expect(() =>
      calculatePrice({ basePrice: -1, serviceType: 'rank_boost' })
    ).toThrow('basePrice must be >= 0')
  })

  it('throws for rankDelta < 1', () => {
    expect(() =>
      calculatePrice({ basePrice: 10, serviceType: 'rank_boost', rankDelta: 0 })
    ).toThrow('rankDelta must be >= 1')
  })

  it('throws for gameCount < 1', () => {
    expect(() =>
      calculatePrice({ basePrice: 0, serviceType: 'win_boost', gameCount: 0 })
    ).toThrow('gameCount must be >= 1')
  })

  it('returns values rounded to 2 decimal places', () => {
    const result = calculatePrice({ basePrice: 10.005, serviceType: 'rank_boost' })
    const decimals = result.total.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

describe('formatPrice', () => {
  it('formats a number as USD currency string', () => {
    expect(formatPrice(12.5)).toBe('$12.50')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
})
