import { describe, it, expect } from 'vitest'
import {
  computeMetrics,
  computeDailyRevenue,
  computeRevenueByGame,
  type OrderRow,
} from '@/lib/revenue-utils'

// ─── Fixture helpers ──────────────────────────────────────────────────────────

let _seq = 0
function makeOrder(overrides: Partial<OrderRow> & { price: number }): OrderRow {
  return {
    id: `order-${++_seq}`,
    price: overrides.price,
    net_payout:   overrides.net_payout   ?? null,
    status:       overrides.status       ?? 'completed',
    created_at:   overrides.created_at   ?? '2025-01-01T00:00:00Z',
    completed_at: overrides.completed_at ?? null,
    // Use 'in' check so callers can explicitly pass null/undefined
    game: 'game' in overrides ? overrides.game! : { name: 'Valorant' },
  }
}

// Fixed "today" used across date-sensitive tests
const TODAY = new Date('2025-03-11T12:00:00Z')
// ISO key for today in the map
const TODAY_KEY = '2025-03-11'
// ISO key for the oldest day in the 30-day window (29 days before TODAY)
const DAY_0_KEY  = '2025-02-10'
// Outside the window: 30 days before TODAY
const OUTSIDE_KEY = '2025-02-09'

// ─── computeMetrics ───────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  it('sums totalVolume across all orders', () => {
    const orders = [10, 20, 30].map((price) => makeOrder({ price }))
    const { totalVolume } = computeMetrics(orders, 5)
    expect(totalVolume).toBe(60)
  })

  it('uses (price - net_payout) for profit when net_payout is set', () => {
    const orders = [makeOrder({ price: 100, net_payout: 70 })]
    const { platformNetProfit } = computeMetrics(orders, 5)
    expect(platformNetProfit).toBe(30)
  })

  it('clamps profit to 0 when net_payout exceeds price', () => {
    const orders = [makeOrder({ price: 50, net_payout: 80 })]
    const { platformNetProfit } = computeMetrics(orders, 5)
    expect(platformNetProfit).toBe(0)
  })

  it('falls back to flat_platform_fee when net_payout is null (legacy orders)', () => {
    const orders = [
      makeOrder({ price: 100, net_payout: null }),
      makeOrder({ price: 200, net_payout: null }),
    ]
    const { platformNetProfit } = computeMetrics(orders, 12)
    // 2 legacy orders × $12 flat fee = $24
    expect(platformNetProfit).toBe(24)
  })

  it('mixes new and legacy orders correctly', () => {
    const orders = [
      makeOrder({ price: 100, net_payout: 80 }),  // profit = 20
      makeOrder({ price: 50,  net_payout: null }), // profit = flat_fee = 10
    ]
    const { platformNetProfit } = computeMetrics(orders, 10)
    expect(platformNetProfit).toBe(30)
  })

  it('returns totalCompletedOrders equal to the array length', () => {
    const orders = [makeOrder({ price: 10 }), makeOrder({ price: 20 })]
    const { totalCompletedOrders } = computeMetrics(orders, 5)
    expect(totalCompletedOrders).toBe(2)
  })

  it('returns zeros for an empty order list', () => {
    const { totalVolume, platformNetProfit, totalCompletedOrders } = computeMetrics([], 5)
    expect(totalVolume).toBe(0)
    expect(platformNetProfit).toBe(0)
    expect(totalCompletedOrders).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // 3 × $0.10 = $0.30 — should not drift to $0.30000000000000004
    const orders = [0.1, 0.1, 0.1].map((price) => makeOrder({ price }))
    const { totalVolume } = computeMetrics(orders, 0)
    expect(totalVolume).toBe(0.3)
  })
})

// ─── computeDailyRevenue ──────────────────────────────────────────────────────

