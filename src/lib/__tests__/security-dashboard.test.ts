/**
 * Tests for the Security & Fraud Control Center utilities.
 *
 * Coverage areas:
 *   ── isIpAddress ──────────────────────────────────────────────────────────
 *   1.  Valid IPv4 dotted-decimal            → true
 *   2.  Boundary IPv4 (255.255.255.255)      → true
 *   3.  IPv4 with trailing port (x.x.x.x:80)→ false  (was a bug, now fixed)
 *   4.  IPv4 octet out-of-range (256.0.0.1)  → false
 *   5.  Truncated IPv4 (1.2.3)               → false
 *   6.  Plain hostname / word               → false
 *   7.  Loose colon-pair "a:b"              → false  (was a bug, now fixed)
 *   8.  Valid full-form IPv6                → true
 *   9.  Compressed IPv6 (::1)               → true
 *   10. Fully-compressed IPv6 (::)          → true
 *   11. Real-world compressed IPv6          → true
 *   12. Hex word with no colons             → false
 *
 *   ── isPrivateIp ──────────────────────────────────────────────────────────
 *   13. 127.0.0.1 is private                → true
 *   14. ::1 is private                      → true
 *   15. 10.x.x.x is private                 → true
 *   16. 192.168.x.x is private              → true
 *   17. 172.16.x.x is private               → true
 *   18. 172.31.x.x is private               → true
 *   19. 172.15.x.x is NOT private           → false
 *   20. 172.32.x.x is NOT private           → false
 *   21. Public IPv4 is not private          → false
 *   22. IPv6 private fc00:: range           → true
 *   23. IPv6 link-local fe80::1             → true
 *   24. Public IPv6 (2001:db8::1)           → false
 *
 *   ── parseUA ──────────────────────────────────────────────────────────────
 *   25. null returns null
 *   26. Empty string returns null
 *   27. Chrome on Windows 10               → { os: 'Windows 10', browser: 'Chrome' }
 *   28. Firefox on macOS Sonoma            → { os: 'macOS Sonoma', browser: 'Firefox' }
 *   29. Edge on Windows 11                 → { os: 'Windows 11', browser: 'Edge' }
 *   30. Safari on macOS (generic)          → { os: 'macOS', browser: 'Safari' }
 *   31. Unknown UA returns both 'Unknown'  → { os: 'Unknown OS', browser: 'Unknown' }
 *
 *   ── buildLinkMaps ────────────────────────────────────────────────────────
 *   32. Private IPs excluded from ipToUsers
 *   33. Public IPs mapped correctly
 *   34. Null IBANs excluded from ibanToUsers
 *   35. Shared IBAN maps multiple users
 *
 *   ── buildLinkedAccounts ──────────────────────────────────────────────────
 *   36. Private IP does NOT create IP-link
 *   37. Shared public IP creates IP-link
 *   38. Shared IBAN creates IBAN-link
 *   39. Null IBAN does NOT create IBAN-link
 *   40. Same user never linked to themselves
 *   41. Duplicate other-user appears only once (ip + iban shared)
 */

import { describe, it, expect } from 'vitest'
import {
  isIpAddress,
  isPrivateIp,
  parseUA,
  buildLinkMaps,
  buildLinkedAccounts,
} from '@/lib/utils/security-utils'

// ─── isIpAddress ───────────────────────────────────────────────────────────────

