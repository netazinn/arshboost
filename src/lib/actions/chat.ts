'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ChatMessage, Profile } from '@/types'
import { scanAndSanitize } from '@/lib/utils/anomaly-detection'
import { flagUser } from '@/lib/actions/flags'

export async function sendMessage(orderId: string, content: string) {
  if (!content.trim()) return { error: 'Message cannot be empty' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // ── DLP: scan and sanitize before persisting ──────────────────────────────
  const { clean, violations } = scanAndSanitize(content.trim())
  if (violations.length > 0) {
    flagUser(user.id, 'DLP_VIOLATION', `Order chat ${orderId}: ${violations.join(', ')}`).catch(console.error)
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({ order_id: orderId, sender_id: user.id, content: clean })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath(`/dashboard/boosts/${orderId}`)
  revalidatePath(`/dashboard/support/${orderId}`)

  return { success: true }
}

/** Polling fallback: returns all messages for an order, newest first. */
export async function fetchMessages(orderId: string): Promise<ChatMessage[]> {
  // Verify the caller is authenticated before using service-role to fetch.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Use service-role so the sender:profiles join always returns role data
  // even when the caller is a client/booster who can't read staff profiles.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await admin
    .from('chat_messages')
    .select('*, sender:profiles(id, email, username, avatar_url, role)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ChatMessage[]
}

/**
 * Returns basic profile data (id, username, role, avatar_url) for a given user id.
 * Uses service-role so callers (client/booster) can resolve staff sender roles
 * from Realtime INSERT payloads without hitting the profiles RLS restriction.
 * Caller must be authenticated.
 */
export async function getSenderProfile(senderId: string): Promise<Pick<Profile, 'id' | 'username' | 'email' | 'role' | 'avatar_url'> | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await admin
    .from('profiles')
    .select('id, username, email, role, avatar_url')
    .eq('id', senderId)
    .single()
  return data ?? null
}

/**
 * Insert a system message on behalf of the current user.
 * sender_id = auth.uid() to satisfy the existing RLS insert policy;
 * is_system = true flags it as automated for UI rendering.
 */
export async function sendSystemMessage(
  orderId: string,
  content: string,
  systemType?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      order_id:    orderId,
      sender_id:   user.id,
      content,
      is_system:   true,
      system_type: systemType ?? null,
    })

  if (error) return { error: error.message }
  return {}
}

/**
 * Mark all unread messages from other senders in this order as read.
 * Called by the receiver when they have the chat open.
 */
export async function markMessagesRead(
  orderId: string,
  currentUserId: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('order_id', orderId)
    .neq('sender_id', currentUserId)
    .eq('is_read', false)
}

// ─── Direct Message (Order-less Staff Channels) ───────────────────────────────

/**
 * Send a message to a staff DM thread.
 * threadId format: '{boosterId}:admin' | '{boosterId}:support' | '{boosterId}:accountant'
 * RLS enforces: booster may only write to threads starting with their own user_id;
 * admin/support may write to any DM thread.
 */
export async function sendDmMessage(
  threadId: string,
  content: string,
): Promise<{ error?: string }> {
  if (!content.trim()) return { error: 'Message cannot be empty' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // ── DLP: scan and sanitize before persisting ──────────────────────────────
  const { clean, violations } = scanAndSanitize(content.trim())
  if (violations.length > 0) {
    flagUser(user.id, 'DLP_VIOLATION', `DM thread ${threadId}: ${violations.join(', ')}`).catch(console.error)
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      dm_thread_id: threadId,
      sender_id:    user.id,
      content:      clean,
    })

  if (error) return { error: error.message }
  return {}
}

/**
 * Fetch all messages for a DM thread, ordered oldest→newest.
 */
export async function fetchDmMessages(threadId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('dm_thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[DM] fetchDmMessages error:', error.message)
    return []
  }
  return (data ?? []) as ChatMessage[]
}

/**
 * Fetch the last message for each of the three staff channels for a booster.
 * Returns a map: { admin: ChatMessage|null, support: ChatMessage|null, accountant: ChatMessage|null }
 */
export async function fetchDmLastMessages(
  boosterId: string,
): Promise<Record<string, ChatMessage | null>> {
  const channels = ['admin', 'support', 'accountant'] as const
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { admin: null, support: null, accountant: null }

  const results = await Promise.all(
    channels.map(async (ch) => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('dm_thread_id', `${boosterId}:${ch}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return [ch, (data ?? null) as ChatMessage | null] as const
    }),
  )
  return Object.fromEntries(results)
}