describe('computeDailyRevenue', () => {
  it('returns exactly 30 buckets', () => {
    const result = computeDailyRevenue([], TODAY)
    expect(result).toHaveLength(30)
  })

  it('all buckets are 0 when there are no orders', () => {
    const result = computeDailyRevenue([], TODAY)
    expect(result.every((r) => r.revenue === 0)).toBe(true)
  })

  it('accumulates revenue on the completed_at date when set', () => {
    const orders = [
      makeOrder({ price: 50, completed_at: `${TODAY_KEY}T10:00:00Z` }),
      makeOrder({ price: 25, completed_at: `${TODAY_KEY}T15:00:00Z` }),
    ]
    const result = computeDailyRevenue(orders, TODAY)
    const todayBucket = result.find((r) => r.date === 'Mar 11')!
    expect(todayBucket.revenue).toBe(75)
  })

  it('falls back to created_at when completed_at is null', () => {
    const orders = [
      makeOrder({ price: 40, created_at: `${TODAY_KEY}T09:00:00Z`, completed_at: null }),
    ]
    const result = computeDailyRevenue(orders, TODAY)
    const todayBucket = result.find((r) => r.date === 'Mar 11')!
    expect(todayBucket.revenue).toBe(40)
  })

  it('includes the oldest boundary day (day 0 = 29 days ago)', () => {
    const orders = [
      makeOrder({ price: 15, completed_at: `${DAY_0_KEY}T00:00:00Z` }),
    ]
    const result = computeDailyRevenue(orders, TODAY)
    const oldest = result.find((r) => r.date === 'Feb 10')!
    expect(oldest.revenue).toBe(15)
  })

  it('ignores orders outside the 30-day window', () => {
    const orders = [
      makeOrder({ price: 99, completed_at: `${OUTSIDE_KEY}T00:00:00Z` }),
    ]
    const result = computeDailyRevenue(orders, TODAY)
    expect(result.every((r) => r.revenue === 0)).toBe(true)
  })

  it('date labels are formatted as "Mon D" (e.g. "Mar 11")', () => {
    const result = computeDailyRevenue([], TODAY)
    // Last entry should always be TODAY formatted
    expect(result[result.length - 1].date).toBe('Mar 11')
    // First entry is 29 days before
    expect(result[0].date).toBe('Feb 10')
  })
})

// ─── computeRevenueByGame ─────────────────────────────────────────────────────

describe('computeRevenueByGame', () => {
  it('returns an empty array for no orders', () => {
    expect(computeRevenueByGame([])).toEqual([])
  })

  it('accumulates revenue per game', () => {
    const orders = [
      makeOrder({ price: 30, game: { name: 'Valorant' } }),
      makeOrder({ price: 20, game: { name: 'Valorant' } }),
      makeOrder({ price: 50, game: { name: 'League of Legends' } }),
    ]
    const result = computeRevenueByGame(orders)
    const val = result.find((r) => r.game === 'Valorant')!
    const lol = result.find((r) => r.game === 'League of Legends')!
    expect(val.revenue).toBe(50)
    expect(lol.revenue).toBe(50)
  })

  it('counts orders per game correctly', () => {
    const orders = [
      makeOrder({ price: 10, game: { name: 'Valorant' } }),
      makeOrder({ price: 10, game: { name: 'Valorant' } }),
      makeOrder({ price: 10, game: { name: 'Apex Legends' } }),
    ]
    const result = computeRevenueByGame(orders)
    expect(result.find((r) => r.game === 'Valorant')!.orders).toBe(2)
    expect(result.find((r) => r.game === 'Apex Legends')!.orders).toBe(1)
  })

  it('sorts by revenue descending', () => {
    const orders = [
      makeOrder({ price: 10,  game: { name: 'A' } }),
      makeOrder({ price: 200, game: { name: 'B' } }),
      makeOrder({ price: 50,  game: { name: 'C' } }),
    ]
    const result = computeRevenueByGame(orders)
    expect(result.map((r) => r.game)).toEqual(['B', 'C', 'A'])
  })

  it('handles array-form game join (Supabase returns array on joins)', () => {
    const orders = [
      makeOrder({ price: 25, game: [{ name: 'TFT' }] }),
    ]
    const result = computeRevenueByGame(orders)
    expect(result[0].game).toBe('TFT')
  })

  it('groups null/missing game under "Unknown"', () => {
    const orders = [
      makeOrder({ price: 15, game: null }),
    ]
    const result = computeRevenueByGame(orders)
    expect(result[0].game).toBe('Unknown')
  })
})
