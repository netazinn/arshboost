import type { Order } from '@/types'

export type SLAStatus = 'normal' | 'warning' | 'critical'

export interface SLAResult {
  status: SLAStatus
  /** Short text shown inline on the card */
  label: string
  /** Full explanation shown as tooltip on hover */
  tooltip: string
}

export interface SLASettings {
  auto_cancel_hours: number
  auto_complete_hours: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursElapsed(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / 3_600_000
}

function formatHours(h: number): string {
  if (h <= 0) return '0h'
  if (h < 1) return `${Math.ceil(h * 60)}m`
  if (h < 24) return `${Math.round(h)}h`
  const d = Math.floor(h / 24)
  const rem = Math.round(h % 24)
  return rem > 0 ? `${d}d ${rem}h` : `${d}d`
}

// ─── Main function ────────────────────────────────────────────────────────────

const NORMAL: SLAResult = { status: 'normal', label: '', tooltip: '' }

/**
 * Calculates SLA urgency for an order given the platform's auto-action timers.
 *
 * - `pending` / `awaiting_payment`: clock starts at `created_at`, limit is
 *   `auto_cancel_hours`.
 * - `completed` (pending admin approval): clock starts at `completed_at`
 *   (falls back to `updated_at`), limit is `auto_complete_hours`.
 * - All other statuses: returns `normal`.
 *
 * Thresholds:
 *  - `critical` : elapsed ≥ 100 % of SLA limit
 *  - `warning`  : elapsed ≥  80 % of SLA limit
 *  - `normal`   : otherwise
 */
export function calculateSLAStatus(order: Order, settings: SLASettings): SLAResult {
  // ── Pending / unpaid orders ────────────────────────────────────────────────
  if (order.status === 'pending' || order.status === 'awaiting_payment') {
    const elapsed  = hoursElapsed(order.created_at)
    const total    = settings.auto_cancel_hours
    const fraction = elapsed / total

    if (fraction >= 1) {
      return {
        status: 'critical',
        label:   'Auto-cancel pending',
        tooltip: `Overdue by ${formatHours(elapsed - total)} — waiting for auto-cancel cron`,
      }
    }
    if (fraction >= 0.8) {
      const left = formatHours(total - elapsed)
      return {
        status: 'warning',
        label:   `${left} left`,
        tooltip: `${left} remaining until auto-cancel`,
      }
    }
    return NORMAL
  }

  // ── Completed orders (pending admin approval) ─────────────────────────────
  if (order.status === 'completed') {
    const timestamp = order.completed_at ?? order.updated_at
    const elapsed   = hoursElapsed(timestamp)
    const total     = settings.auto_complete_hours
    const fraction  = elapsed / total

    if (fraction >= 1) {
      return {
        status: 'critical',
        label:   'Auto-approve pending',
        tooltip: `Overdue by ${formatHours(elapsed - total)} — waiting for auto-approve cron`,
      }
    }
    if (fraction >= 0.8) {
      const left = formatHours(total - elapsed)
      return {
        status: 'warning',
        label:   `${left} left`,
        tooltip: `${left} remaining until auto-approve`,
      }
    }
    return NORMAL
  }

  return NORMAL
}
