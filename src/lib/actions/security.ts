'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isPrivateIp, parseUA } from '@/lib/utils/security-utils'
import type { DeviceInfo, LinkedAccount } from '@/lib/utils/security-utils'
import { checkImpossibleTravel } from '@/lib/utils/anomaly-detection'
import { flagUser } from '@/lib/actions/flags'

export interface GeoInfo {
  country:     string
  countryCode: string
  city:        string
  isp:         string
  isVpn:       boolean
  lat?:        number
  lon?:        number
}

export interface SecurityProfile {
  userId:            string
  email:             string
  username:          string | null
  role:              string
  is_banned:         boolean
  last_sign_in_at:   string | null
  ip:                string | null
  geo:               GeoInfo | null
  device:            DeviceInfo | null
  linkedAccounts:    LinkedAccount[]
  riskFlags:         string[]
  riskScore:         number
  impossibleTravel:  { distanceKm: number; elapsedHours: number; speedKmh: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdminOnly() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') throw new Error('Forbidden')
  return user
}

interface IpApiResult {
  query:        string
  status:       string
  country?:     string
  countryCode?: string
  city?:        string
  isp?:         string
  proxy?:       boolean
  hosting?:     boolean
  lat?:         number
  lon?:         number
}

async function batchGeocode(ips: string[]): Promise<Map<string, IpApiResult>> {
  const result = new Map<string, IpApiResult>()
  if (ips.length === 0) return result

  // ip-api.com batch: max 100 per request, now including lat/lon for travel detection
  const chunks: string[][] = []
  for (let i = 0; i < ips.length; i += 100) chunks.push(ips.slice(i, i + 100))

  await Promise.all(chunks.map(async chunk => {
    try {
      const res = await fetch(
        'http://ip-api.com/batch?fields=query,status,country,countryCode,city,isp,proxy,hosting,lat,lon',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(chunk.map(ip => ({ query: ip }))),
          next: { revalidate: 3600 },
        },
      )
      if (!res.ok) return
      const data = await res.json() as IpApiResult[]
      for (const item of data) result.set(item.query, item)
    } catch { /* silent failure per chunk */ }
  }))

  return result
}

// ─── getFraudIntelligence ─────────────────────────────────────────────────────