describe('isIpAddress', () => {
  it('accepts a valid public IPv4', () => {
    expect(isIpAddress('203.0.113.42')).toBe(true)
  })

  it('accepts boundary IPv4 255.255.255.255', () => {
    expect(isIpAddress('255.255.255.255')).toBe(true)
  })

  it('rejects IPv4 with a port number (bug fix)', () => {
    expect(isIpAddress('192.168.1.1:8080')).toBe(false)
  })

  it('rejects IPv4 with out-of-range octet', () => {
    expect(isIpAddress('256.0.0.1')).toBe(false)
  })

  it('rejects truncated IPv4', () => {
    expect(isIpAddress('1.2.3')).toBe(false)
  })

  it('rejects a plain hostname', () => {
    expect(isIpAddress('google.com')).toBe(false)
  })

  it('rejects loose two-token colon pair "a:b" (bug fix)', () => {
    expect(isIpAddress('a:b')).toBe(false)
  })

  it('accepts a full-form IPv6', () => {
    expect(isIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
  })

  it('accepts compressed IPv6 ::1', () => {
    expect(isIpAddress('::1')).toBe(true)
  })

  it('accepts fully-compressed IPv6 ::', () => {
    expect(isIpAddress('::')).toBe(true)
  })

  it('accepts real-world compressed IPv6', () => {
    expect(isIpAddress('2001:db8::1')).toBe(true)
  })

  it('rejects a hex word with no colons', () => {
    expect(isIpAddress('deadbeef')).toBe(false)
  })
})

// ─── isPrivateIp ──────────────────────────────────────────────────────────────

describe('isPrivateIp', () => {
  it('127.0.0.1 is private', () => expect(isPrivateIp('127.0.0.1')).toBe(true))
  it('::1 is private', ()       => expect(isPrivateIp('::1')).toBe(true))
  it('10.0.0.1 is private', ()  => expect(isPrivateIp('10.0.0.1')).toBe(true))
  it('10.255.255.255 is private', () => expect(isPrivateIp('10.255.255.255')).toBe(true))
  it('192.168.0.1 is private', () => expect(isPrivateIp('192.168.0.1')).toBe(true))
  it('172.16.0.1 is private', () => expect(isPrivateIp('172.16.0.1')).toBe(true))
  it('172.31.255.255 is private', () => expect(isPrivateIp('172.31.255.255')).toBe(true))
  it('172.15.0.1 is NOT private', () => expect(isPrivateIp('172.15.0.1')).toBe(false))
  it('172.32.0.1 is NOT private', () => expect(isPrivateIp('172.32.0.1')).toBe(false))
  it('203.0.113.1 is NOT private', () => expect(isPrivateIp('203.0.113.1')).toBe(false))
  it('fc00::1 is private (ULA)', () => expect(isPrivateIp('fc00::1')).toBe(true))
  it('fe80::1 is private (link-local)', () => expect(isPrivateIp('fe80::1')).toBe(true))
  it('2001:db8::1 is NOT private', () => expect(isPrivateIp('2001:db8::1')).toBe(false))
})

// ─── parseUA ──────────────────────────────────────────────────────────────────

describe('parseUA', () => {
  it('returns null for null input', () => {
    expect(parseUA(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseUA('')).toBeNull()
  })

  it('detects Chrome on Windows 10', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const result = parseUA(ua)
    expect(result?.os).toBe('Windows 10')
    expect(result?.browser).toBe('Chrome')
  })

  it('detects Firefox on macOS Sonoma', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:126.0) Gecko/20100101 Firefox/126.0'
    const result = parseUA(ua)
    expect(result?.os).toBe('macOS Sonoma')
    expect(result?.browser).toBe('Firefox')
  })

  it('detects Edge on Windows 11', () => {
    // Windows 11 reports as NT 10.0 but with a different build; the UA typically still has NT 10.0 
    // Our rule: "windows nt 11.0" → Windows 11. Test the explicit branch:
    const ua = 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
    const result = parseUA(ua)
    expect(result?.os).toBe('Windows 11')
    expect(result?.browser).toBe('Edge')
  })

  it('detects Safari on generic macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    const result = parseUA(ua)
    expect(result?.os).toBe('macOS')
    expect(result?.browser).toBe('Safari')
  })

  it('returns Unknown for unrecognised UA', () => {
    const ua = 'CustomBot/1.0'
    const result = parseUA(ua)
    expect(result?.os).toBe('Unknown OS')
    expect(result?.browser).toBe('Unknown')
  })
})

// ─── buildLinkMaps ────────────────────────────────────────────────────────────

