import { createClient as createServiceClient } from '@supabase/supabase-js'

export interface GlobalSettings {
  // ─── Financial ────────────────────────────────────────────────────────────
  flat_platform_fee: number
  min_withdrawal_amount: number
  duo_boost_multiplier: number
  // ─── Operational ─────────────────────────────────────────────────────────
  is_maintenance_mode: boolean
  halt_new_orders: boolean
  auto_complete_hours: number
  auto_cancel_hours: number
  iban_cooldown_days: number
  // ─── Communications ───────────────────────────────────────────────────────
  is_announcement_active: boolean
  announcement_text: string
  announcement_color: string
}

const DEFAULTS: GlobalSettings = {
  flat_platform_fee: 4,
  min_withdrawal_amount: 50,
  duo_boost_multiplier: 1.5,
  is_maintenance_mode: false,
  halt_new_orders: false,
  auto_complete_hours: 72,
  auto_cancel_hours: 48,
  iban_cooldown_days: 30,
  is_announcement_active: false,
  announcement_text: '',
  announcement_color: 'amber',
}

/**
 * Fetches platform-wide settings from the global_settings singleton row.
 * Uses the service-role client so it works inside server actions and server
 * components regardless of the calling user's role.
 *
 * Falls back to hardcoded defaults if the table is unavailable (e.g. during
 * local development before the migration has been applied).
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await admin
      .from('global_settings')
      .select('flat_platform_fee, min_withdrawal_amount, duo_boost_multiplier, is_maintenance_mode, halt_new_orders, auto_complete_hours, auto_cancel_hours, iban_cooldown_days, is_announcement_active, announcement_text, announcement_color')
      .eq('id', 1)
      .single()

    if (error || !data) return DEFAULTS

    return {
      flat_platform_fee:          Number(data.flat_platform_fee),
      min_withdrawal_amount:      Number(data.min_withdrawal_amount),
      duo_boost_multiplier:       Number(data.duo_boost_multiplier),
      is_maintenance_mode:        Boolean(data.is_maintenance_mode),
      halt_new_orders:            Boolean(data.halt_new_orders),
      auto_complete_hours:        Number(data.auto_complete_hours),
      auto_cancel_hours:          Number(data.auto_cancel_hours),
      iban_cooldown_days:         Number(data.iban_cooldown_days),
      is_announcement_active:     Boolean(data.is_announcement_active),
      announcement_text:          String(data.announcement_text ?? ''),
      announcement_color:         String(data.announcement_color ?? 'amber'),
    }
  } catch {
    return DEFAULTS
  }
}