export async function getFraudIntelligence(): Promise<{ data?: SecurityProfile[]; error?: string }> {
  try {
    await requireAdminOnly()
    const admin = serviceClient()

    // 1. Fetch all auth users (IPs, user agents, last_sign_in_at)
    const { data: authListData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) return { error: authErr.message }
    const authUsers = authListData?.users ?? []

    // 2. Fetch all profiles (role, ban, bank_iban, risk fields, prev_sign_in)
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, username, role, is_banned, bank_iban, risk_flags, risk_score, prev_sign_in_ip, prev_sign_in_at')
    if (profilesErr) return { error: profilesErr.message }

    type ProfileRow = {
      id: string; email: string; username: string | null; role: string
      is_banned: boolean; bank_iban: string | null
      risk_flags: string[]; risk_score: number
      prev_sign_in_ip: string | null; prev_sign_in_at: string | null
    }
    const profileMap = new Map<string, ProfileRow>()
    for (const p of (profiles ?? []) as ProfileRow[]) profileMap.set(p.id, p)

    // 3. Build link maps (ip → userIds, iban → userIds)
    const ipToUsers   = new Map<string, string[]>()
    const ibanToUsers = new Map<string, string[]>()

    for (const au of authUsers) {
      const ip = (au as { last_sign_in_ip?: string | null }).last_sign_in_ip ?? null
      if (ip && !isPrivateIp(ip)) {
        const list = ipToUsers.get(ip) ?? []; list.push(au.id); ipToUsers.set(ip, list)
      }
    }
    for (const p of (profiles ?? []) as ProfileRow[]) {
      if (p.bank_iban) {
        const list = ibanToUsers.get(p.bank_iban) ?? []; list.push(p.id); ibanToUsers.set(p.bank_iban, list)
      }
    }

    // 4. Batch geocode unique non-private IPs
    const geoMap = await batchGeocode(Array.from(ipToUsers.keys()))

    // 5. Build SecurityProfile per auth user that has a matching profile
    const result: SecurityProfile[] = []

    for (const au of authUsers) {
      const profile = profileMap.get(au.id)
      if (!profile) continue

      const ip = (au as { last_sign_in_ip?: string | null }).last_sign_in_ip ?? null
      const ua = (au as { user_agent?:     string | null }).user_agent        ?? null

      let geo: GeoInfo | null = null
      if (ip) {
        if (isPrivateIp(ip)) {
          geo = { country: 'Localhost', countryCode: '', city: 'Development', isp: 'Local Network', isVpn: false }
        } else {
          const g = geoMap.get(ip)
          if (g && g.status === 'success') {
            geo = {
              country:     g.country     ?? '',
              countryCode: g.countryCode ?? '',
              city:        g.city        ?? '',
              isp:         g.isp         ?? '',
              isVpn:       !!(g.proxy || g.hosting),
              lat:         g.lat,
              lon:         g.lon,
            }
          }
        }
      }

      // Linked accounts
      const seen = new Set<string>()
      const linkedAccounts: LinkedAccount[] = []

      if (ip && !isPrivateIp(ip)) {
        for (const otherId of ipToUsers.get(ip) ?? []) {
          if (otherId === au.id || seen.has(otherId)) continue
          const other = profileMap.get(otherId)
          if (other) { linkedAccounts.push({ userId: otherId, email: other.email, username: other.username, reason: 'ip' }); seen.add(otherId) }
        }
      }
      if (profile.bank_iban) {
        for (const otherId of ibanToUsers.get(profile.bank_iban) ?? []) {
          if (otherId === au.id || seen.has(otherId)) continue
          const other = profileMap.get(otherId)
          if (other) { linkedAccounts.push({ userId: otherId, email: other.email, username: other.username, reason: 'iban' }); seen.add(otherId) }
        }
      }

      // ── Impossible Travel check ──────────────────────────────────────────
      let impossibleTravel: SecurityProfile['impossibleTravel'] = null
      if (
        ip && !isPrivateIp(ip) &&
        profile.prev_sign_in_ip && !isPrivateIp(profile.prev_sign_in_ip) &&
        profile.prev_sign_in_at && au.last_sign_in_at &&
        ip !== profile.prev_sign_in_ip
      ) {
        const currGeo = geoMap.get(ip)
        const prevGeo = geoMap.get(profile.prev_sign_in_ip)
        if (
          currGeo?.lat != null && currGeo?.lon != null &&
          prevGeo?.lat != null && prevGeo?.lon != null
        ) {
          const travel = checkImpossibleTravel(
            { lat: prevGeo.lat, lon: prevGeo.lon },
            { lat: currGeo.lat, lon: currGeo.lon },
            profile.prev_sign_in_at,
            au.last_sign_in_at,
          )
          if (travel.isImpossible) {
            impossibleTravel = { distanceKm: travel.distanceKm, elapsedHours: travel.elapsedHours, speedKmh: travel.speedKmh }
            // Fire-and-forget flag (also adds prev IP geo to context)
            flagUser(
              au.id,
              'IMPOSSIBLE_TRAVEL',
              `${profile.prev_sign_in_ip} → ${ip} | ${travel.distanceKm.toFixed(0)}km in ${travel.elapsedHours.toFixed(2)}h (${travel.speedKmh.toFixed(0)}km/h)`,
            ).catch(console.error)
          }
        }
      }

      // Merge any IMPOSSIBLE_TRAVEL already in DB flags (persisted from previous sessions)
      const activeFlags: string[] = Array.isArray(profile.risk_flags) ? profile.risk_flags : []
      // If this session just flagged, ensure it appears immediately in the UI
      if (impossibleTravel && !activeFlags.includes('IMPOSSIBLE_TRAVEL')) {
        activeFlags.push('IMPOSSIBLE_TRAVEL')
      }

      result.push({
        userId:           au.id,
        email:            profile.email,
        username:         profile.username,
        role:             profile.role,
        is_banned:        profile.is_banned,
        last_sign_in_at:  au.last_sign_in_at ?? null,
        ip,
        geo,
        device:           parseUA(ua),
        linkedAccounts,
        riskFlags:        activeFlags,
        riskScore:        profile.risk_score ?? 0,
        impossibleTravel,
      })
    }

    // Sort: VPN first → linked accounts → rest
    result.sort((a, b) => {
      const ra = a.geo?.isVpn ? 2 : a.linkedAccounts.length > 0 ? 1 : 0
      const rb = b.geo?.isVpn ? 2 : b.linkedAccounts.length > 0 ? 1 : 0
      if (rb !== ra) return rb - ra
      return b.linkedAccounts.length - a.linkedAccounts.length
    })

    return { data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── getUsersByIp ─────────────────────────────────────────────────────────────

export async function getUsersByIp(ip: string): Promise<{
  data?: Array<{ id: string; email: string; username: string | null; role: string; is_banned: boolean; created_at: string; last_sign_in_at: string | null }>
  error?: string
}> {
  try {
    await requireAdminOnly()
    if (!ip.trim()) return { data: [] }

    const admin = serviceClient()

    const { data: authListData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) return { error: authErr.message }

    const matchingIds = (authListData?.users ?? [])
      .filter(u => (u as { last_sign_in_ip?: string | null }).last_sign_in_ip === ip.trim())
      .map(u => ({ id: u.id, last_sign_in_at: u.last_sign_in_at ?? null }))

    if (matchingIds.length === 0) return { data: [] }

    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, username, role, is_banned, created_at')
      .in('id', matchingIds.map(u => u.id))
    if (profilesErr) return { error: profilesErr.message }

    const lsMap = new Map(matchingIds.map(u => [u.id, u.last_sign_in_at]))

    return {
      data: (profiles ?? []).map((p: { id: string; email: string; username: string | null; role: string; is_banned: boolean; created_at: string }) => ({
        id:              p.id,
        email:           p.email,
        username:        p.username,
        role:            p.role,
        is_banned:       p.is_banned,
        created_at:      p.created_at,
        last_sign_in_at: lsMap.get(p.id) ?? null,
      })),
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
