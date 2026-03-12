// Pure aggregation helpers for revenue calculations.
// Kept separate from the 'use server' action file so they can be
// imported by unit tests without triggering the async-export constraint.

export type OrderRow = {
  id: string
  price: number
  net_payout: number | null
  status: string
  created_at: string
  completed_at: string | null
  game: { name: string } | { name: string }[] | null
}

export interface DailyRevenue {
  date: string   // 'MMM D'
  revenue: number
}

export interface GameRevenue {
  game: string
  revenue: number
  orders: number
}

export function computeMetrics(
  orders: OrderRow[],
  flatPlatformFee: number,
): { totalVolume: number; platformNetProfit: number; totalCompletedOrders: number } {
  let totalVolume = 0
  let platformNetProfit = 0

  for (const o of orders) {
    totalVolume += o.price
    if (o.net_payout !== null && o.net_payout !== undefined) {
      platformNetProfit += Math.max(0, o.price - o.net_payout)
    } else {
      platformNetProfit += flatPlatformFee
    }
  }

  return {
    totalVolume:          Math.round(totalVolume * 100) / 100,
    platformNetProfit:    Math.round(platformNetProfit * 100) / 100,
    totalCompletedOrders: orders.length,
  }
}

export function computeDailyRevenue(orders: OrderRow[], now = new Date()): DailyRevenue[] {
  const dailyMap = new Map<string, number>()

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - i)
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }

  for (const o of orders) {
    // Revenue recognised on completion date; fall back to created_at for legacy rows.
    const key = (o.completed_at ?? o.created_at).slice(0, 10)
    if (dailyMap.has(key)) {
      dailyMap.set(key, dailyMap.get(key)! + o.price)
    }
  }

  return Array.from(dailyMap.entries()).map(([isoDate, revenue]) => ({
    date: formatChartDate(isoDate),
    revenue: Math.round(revenue * 100) / 100,
  }))
}

export function computeRevenueByGame(orders: OrderRow[]): GameRevenue[] {
  const gameMap = new Map<string, { revenue: number; orders: number }>()

  for (const o of orders) {
    const gameEntry = Array.isArray(o.game) ? o.game[0] : o.game
    const name = gameEntry?.name ?? 'Unknown'
    const existing = gameMap.get(name) ?? { revenue: 0, orders: 0 }
    gameMap.set(name, { revenue: existing.revenue + o.price, orders: existing.orders + 1 })
  }

  return Array.from(gameMap.entries())
    .map(([game, { revenue, orders }]) => ({
      game,
      revenue: Math.round(revenue * 100) / 100,
      orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

function formatChartDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
