/**
 * Pure, side-effect-free utility functions for the Security & Fraud
 * Control Center. Kept in a separate file (no 'use server') so that
 * unit tests can import them without mocking Next.js or Supabase.
 */

// ─── IP Utilities ─────────────────────────────────────────────────────────────

/**
 * Strict IPv4 regex — rejects ports and trailing garbage.
 * e.g. 203.0.113.42  → true
 *      192.168.1.1   → true  (detection only, not VPN-scope guard)
 *      256.0.0.1     → false
 *      1.2.3         → false
 *      1.2.3.4:8080  → false  (port stripped intentionally)
 */
const IPV4_RE = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/

/**
 * Strict IPv6 regex — must contain at least two colon-separated groups,
 * each group being 1-4 hex digits. Handles compressed `::` notation.
 * e.g. 2001:db8::1            → true
 *      ::1                    → true
 *      fe80::1ff:fe23:4567:890a → true
 *      a:b                    → false (too short / not a real IPv6 address)
 *      hello:world            → false
 */
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d)|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d))$/

/**
 * Returns true if `value` looks like a routable IPv4 or IPv6 address.
 * Used by the /admin/users search bar to switch into IP-search mode.
 */
export function isIpAddress(value: string): boolean {
  const v = value.trim()
  return IPV4_RE.test(v) || IPV6_RE.test(v)
}

/**
 * Returns true for loopback and RFC-1918 / RFC-4291 private addresses.
 * These are never sent to the external geolocation API.
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true
  const v = ip.trim()
  if (v === '127.0.0.1' || v === '::1' || v.toLowerCase() === 'localhost') return true
  if (/^10\./.test(v)) return true
  if (/^192\.168\./.test(v)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true
  // IPv6 private: fc00::/7 (fc/fd), link-local fe80::/10
  if (/^f[cd]/i.test(v)) return true
  if (/^fe80:/i.test(v)) return true
  return false
}

// ─── User-Agent Parser ────────────────────────────────────────────────────────

export interface DeviceInfo {
  os:      string
  browser: string
}

/**
 * Extracts OS and browser from a raw User-Agent string.
 * Returns null if ua is null/empty/malformed — never throws.
 */
export function parseUA(ua: string | null | undefined): DeviceInfo | null {
  if (!ua || typeof ua !== 'string' || !ua.trim()) return null

  let os = 'Unknown OS'
  try {
    if      (/windows nt 11\.0/i.test(ua))  os = 'Windows 11'
    else if (/windows nt 10\.0/i.test(ua))  os = 'Windows 10'
    else if (/windows nt 6\.3/i.test(ua))   os = 'Windows 8.1'
    else if (/windows nt 6\.1/i.test(ua))   os = 'Windows 7'
    else if (/windows/i.test(ua))           os = 'Windows'
    else if (/mac os x 14/i.test(ua))       os = 'macOS Sonoma'
    else if (/mac os x 13/i.test(ua))       os = 'macOS Ventura'
    else if (/mac os x 12/i.test(ua))       os = 'macOS Monterey'
    else if (/mac os x/i.test(ua))          os = 'macOS'
    else if (/android/i.test(ua))           os = 'Android'
    else if (/iphone/i.test(ua))            os = 'iOS (iPhone)'
    else if (/ipad/i.test(ua))              os = 'iOS (iPad)'
    else if (/linux/i.test(ua))             os = 'Linux'
  } catch { os = 'Unknown OS' }

  let browser = 'Unknown'
  try {
    if      (/edg\//i.test(ua))             browser = 'Edge'
    else if (/opr\/|opera\//i.test(ua))     browser = 'Opera'
    else if (/brave/i.test(ua))             browser = 'Brave'
    else if (/chromium/i.test(ua))          browser = 'Chromium'
    else if (/chrome\/\d/i.test(ua))        browser = 'Chrome'
    else if (/firefox\/\d/i.test(ua))       browser = 'Firefox'
    else if (/safari\/\d/i.test(ua))        browser = 'Safari'
  } catch { browser = 'Unknown' }

  return { os, browser }
}

// ─── Smurf / Multi-Account Link Builder ───────────────────────────────────────

export interface LinkedAccount {
  userId:   string
  email:    string
  username: string | null
  reason:   'ip' | 'iban'
}

type ProfileLike = { email: string; username: string | null }

/**
 * For a single user, finds all other users who share their IP or IBAN.
 *
 * Rules:
 *  - Private / localhost IPs are never used for linking.
 *  - null / empty IBANs are never used for linking.
 *  - The same account will never appear twice in the result.
 */
export function buildLinkedAccounts(
  userId:       string,
  ip:           string | null,
  bankIban:     string | null,
  ipToUsers:    Map<string, string[]>,
  ibanToUsers:  Map<string, string[]>,
  profileMap:   Map<string, ProfileLike>,
): LinkedAccount[] {
  const seen: Set<string>       = new Set()
  const result: LinkedAccount[] = []

  // IP-based linking (never for private IPs)
  if (ip && !isPrivateIp(ip)) {
    for (const otherId of ipToUsers.get(ip) ?? []) {
      if (otherId === userId || seen.has(otherId)) continue
      const other = profileMap.get(otherId)
      if (other) {
        result.push({ userId: otherId, email: other.email, username: other.username, reason: 'ip' })
        seen.add(otherId)
      }
    }
  }

  // IBAN-based linking (never for null/empty IBANs)
  if (bankIban && bankIban.trim()) {
    for (const otherId of ibanToUsers.get(bankIban) ?? []) {
      if (otherId === userId || seen.has(otherId)) continue
      const other = profileMap.get(otherId)
      if (other) {
        result.push({ userId: otherId, email: other.email, username: other.username, reason: 'iban' })
        seen.add(otherId)
      }
    }
  }

  return result
}

/**
 * Builds the ip→userIds and iban→userIds maps used by getFraudIntelligence.
 * Kept pure so smurf-matching logic can be unit-tested without Supabase.
 */
export function buildLinkMaps(
  authUsers:   Array<{ id: string; last_sign_in_ip?: string | null }>,
  profileRows: Array<{ id: string; bank_iban: string | null }>,
): {
  ipToUsers:   Map<string, string[]>
  ibanToUsers: Map<string, string[]>
} {
  const ipToUsers   = new Map<string, string[]>()
  const ibanToUsers = new Map<string, string[]>()

  for (const au of authUsers) {
    const ip = au.last_sign_in_ip ?? null
    if (ip && !isPrivateIp(ip)) {
      const list = ipToUsers.get(ip) ?? []
      list.push(au.id)
      ipToUsers.set(ip, list)
    }
  }

  for (const p of profileRows) {
    if (p.bank_iban && p.bank_iban.trim()) {
      const list = ibanToUsers.get(p.bank_iban) ?? []
      list.push(p.id)
      ibanToUsers.set(p.bank_iban, list)
    }
  }

  return { ipToUsers, ibanToUsers }
}