describe('buildLinkMaps', () => {
  it('excludes private IPs from ipToUsers', () => {
    const { ipToUsers } = buildLinkMaps(
      [
        { id: 'u1', last_sign_in_ip: '192.168.1.1' },
        { id: 'u2', last_sign_in_ip: '127.0.0.1' },
      ],
      [],
    )
    expect(ipToUsers.size).toBe(0)
  })

  it('maps public IPs to user IDs', () => {
    const { ipToUsers } = buildLinkMaps(
      [
        { id: 'u1', last_sign_in_ip: '203.0.113.5' },
        { id: 'u2', last_sign_in_ip: '203.0.113.5' },
        { id: 'u3', last_sign_in_ip: '8.8.8.8' },
      ],
      [],
    )
    expect(ipToUsers.get('203.0.113.5')).toEqual(['u1', 'u2'])
    expect(ipToUsers.get('8.8.8.8')).toEqual(['u3'])
  })

  it('excludes null IBANs from ibanToUsers', () => {
    const { ibanToUsers } = buildLinkMaps(
      [],
      [
        { id: 'u1', bank_iban: null },
        { id: 'u2', bank_iban: '' },
      ],
    )
    expect(ibanToUsers.size).toBe(0)
  })

  it('maps shared IBANs to multiple user IDs', () => {
    const { ibanToUsers } = buildLinkMaps(
      [],
      [
        { id: 'u1', bank_iban: 'GB29NWBK60161331926819' },
        { id: 'u2', bank_iban: 'GB29NWBK60161331926819' },
        { id: 'u3', bank_iban: 'DE89370400440532013000' },
      ],
    )
    expect(ibanToUsers.get('GB29NWBK60161331926819')).toEqual(['u1', 'u2'])
    expect(ibanToUsers.get('DE89370400440532013000')).toEqual(['u3'])
  })
})

// ─── buildLinkedAccounts ──────────────────────────────────────────────────────

const profileMap = new Map([
  ['u1', { email: 'alice@example.com', username: 'alice' }],
  ['u2', { email: 'bob@example.com',   username: 'bob' }],
  ['u3', { email: 'carol@example.com', username: null }],
])

describe('buildLinkedAccounts', () => {
  it('does NOT link accounts when IP is private', () => {
    const ipToUsers   = new Map([['192.168.1.1', ['u1', 'u2']]])
    const ibanToUsers = new Map<string, string[]>()
    const linked = buildLinkedAccounts('u1', '192.168.1.1', null, ipToUsers, ibanToUsers, profileMap)
    expect(linked).toHaveLength(0)
  })

  it('links accounts sharing a public IP', () => {
    const ipToUsers   = new Map([['203.0.113.5', ['u1', 'u2', 'u3']]])
    const ibanToUsers = new Map<string, string[]>()
    const linked = buildLinkedAccounts('u1', '203.0.113.5', null, ipToUsers, ibanToUsers, profileMap)
    expect(linked).toHaveLength(2)
    expect(linked.every(l => l.reason === 'ip')).toBe(true)
    expect(linked.map(l => l.userId)).toEqual(expect.arrayContaining(['u2', 'u3']))
  })

  it('links accounts sharing an IBAN', () => {
    const ipToUsers   = new Map<string, string[]>()
    const ibanToUsers = new Map([['GB29NWBK60161331926819', ['u1', 'u2']]])
    const linked = buildLinkedAccounts('u1', null, 'GB29NWBK60161331926819', ipToUsers, ibanToUsers, profileMap)
    expect(linked).toHaveLength(1)
    expect(linked[0].userId).toBe('u2')
    expect(linked[0].reason).toBe('iban')
  })

  it('does NOT link on a null IBAN', () => {
    const ipToUsers   = new Map<string, string[]>()
    const ibanToUsers = new Map([['GB29NWBK60161331926819', ['u1', 'u2']]])
    const linked = buildLinkedAccounts('u1', null, null, ipToUsers, ibanToUsers, profileMap)
    expect(linked).toHaveLength(0)
  })

  it('never links a user to themselves', () => {
    const ipToUsers   = new Map([['203.0.113.5', ['u1']]])
    const ibanToUsers = new Map<string, string[]>()
    const linked = buildLinkedAccounts('u1', '203.0.113.5', null, ipToUsers, ibanToUsers, profileMap)
    expect(linked).toHaveLength(0)
  })

  it('deduplicates when another user shares both IP and IBAN', () => {
    const ipToUsers   = new Map([['203.0.113.5', ['u1', 'u2']]])
    const ibanToUsers = new Map([['IBAN123', ['u1', 'u2']]])
    const linked = buildLinkedAccounts('u1', '203.0.113.5', 'IBAN123', ipToUsers, ibanToUsers, profileMap)
    // u2 appears in both maps — should appear only once (via IP, first found)
    expect(linked).toHaveLength(1)
    expect(linked[0].userId).toBe('u2')
    expect(linked[0].reason).toBe('ip')
  })
})
