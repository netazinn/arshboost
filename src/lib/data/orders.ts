import { createClient } from '@/lib/supabase/server'
import type { Order, ChatMessage } from '@/types'

// ─── Client ──────────────────────────────────────────────────────────────────

export async function getClientOrders(clientId: string): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getClientOrders]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}

// ─── Single order ─────────────────────────────────────────────────────────────

export async function getOrderById(orderId: string): Promise<Order | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      booster:profiles!orders_booster_id_fkey(id, username, email, avatar_url)
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    console.error('[getOrderById]', error.message)
    return null
  }

  return data as Order
}

// ─── Chat messages ────────────────────────────────────────────────────────────

export async function getOrderMessages(orderId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      *,
      sender:profiles(id, email, username, avatar_url, role)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getOrderMessages]', error.message)
    return []
  }

  return (data ?? []) as ChatMessage[]
}

// ─── Booster ──────────────────────────────────────────────────────────────────

export async function getOpenJobs(): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label)
    `)
    .eq('status', 'in_progress')
    .is('booster_id', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getOpenJobs]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}

export async function getBoosterOrders(boosterId: string): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label)
    `)
    .eq('booster_id', boosterId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getBoosterOrders]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}

/**
 * Booster inbox orders — same as getBoosterOrders but applies a 30-day
 * visibility window on completed orders.
 *
 * Rule: show if status ≠ completed  OR  if completed and updated_at is within
 * the last 30 days. Data is NEVER deleted; only the query scope changes.
 * Clients and admins always see full history via their own queries.
 */
export async function getBoosterInboxOrders(boosterId: string): Promise<Order[]> {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      client:profiles!orders_client_id_fkey(id, username, email, avatar_url)
    `)
    .eq('booster_id', boosterId)
    .or(`status.neq.completed,and(status.eq.completed,updated_at.gte.${thirtyDaysAgo})`)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[getBoosterInboxOrders]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}

// ─── Support / Admin ──────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      client:profiles!orders_client_id_fkey(id, email, username, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllOrders]', error.message)
    return []
  }

  return (data ?? []) as Order[]
}
