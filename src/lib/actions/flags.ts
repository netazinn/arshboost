'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeRiskScore } from '@/lib/utils/anomaly-detection'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Appends a flag to the user's profile (if not already present) and
 * inserts an audit row into user_flags.
 *
 * Safe to call fire-and-forget — never throws.
 */
export async function flagUser(
  userId: string,
  flag:   string,
  detail?: string,
): Promise<void> {
  try {
    const admin = serviceClient()

    // 1. Read current flags
    const { data: profile } = await admin
      .from('profiles')
      .select('risk_flags')
      .eq('id', userId)
      .single()

    const existing: string[] = (profile?.risk_flags ?? []) as string[]
    const updated  = existing.includes(flag) ? existing : [...existing, flag]
    const newScore = computeRiskScore(updated)

    // 2. Upsert risk data on profile
    await admin
      .from('profiles')
      .update({ risk_flags: updated, risk_score: newScore })
      .eq('id', userId)

    // 3. Append audit log entry (always, even for repeat flags — for history)
    await admin.from('user_flags').insert({
      user_id:    userId,
      flag,
      detail:     detail ?? null,
    })
  } catch (err) {
    console.error('[flagUser] failed to flag user', userId, flag, err)
  }
}
