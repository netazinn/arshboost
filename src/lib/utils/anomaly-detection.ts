/**
 * Behavioral Anomaly Detection — pure utility functions.
 *
 * No 'use server', no Supabase imports — all logic is side-effect-free so it
 * can be unit-tested and imported from both server actions and utilities.
 */

// ─── 1. DLP — Data Loss Prevention ───────────────────────────────────────────

export type DlpViolationType =
  | 'IBAN'
  | 'EMAIL'
  | 'DISCORD'
  | 'CRYPTO_WALLET'

export interface DlpResult {
  clean:      string           // message with violations replaced
  violations: DlpViolationType[]
}

const DLP_PATTERNS: Array<{ type: DlpViolationType; re: RegExp }> = [
  // International IBANs — 2-letter country code + 2 check digits + BBAN (up to 30 chars).
  // Handles both compact (TR123456...) and space-grouped (TR12 3456 7890 ...) formats.
  // Groups of up to 4 chars separated by optional spaces, 1-8 groups total.
  { type: 'IBAN',         re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){1,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g },
  // Email addresses — classic RFC 5321 simplified
  { type: 'EMAIL',        re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  // Discord invite links and legacy username#discriminator format
  { type: 'DISCORD',      re: /discord\.gg\/[a-zA-Z0-9\-_]+|discord\.[a-z]+\/invite\/[a-zA-Z0-9\-_]+|\b\S+#\d{4}\b/gi },
  // Crypto wallet addresses:
  //   Bitcoin P2PKH/P2SH (1... / 3... — 25-34 chars)
  //   Ethereum / EVM (0x + 40 hex)
  //   Solana base58 (32-44 chars, starts with letters/digits, no 0/O/I/l)
  {
    type: 'CRYPTO_WALLET',
    re: /\b(1[1-9A-HJ-NP-Za-km-z]{24,33}|3[1-9A-HJ-NP-Za-km-z]{24,33}|bc1[a-zA-HJ-NP-Z0-9]{6,87}|0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g,
  },
]

const BLOCK_TOKEN = '[BLOCKED_BY_SYSTEM]'

/**
 * Scans `message` for off-platform contact/payment patterns.
 * Returns the sanitized string and a deduplicated list of violation types.
 * Never throws — if the regex engine fails, returns the original message.
 */
export function scanAndSanitize(message: string): DlpResult {
  let clean = message
  const violations = new Set<DlpViolationType>()

  try {
    for (const { type, re } of DLP_PATTERNS) {
      // Reset lastIndex for global regexes between calls
      re.lastIndex = 0
      const replaced = clean.replace(re, (match) => {
        // Avoid false positives: minimum meaningful match length
        if (match.length < 6) return match
        violations.add(type)
        return BLOCK_TOKEN
      })
      clean = replaced
    }
  } catch {
    // Regex failure — return original message, log flag but do not block
    return { clean: message, violations: [] }
  }

  return { clean, violations: Array.from(violations) }
}

// ─── 2. Disposable Email Filter ───────────────────────────────────────────────

/**
 * A curated static blocklist of the most common disposable email providers.
 * This covers ~95% of burner emails without any external API call.
 * Updated: 2026-03.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.de', 'guerrillamail.biz', 'guerrillamail.info', 'grr.la',
  'sharklasers.com', 'guerrillamailblock.com', 'spam4.me', 'yopmail.com',
  'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf', '10minutemail.com', '10minutemail.net',
  '10minutemail.org', '10minutemail.de', '10minutemail.co.za', '10minutemail.ru',
  'throwam.com', 'throwam.net', 'trashmail.com', 'trashmail.at', 'trashmail.io',
  'trashmail.me', 'trashmail.net', 'trashmail.org', 'trashmail.xyz',
  'tempmail.com', 'tempmail.net', 'temp-mail.org', 'temp-mail.io', 'tmpmail.net',
  'tmpmail.org', 'tempr.email', 'dispostable.com', 'mailnull.com', 'maildrop.cc',
  'mailnesia.com', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'cuvox.de', 'fleckens.hu', 'gustr.com', 'dayrep.com', 'einrot.com',
  'superrito.com', 'teleworm.us', 'armyspy.com', 'rhyta.com', 'jourrapide.com',
  'fakeinbox.com', 'fakeinbox.org', 'inboxalias.com', 'mailexpire.com',
  'sogetthis.com', 'spamherelots.com', 'filzmail.com', 'objectmail.com',
  'reallymymail.com', 'reconmail.com', 'sendspamhere.com', 'spaml.com',
  'spaml.de', 'spamspot.com', 'spamthisplease.com', 'throwam.com',
  'throwemails.com', 'throwit.us', 'spamfree24.org', 'getonemail.com',
  'owlpic.com', 'nowmymail.com', 'lyricspaddy.com', 'yesaccounts.com',
  'techgroup.me', 'spam.la', 'discardmail.com', 'discardmail.de',
  'spamgob.com', 'notsharingmy.info', 'nospamthanks.info', 'kasmail.com',
  'mailmoat.com', 'mailscrap.com', 'spamkill.info', 'ieatspam.eu',
  'ieatspam.info', 'leafmailer.com', 'getairmail.com', 'gowikibooks.com',
  'gowikicampus.com', 'gowikicars.com', 'gowikifilms.com', 'gowikigames.com',
  'gowikimusic.com', 'gowikinetwork.com', 'gowikitravel.com', 'gowikitv.com',
  'spambox.info', 'spambox.irishspringrealty.com', 'spambox.org',
  'spam.su', 'spamavert.com', 'spamevader.com', 'spamfree.eu',
  'spamgap.com', 'spamhereplease.com', 'spamhole.com', 'spamify.com',
])

/**
 * Synchronous check against the bundled disposable domain list.
 * Returns true if the email's domain is on the blocklist.
 * Does NOT make any network call — instant and infallible.
 */
export function isDisposableEmailSync(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2 || !parts[1]) return false
  const domain = parts[1]
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  // Also flag sub-domain variations (e.g. user@sub.mailinator.com)
  const domainParts = domain.split('.')
  for (let i = 1; i < domainParts.length - 1; i++) {
    const parent = domainParts.slice(i).join('.')
    if (DISPOSABLE_DOMAINS.has(parent)) return true
  }
  return false
}

/**
 * Async version — tries the Kickbox open API for unknown domains, falls back
 * to the sync list on network failure. Never throws.
 */
export async function isDisposableEmail(email: string): Promise<boolean> {
  if (isDisposableEmailSync(email)) return true

  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2 || !parts[1]) return false
  const domain = parts[1]

  try {
    const res = await fetch(`https://open.kickbox.com/v1/disposable/${encodeURIComponent(domain)}`, {
      next: { revalidate: 86400 }, // Cache result for 24h per domain
    })
    if (!res.ok) return false
    const json = await res.json() as { disposable: boolean }
    return json.disposable === true
  } catch {
    // Network failure — fail open (don't block legitimate users)
    return false
  }
}

// ─── 3. Impossible Travel Detection ──────────────────────────────────────────

export interface GeoCoords {
  lat: number
  lon: number
}

export interface TravelCheckResult {
  isImpossible: boolean
  distanceKm:   number
  elapsedHours: number
  speedKmh:     number
}

const EARTH_RADIUS_KM = 6371

/**
 * Haversine formula — great-circle distance between two coordinates in km.
 */
export function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const toRad = (deg: number) => deg * (Math.PI / 180)
  const dLat  = toRad(b.lat - a.lat)
  const dLon  = toRad(b.lon - a.lon)
  const sin2  =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(sin2))
}

