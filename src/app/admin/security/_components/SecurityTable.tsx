'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  ShieldAlert, Shield, Wifi, Home, Monitor, Laptop, Smartphone,
  AlertTriangle, Loader2, Link2, Eye, ShieldBan, ShieldCheck,
  MapPin, ChevronDown, ChevronUp, X, Plane, TrendingUp, MessageSquareWarning,
  Activity,
} from 'lucide-react'
import type { SecurityProfile } from '@/lib/actions/security'
import { toggleUserBanStatus } from '@/lib/actions/admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  return Array.from(countryCode.toUpperCase())
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterMode = 'all' | 'vpn' | 'smurfs' | 'flagged'

interface Props {
  initialProfiles: SecurityProfile[]
}

// ─── Linked Accounts Popover ─────────────────────────────────────────────────

function LinkedAccountsPopover({ accounts, onClose }: {
  accounts: SecurityProfile['linkedAccounts']
  onClose:  () => void
}) {
  return (
    <div className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] font-bold tracking-[-0.04em] text-white">Linked Accounts</p>
        <button onClick={onClose} className="text-[#4a4a4a] hover:text-white transition-colors">
          <X size={13} strokeWidth={2} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {accounts.map(acc => (
          <div key={acc.userId} className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[-0.04em] text-white">{acc.username ?? '(no username)'}</p>
              <p className="font-mono text-[9px] tracking-[-0.02em] text-[#5a5a5a]">{acc.email}</p>
            </div>
            <span className={clsx(
              'rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest uppercase',
              acc.reason === 'ip'
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                : 'border-purple-500/30 bg-purple-500/10 text-purple-400',
            )}>
              {acc.reason === 'ip' ? 'IP' : 'IBAN'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export function SecurityTable({ initialProfiles }: Props) {
  const [profiles, setProfiles]   = useState<SecurityProfile[]>(initialProfiles)
  const [filter, setFilter]       = useState<FilterMode>('all')
  const [banLoading, setBanLoading] = useState<string | null>(null)
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'vpn')     return profiles.filter(p => p.geo?.isVpn)
    if (filter === 'smurfs')  return profiles.filter(p => p.linkedAccounts.length > 0)
    if (filter === 'flagged') return profiles.filter(p => p.riskFlags.length > 0)
    return profiles
  }, [profiles, filter])

  const vpnCount     = profiles.filter(p => p.geo?.isVpn).length
  const smurfCount   = profiles.filter(p => p.linkedAccounts.length > 0).length
  const flaggedCount = profiles.filter(p => p.riskFlags.length > 0).length

  async function handleBanToggle(profile: SecurityProfile) {
    setBanLoading(profile.userId)
    const res = await toggleUserBanStatus(profile.userId)
    setBanLoading(null)
    if (!res.error && res.is_banned !== undefined) {
      setProfiles(prev => prev.map(p =>
        p.userId === profile.userId ? { ...p, is_banned: res.is_banned as boolean } : p,
      ))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {([
          { key: 'all',     label: 'All Users',                count: profiles.length },
          { key: 'vpn',     label: 'VPN / Proxy',              count: vpnCount,     alert: vpnCount     > 0 },
          { key: 'smurfs',  label: 'Linked Accounts (Smurfs)',  count: smurfCount,   alert: smurfCount   > 0 },
          { key: 'flagged', label: 'Flagged',                   count: flaggedCount, alert: flaggedCount > 0 },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[-0.04em] transition-colors',
              filter === tab.key
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-[#1a1a1a] bg-[#0a0a0a] text-[#6a6a6a] hover:border-[#2a2a2a] hover:text-[#9a9a9a]',
            )}
          >
            {tab.label}
            <span className={clsx(
              'rounded px-1.5 py-0.5 font-mono text-[9px]',
              'alert' in tab && tab.alert
                ? filter === tab.key ? 'bg-red-500/20 text-red-400' : 'bg-red-500/10 text-red-500'
                : filter === tab.key ? 'bg-white/10 text-white/60' : 'bg-[#1a1a1a] text-[#4a4a4a]',
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
              {['User', 'Location & ISP', 'Risk', 'Device', 'Linked', 'Last Active', 'Actions'].map((h, i) => (
                <th
                  key={i}
                  className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    {filter === 'vpn' ? (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-500/20 bg-green-500/5">
                          <Shield size={18} strokeWidth={1.5} className="text-green-500/60" />
                        </div>
                        <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-[#5a5a5a]">No VPN or proxy users detected</p>
                        <p className="font-mono text-[9px] tracking-[-0.02em] text-[#3a3a3a]">All current users appear to be on residential connections.</p>
                      </>
                    ) : filter === 'smurfs' ? (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/5">
                          <ShieldCheck size={18} strokeWidth={1.5} className="text-blue-500/60" />
                        </div>
                        <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-[#5a5a5a]">No linked accounts found</p>
                        <p className="font-mono text-[9px] tracking-[-0.02em] text-[#3a3a3a]">No users share an IP address or bank IBAN with another account.</p>
                      </>
                    ) : filter === 'flagged' ? (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-500/20 bg-green-500/5">
                          <ShieldCheck size={18} strokeWidth={1.5} className="text-green-500/60" />
                        </div>
                        <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-[#5a5a5a]">No flagged users</p>
                        <p className="font-mono text-[9px] tracking-[-0.02em] text-[#3a3a3a]">No users have triggered DLP, travel, or velocity anomaly flags.</p>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0a0a0a]">
                          <ShieldAlert size={18} strokeWidth={1.5} className="text-[#4a4a4a]" />
                        </div>
                        <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-[#5a5a5a]">No users found</p>
                        <p className="font-mono text-[9px] tracking-[-0.02em] text-[#3a3a3a]">Security data will appear here once users have logged in.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : filtered.map(profile => {
              const isBanning = banLoading === profile.userId
              const hasLinks  = profile.linkedAccounts.length > 0
              const isPoOpen  = openPopover === profile.userId

              return (
                <tr
                  key={profile.userId}
                  className={clsx(
                    'border-b border-[#0f0f0f] transition-colors hover:bg-[#0d0d0d]',
                    profile.is_banned && 'opacity-40',
                  )}
                >
                  {/* User */}
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white">
                      {profile.username ?? '(no username)'}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#5a5a5a]">
                      {profile.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[8px] text-[#7a7a7a]">
                        {profile.role}
                      </span>
                      {profile.is_banned && (
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[8px] text-red-400">
                          🚫 BANNED
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-5 py-3.5">
                    {profile.geo ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#4a4a4a]" />
                        <div>
                          <p className="font-mono text-[10px] tracking-[-0.04em] text-[#c0c0c0]">
                            {flagEmoji(profile.geo.countryCode)}{' '}
                            {profile.geo.city && `${profile.geo.city}, `}{profile.geo.country}
                          </p>
                          {profile.geo.isp && (
                            <p className="font-mono text-[9px] tracking-[-0.02em] text-[#5a5a5a]">{profile.geo.isp}</p>
                          )}
                          {profile.ip && (
                            <p className="font-mono text-[9px] tracking-[-0.02em] text-[#3a3a3a]">{profile.ip}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-[#3a3a3a]">
                        {profile.ip ?? 'No IP logged'}
                      </span>
                    )}
                  </td>

                  {/* Risk */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      {profile.geo?.isVpn ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-red-400 uppercase">
                          <Wifi size={9} strokeWidth={2.5} />
                          VPN / Proxy
                        </span>
                      ) : profile.ip ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-green-500/20 bg-green-500/5 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-green-500 uppercase">
                          <Home size={9} strokeWidth={2.5} />
                          Residential
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-[#3a3a3a]">—</span>
                      )}

                      {profile.riskFlags.includes('DLP_VIOLATION') && (
                        <span className="inline-flex items-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-orange-400 uppercase">
                          <MessageSquareWarning size={9} strokeWidth={2.5} />
                          DLP
                        </span>
                      )}

                      {profile.riskFlags.includes('IMPOSSIBLE_TRAVEL') && (
                        <span className="inline-flex items-center gap-1.5 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-purple-400 uppercase">
                          <Plane size={9} strokeWidth={2.5} />
                          {profile.impossibleTravel
                            ? `${Math.round(profile.impossibleTravel.distanceKm)}km in ${profile.impossibleTravel.elapsedHours.toFixed(1)}h`
                            : 'Travel'}
                        </span>
                      )}

                      {profile.riskFlags.includes('PAYMENT_VELOCITY') && (
                        <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-amber-400 uppercase">
                          <TrendingUp size={9} strokeWidth={2.5} />
                          Velocity
                        </span>
                      )}

                      {profile.riskScore > 0 && (
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] font-bold tracking-widest uppercase',
                          profile.riskScore >= 61
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : profile.riskScore >= 31
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
                        )}>
                          <Activity size={9} strokeWidth={2.5} />
                          Score {profile.riskScore}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Device */}
                  <td className="px-5 py-3.5">
                    {profile.device ? (
                      <div className="flex items-center gap-1.5">
                        {/mobile|phone|android|iphone|ipad/i.test(profile.device.os)
                          ? <Smartphone size={11} strokeWidth={1.5} className="shrink-0 text-[#5a5a5a]" />
                          : <Laptop size={11} strokeWidth={1.5} className="shrink-0 text-[#5a5a5a]" />
                        }
                        <div>
                          <p className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">{profile.device.os}</p>
                          <p className="font-mono text-[9px] tracking-[-0.02em] text-[#5a5a5a]">{profile.device.browser}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] text-[#3a3a3a]">—</span>
                    )}
                  </td>

                  {/* Linked Accounts */}
                  <td className="px-5 py-3.5">
                    {hasLinks ? (
                      <div className="relative">
                        <button
                          onClick={() => setOpenPopover(isPoOpen ? null : profile.userId)}
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] font-bold tracking-widest uppercase transition-colors',
                            profile.linkedAccounts.length >= 3
                              ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
                          )}
                        >
                          <Link2 size={9} strokeWidth={2.5} />
                          {profile.linkedAccounts.length} linked
                          {isPoOpen ? <ChevronUp size={9} strokeWidth={2} /> : <ChevronDown size={9} strokeWidth={2} />}
                        </button>
                        {isPoOpen && (
                          <LinkedAccountsPopover
                            accounts={profile.linkedAccounts}
                            onClose={() => setOpenPopover(null)}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] text-[#3a3a3a]">—</span>
                    )}
                  </td>

                  {/* Last Active */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                      {formatRelative(profile.last_sign_in_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/users?search=${encodeURIComponent(profile.email)}`}
                        className="inline-flex items-center gap-1 rounded border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1.5 font-mono text-[9px] text-[#7a7a7a] transition-colors hover:border-[#3a3a3a] hover:text-white"
                        title="View in Users"
                      >
                        <Eye size={11} strokeWidth={2} />
                      </Link>
                      <button
                        onClick={() => handleBanToggle(profile)}
                        disabled={isBanning}
                        title={profile.is_banned ? 'Unban' : 'Ban'}
                        className={clsx(
                          'inline-flex items-center gap-1 rounded border px-2 py-1.5 font-mono text-[9px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                          profile.is_banned
                            ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20',
                        )}
                      >
                        {isBanning
                          ? <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                          : profile.is_banned
                            ? <ShieldCheck size={11} strokeWidth={2} />
                            : <ShieldBan   size={11} strokeWidth={2} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* close popover on outside click */}
      {openPopover && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenPopover(null)} />
      )}
    </div>
  )
}
