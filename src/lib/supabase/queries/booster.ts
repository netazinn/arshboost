import { createClient } from '@/lib/supabase/server'
import type { Order, Profile } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoosterStats {
  /** All orders ever assigned to this booster (any status) */
  totalOrders:     number
  completedOrders: number
  activeOrders:    number
  /** Percentage: completed / (completed + cancelled + dispute) × 100 */
  completionRate:  number
  /** Sum of price on completed orders */
  totalEarned:     number
}

// ── Profile ───────────────────────────────────────────────────────────────────
// NOTE: language preferences and bank details are not yet in the DB schema.
// Extend this query once those tables are added.

export async function getBoosterProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[getBoosterProfile]', error.message)
    return null
  }

  return data as Profile
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getBoosterStats(userId: string): Promise<BoosterStats> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select('status, price')
    .eq('booster_id', userId)

  if (error) {
    console.error('[getBoosterStats]', error.message)
    return {
      totalOrders:     0,
      completedOrders: 0,
      activeOrders:    0,
      completionRate:  100,
      totalEarned:     0,
    }
  }

  const rows      = data ?? []
  const completed = rows.filter(r => r.status === 'completed')
  const active    = rows.filter(r => r.status === 'in_progress')
  const terminal  = rows.filter(r =>
    (['completed', 'cancelled', 'dispute'] as string[]).includes(r.status)
  )

  return {
    totalOrders:     rows.length,
    completedOrders: completed.length,
    activeOrders:    active.length,
    completionRate:  terminal.length > 0
      ? Math.round((completed.length / terminal.length) * 100)
      : 100,
    totalEarned: completed.reduce((sum, r) => sum + r.price, 0),
  }
}

// ── Available Boosts ──────────────────────────────────────────────────────────
// Open orders (status = 'in_progress', booster_id = null) ready to be claimed.
// Optional server / queue filters use PostgREST JSON column extraction (->>).

export async function getAvailableBoosts(filters?: {
  server?: string
  queue?:  string
}): Promise<Order[]> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label)
    `)
    .eq('status', 'in_progress')
    .is('booster_id', null)
    .order('created_at', { ascending: false })

  if (filters?.server) query = query.eq('details->>server', filters.server)
  if (filters?.queue)  query = query.eq('details->>queue',  filters.queue)

  const { data, error } = await query

  if (error) {
    console.error('[getAvailableBoosts]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}

// ── Active Order ──────────────────────────────────────────────────────────────
// Returns the booster's currently in-progress order, or null if idle.

export async function getActiveBoosterOrder(userId: string): Promise<Order | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label)
    `)
    .eq('booster_id', userId)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[getActiveBoosterOrder]', error.message)
    return null
  }

  return data as Order | null
}