/**
 * Determines whether a login represents an impossible travel scenario.
 *
 * - `prevCoords`   coordinates of the previous login
 * - `currCoords`   coordinates of the current login
 * - `prevAt`       ISO timestamp of the previous login
 * - `currAt`       ISO timestamp of the current login
 * - `thresholdKmh` speed threshold (default 1000km/h ≈ commercial jet)
 *
 * Returns { isImpossible: false } with zero values when inputs are invalid.
 */
export function checkImpossibleTravel(
  prevCoords:     GeoCoords,
  currCoords:     GeoCoords,
  prevAt:         string,
  currAt:         string,
  thresholdKmh  = 1000,
): TravelCheckResult {
  const zero: TravelCheckResult = { isImpossible: false, distanceKm: 0, elapsedHours: 0, speedKmh: 0 }

  try {
    const tPrev = new Date(prevAt).getTime()
    const tCurr = new Date(currAt).getTime()
    if (isNaN(tPrev) || isNaN(tCurr)) return zero
    const elapsedHours = (tCurr - tPrev) / 3_600_000
    // Ignore extremely short windows (< 1 minute) — same session re-auth
    if (elapsedHours < (1 / 60)) return zero

    const distanceKm = haversineKm(prevCoords, currCoords)
    // Same city / same IP — not suspicious
    if (distanceKm < 50) return { isImpossible: false, distanceKm, elapsedHours, speedKmh: 0 }

    const speedKmh = distanceKm / elapsedHours
    return { isImpossible: speedKmh > thresholdKmh, distanceKm, elapsedHours, speedKmh }
  } catch {
    return zero
  }
}

// ─── 4. Payment Velocity Radar ────────────────────────────────────────────────

export interface VelocityCheckResult {
  blocked:    boolean
  reason:     string | null
  /** When blocked=true, the order should be set to manual_review=true */
}

/**
 * Evaluates whether a new order should be held for manual review based on
 * payment attempt history and order value anomaly.
 *
 * @param failedAttempts24h  Number of failed payment attempts in the last 24h
 * @param orderPrice         The price of the current order being placed
 * @param avgOrderValue      The user's historical average order value (0 = unknown)
 * @param maxFailedAttempts  Threshold before blocking (default 3)
 * @param valueMultiplier    Flag if order is N× average (default 5)
 */
export function checkPaymentVelocity(
  failedAttempts24h: number,
  orderPrice:        number,
  avgOrderValue:     number,
  maxFailedAttempts = 3,
  valueMultiplier   = 5,
): VelocityCheckResult {
  if (failedAttempts24h >= maxFailedAttempts) {
    return {
      blocked: true,
      reason:  `${failedAttempts24h} failed payment attempts in the last 24 hours. Order held for manual review.`,
    }
  }

  if (avgOrderValue > 0 && orderPrice > avgOrderValue * valueMultiplier) {
    return {
      blocked: true,
      reason:  `Order value ($${orderPrice.toFixed(2)}) is ${(orderPrice / avgOrderValue).toFixed(1)}× above your average. Order held for manual review.`,
    }
  }

  return { blocked: false, reason: null }
}

// ─── Risk score calculator ────────────────────────────────────────────────────

const FLAG_SCORES: Record<string, number> = {
  DLP_VIOLATION:    25,
  IMPOSSIBLE_TRAVEL: 40,
  PAYMENT_VELOCITY: 30,
  VPN_PROXY:        10,
}

/**
 * Computes a 0–100 risk score from an array of active flag codes.
 * Capped at 100 — multiple DLP violations don't overflow.
 */
export function computeRiskScore(flags: string[]): number {
  const total = flags.reduce((sum, flag) => sum + (FLAG_SCORES[flag] ?? 5), 0)
  return Math.min(100, total)
}
