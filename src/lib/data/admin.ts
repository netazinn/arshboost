import { createClient } from '@/lib/supabase/server'
import type { Order, Withdrawal, Profile, ChatMessage } from '@/types'

// ─── Orders ──────────────────────────────────────────────────────────────────

/** All orders with full joins (client, booster, game, service). Admin only. */
export async function getAllOrdersAdmin(): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      client:profiles!orders_client_id_fkey(id, email, username, avatar_url, role),
      booster:profiles!orders_booster_id_fkey(id, email, username, avatar_url, role)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllOrdersAdmin]', error.message)
    return []
  }
  return (data ?? []) as Order[]
}

/** Single order with full joins — used in admin detail/chat view. */
export async function getOrderAdmin(orderId: string): Promise<Order | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      client:profiles!orders_client_id_fkey(id, email, username, avatar_url, role),
      booster:profiles!orders_booster_id_fkey(id, email, username, avatar_url, role)
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    console.error('[getOrderAdmin]', error.message)
    return null
  }
  return data as Order
}

/** Messages for a given order — includes sender profile (role). */
export async function getOrderMessagesAdmin(orderId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, sender:profiles!chat_messages_sender_id_fkey(id, username, email, role, avatar_url)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getOrderMessagesAdmin]', error.message)
    return []
  }
  return (data ?? []) as ChatMessage[]
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

/** All withdrawal requests, newest first, with booster profile. */
export async function getAllWithdrawals(): Promise<Withdrawal[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('withdrawals')
    .select(`
      *,
      booster:profiles!withdrawals_booster_id_fkey(id, username, email, avatar_url),
      reviewer:profiles!withdrawals_reviewed_by_fkey(id, username, email)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllWithdrawals]', error.message)
    return []
  }
  return (data ?? []) as Withdrawal[]
}

// ─── Tips (Completed-order earnings) ─────────────────────────────────────────

/**
 * Returns ALL completed orders with full booster + client + game joins.
 * Used by the Admin Tips History page to track global booster earnings flow.
 */
export async function getAllTips(): Promise<Order[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      game:games(id, name, slug, logo_url),
      service:games_services(id, type, label),
      client:profiles!orders_client_id_fkey(id, email, username, avatar_url, role),
      booster:profiles!orders_booster_id_fkey(id, email, username, avatar_url, role)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllTips]', error.message)
    return []
  }
  return (data ?? []) as Order[]
}

// ─── Users ────────────────────────────────────────────────────────────────────

/** All profiles, newest first. */
export async function getAllUsers(): Promise<Profile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllUsers]', error.message)
    return []
  }
  return (data ?? []) as Profile[]
}
