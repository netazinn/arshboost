'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveBoosterOrder } from '@/lib/supabase/queries/booster'

// ── Shared result type ────────────────────────────────────────────────────────

export interface ActionResult {
  error:   string | null
  success: boolean
}

// ── Claim a boost ─────────────────────────────────────────────────────────────
// Validation: blocks while the booster already has an active (in_progress) order.
// Mutation:   sets booster_id on the target order (concurrency-safe via IS NULL guard).

export async function claimBoostAction(
  orderId: string
): Promise<ActionResult & { orderId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized.', success: false }

  // Guard: enforce one active order at a time
  const existing = await getActiveBoosterOrder(user.id)
  if (existing) {
    return { error: 'You already have an active order.', success: false }
  }

  // Claim: only succeeds if order is still unclaimed (IS NULL acts as optimistic lock)
  const { error } = await supabase
    .from('orders')
    .update({
      booster_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'in_progress')
    .is('booster_id', null)

  if (error) return { error: error.message, success: false }

  revalidatePath('/dashboard/boosts')
  revalidatePath(`/dashboard/boosts/${orderId}`)

  return { error: null, success: true, orderId }
}

// ── Update booster settings ───────────────────────────────────────────────────
// Currently only syncs profile fields that exist in the DB schema.
// Phone number, language preferences, and bank details will be wired once
// their respective tables (booster_settings, booster_bank_details) are created.

export async function updateBoosterSettingsAction(data: {
  username?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized.', success: false }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.username !== undefined) updates.username = data.username

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { error: error.message, success: false }

  revalidatePath('/dashboard/settings')
  return { error: null, success: true }
}
