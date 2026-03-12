'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getGlobalSettings } from '@/lib/data/settings'
import {
  computeMetrics,
  computeDailyRevenue,
  computeRevenueByGame,
  type OrderRow,
} from '@/lib/revenue-utils'

// Re-export types so consumers can import them from this module as before.
export type { OrderRow, DailyRevenue, GameRevenue } from '@/lib/revenue-utils'
import type { DailyRevenue, GameRevenue } from '@/lib/revenue-utils'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueStats {
  totalVolume: number
  platformNetProfit: number
  pendingBoosterBalances: number
  totalCompletedOrders: number
  dailyRevenue: DailyRevenue[]
  revenueByGame: GameRevenue[]
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getRevenueStats(): Promise<RevenueStats> {
  // RBAC: defence-in-depth — verify caller is admin or accountant
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const profile = await getProfile(user.id)
  if (!profile || !['admin', 'accountant'].includes(profile.role)) {
    throw new Error('Forbidden')
  }

  const admin = adminClient()

  // Paid/closed statuses — orders that have actually generated revenue
  const PAID_STATUSES = ['completed', 'approved', 'waiting_action'] as const

  const [ordersResult, balancesResult, settings] = await Promise.all([
    admin
      .from('orders')
      .select('id, price, net_payout, status, created_at, completed_at, game:games(name)')
      .in('status', PAID_STATUSES as unknown as string[]),

    admin
      .from('profiles')
      .select('balance')
      .eq('role', 'booster'),

    getGlobalSettings(),
  ])

  const orders = (ordersResult.data ?? []) as unknown as OrderRow[]
  const boosterRows = (balancesResult.data ?? []) as Array<{ balance: number }>

  const { totalVolume, platformNetProfit, totalCompletedOrders } =
    computeMetrics(orders, settings.flat_platform_fee)

  const pendingBoosterBalances =
    Math.round(boosterRows.reduce((sum, p) => sum + (p.balance ?? 0), 0) * 100) / 100

  return {
    totalVolume,
    platformNetProfit,
    pendingBoosterBalances,
    totalCompletedOrders,
    dailyRevenue:  computeDailyRevenue(orders),
    revenueByGame: computeRevenueByGame(orders),
  }
}
