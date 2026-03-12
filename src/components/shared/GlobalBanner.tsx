import { getGlobalSettings } from '@/lib/data/settings'

// ─── Color palette ────────────────────────────────────────────────────────────
// Each preset carries a bg hex and a pre-computed readable text hex so we
// never rely on Tailwind dynamic class names (which get purged at build time).

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  amber:  { bg: '#fbbf24', text: '#451a03' },  // amber-400  / amber-950
  green:  { bg: '#22c55e', text: '#052e16' },  // green-500  / green-950
  red:    { bg: '#ef4444', text: '#fff1f2' },  // red-500    / rose-50
  blue:   { bg: '#3b82f6', text: '#eff6ff' },  // blue-500   / blue-50
  purple: { bg: '#a855f7', text: '#faf5ff' },  // purple-500 / purple-50
  slate:  { bg: '#475569', text: '#f8fafc' },  // slate-600  / slate-50
}

const FALLBACK = COLOR_MAP.amber

/**
 * Server Component — renders a sticky announcement banner at the top of the
 * page when `is_announcement_active` is true in global_settings.
 * Returns null when the banner is inactive (no DOM output, zero cost).
 */
export async function GlobalBanner() {
  const { is_announcement_active, announcement_text, announcement_color } =
    await getGlobalSettings()

  if (!is_announcement_active || !announcement_text.trim()) return null

  const { bg, text } = COLOR_MAP[announcement_color] ?? FALLBACK

  return (
    <div
      role="banner"
      aria-live="polite"
      style={{ backgroundColor: bg, color: text }}
      className="sticky top-0 z-50 w-full px-4 py-2.5 text-center"
    >
      <p
        title={announcement_text}
        className="line-clamp-2 font-mono text-xs font-semibold tracking-[-0.03em]"
      >
        {announcement_text}
      </p>
    </div>
  )
}
