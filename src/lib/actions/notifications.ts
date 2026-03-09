'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  related_order_id: string | null
  read: boolean
  created_at: string
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

/**
 * Returns the 30 most-recent notifications for the authenticated user,
 * newest first. Safe to call on mount — uses the user's own session.
 */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[Notifications] fetch error:', error.message)
    return []
  }
  return (data ?? []) as AppNotification[]
}

// ─── Mark read ───────────────────────────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
}

// ─── Create — service role only ──────────────────────────────────────────────
// Not exported as a client-callable action; called internally from
// executeOrderAction (which already has the admin client and actor info).

export async function createNotificationsForAction({
  actorUserId,
  counterpartyUserId,
  relatedOrderId,
  actorTitle,
  actorBody,
  counterpartyTitle,
  counterpartyBody,
  type,
}: {
  actorUserId: string
  counterpartyUserId: string | null
  relatedOrderId: string
  actorTitle: string
  actorBody: string
  counterpartyTitle: string
  counterpartyBody: string
  type: string
}): Promise<void> {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rows = [
    {
      user_id:          actorUserId,
      title:            actorTitle,
      body:             actorBody,
      type,
      related_order_id: relatedOrderId,
    },
  ]

  if (counterpartyUserId) {
    rows.push({
      user_id:          counterpartyUserId,
      title:            counterpartyTitle,
      body:             counterpartyBody,
      type,
      related_order_id: relatedOrderId,
    })
  }

  const { error } = await admin.from('notifications').insert(rows)
  if (error) console.error('[Notifications] insert error:', error.message)
}

// ─── Rank-update notification (booster → client only, in-app only) ───────────

/**
 * Inserts a single in-app notification for the client when a booster
 * updates the live rank progression. Called from the client component
 * directly — uses the service role to bypass RLS.
 */
export async function notifyRankUpdate({
  orderId,
  clientId,
  newRank,
}: {
  orderId: string
  clientId: string
  newRank: string
}): Promise<void> {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await admin.from('notifications').insert({
    user_id:          clientId,
    title:            'Rank Progress Updated',
    body:             `Your booster updated your current rank to ${newRank}.`,
    type:             'rank_update',
    related_order_id: orderId,
  })
  if (error) console.error('[notifyRankUpdate] insert error:', error.message)
}
