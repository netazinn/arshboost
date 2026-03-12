import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Order, Withdrawal, Profile, ChatMessage } from '@/types'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Staff DM Thread ──────────────────────────────────────────────────────────

export interface StaffDmThread {
  threadId: string
  boosterId: string
  booster: Profile
  lastMessage: ChatMessage
}

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
 * Returns all distinct DM threads addressed to a given staff role.
 * Thread IDs follow the format: "{boosterId}:{role}" (e.g., "abc:admin").
 * Deduplicates server-side, returning one entry per thread with the latest message.
 */
export async function getStaffDMThreads(staffRole: string): Promise<StaffDmThread[]> {
  const supabase = await createClient()

  // Fetch all DM messages for this staff role, newest first
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .like('dm_thread_id', `%:${staffRole}`)
    .order('created_at', { ascending: false })

  if (error || !messages?.length) return []

  // Keep only the latest message per thread
  const seen = new Set<string>()
  const latestPerThread: typeof messages = []
  for (const msg of messages) {
    if (msg.dm_thread_id && !seen.has(msg.dm_thread_id)) {
      seen.add(msg.dm_thread_id)
      latestPerThread.push(msg)
    }
  }

  // Extract booster IDs from thread IDs
  const boosterIds = latestPerThread.map((m) => (m.dm_thread_id as string).split(':')[0])

  // Batch-fetch booster profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url, role, created_at, updated_at')
    .in('id', boosterIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]))

  return latestPerThread.map((msg) => {
    const boosterId = (msg.dm_thread_id as string).split(':')[0]
    return {
      threadId: msg.dm_thread_id as string,
      boosterId,
      booster: profileMap.get(boosterId) ?? ({ id: boosterId, username: null, email: boosterId, role: 'booster', avatar_url: null, created_at: '', updated_at: '' } as Profile),
      lastMessage: msg as unknown as ChatMessage,
    }
  })
}


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

export type UserSort   = 'newest' | 'oldest' | 'active'
export type UserFilter = 'all' | 'banned' | 'admin' | 'booster' | 'client' | 'support' | 'accountant'

export interface UsersQuery {
  search?: string
  filter?: UserFilter
  sort?:   UserSort
}

/**
 * Fetch profiles with optional search/filter/sort, enriched with
 * last_sign_in_at from Supabase Auth.
 */
export async function getAllUsers(q: UsersQuery = {}): Promise<Profile[]> {
  const { search = '', filter = 'all', sort = 'newest' } = q
  const supabase = await createClient()

  let query = supabase.from('profiles').select('*')

  // ── Search (email | username | id)
  // PostgREST cannot cast uuid columns inside .or() filter strings.
  // Strategy: search email/username via OR; if the term looks like a UUID
  // (or UUID prefix ≥ 8 hex chars + dashes), also fetch by exact id and merge.
  if (search.trim()) {
    const term = search.trim()
    // UUID / UUID-prefix detection: only hex digits and dashes, at least 8 chars
    const looksLikeUuid = /^[0-9a-f-]{8,}$/i.test(term)

    if (looksLikeUuid) {
      // Exact UUID match — avoids any cast/ilike on the uuid column
      query = query.eq('id', term)
    } else {
      query = query.or(
        `email.ilike.%${term}%,username.ilike.%${term}%`,
      )
    }
  }

  // ── Filter
  if (filter === 'banned') {
    query = query.eq('is_banned', true)
  } else if (filter !== 'all') {
    query = query.eq('role', filter)
  }

  // ── Sort (created_at variants; active is done in JS after Auth enrichment)
  if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error('[getAllUsers]', error.message)
    return []
  }

  const profiles = (data ?? []) as Profile[]

  // ── Enrich with last_sign_in_at from auth.users via Admin API
  try {
    const admin = adminClient()
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const signInMap = new Map<string, string | null>()
    for (const u of authData?.users ?? []) {
      signInMap.set(u.id, u.last_sign_in_at ?? null)
    }
    const enriched = profiles.map(p => ({
      ...p,
      last_sign_in_at: signInMap.get(p.id) ?? null,
    }))

    // ── Sort by last_sign_in_at (in-memory, needs Auth data)
    if (sort === 'active') {
      return enriched.sort((a, b) => {
        const ta = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0
        const tb = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0
        return tb - ta
      })
    }
    return enriched
  } catch {
    return profiles
  }
}
