'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Shield, ShieldAlert, Bell } from 'lucide-react'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications'
import type { AppNotification } from '@/lib/actions/notifications'
import type { BoosterStats } from '@/lib/supabase/queries/booster'

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning,'
  if (h >= 12 && h < 17) return 'Good afternoon,'
  if (h >= 17 && h < 21) return 'Good evening,'
  return 'Good night,'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Component ──────────────────────────────────────────────────

export function BoosterDashboard({ username, userId, stats }: { username: string; userId: string; stats: BoosterStats }) {
  const [greeting, setGreeting]         = useState('')
  const [notifs, setNotifs]             = useState<AppNotification[]>([])
  const [notifsLoading, setNotifsLoading] = useState(true)

  useEffect(() => { setGreeting(getGreeting()) }, [])

  // Fetch on mount
  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true)
    const data = await fetchNotifications()
    setNotifs(data)
    setNotifsLoading(false)
  }, [])
  useEffect(() => { loadNotifs() }, [loadNotifs])

  // Realtime: append new notifications pushed for this user
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-notifs:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification
          setNotifs((prev) => prev.some((x) => x.id === n.id) ? prev : [n, ...prev])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  function handleMarkRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    markNotificationRead(id).catch(console.error)
  }

  function handleMarkAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead().catch(console.error)
  }

  const unreadCount = notifs.filter((n) => !n.read).length

  const METRICS = [
    { label: 'Total Earned',     value: `$${stats.totalEarned.toFixed(2)}`, sub: `${stats.completedOrders} boosts completed`, accent: 'text-green-400', subAccent: 'text-green-500/70' },
    { label: 'Orders Completed', value: String(stats.completedOrders),      sub: `${stats.activeOrders} in progress`,        accent: 'text-white',     subAccent: 'text-[#6e6d6f]'   },
    { label: 'Completion Rate',  value: `${stats.completionRate}%`,         sub: 'All time',                                 accent: 'text-white',     subAccent: 'text-[#6e6d6f]'   },
    { label: 'Active Orders',    value: String(stats.activeOrders),         sub: 'In progress now',                          accent: 'text-white',     subAccent: 'text-[#6e6d6f]'   },
  ]

  return (
    <main className="flex w-full max-w-[1440px] flex-col gap-6 overflow-hidden px-8 py-10">
      <DashboardPageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Overview of your account, earnings, and recent activity."
      />

      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-5">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[40%] bg-gradient-to-l from-white/[0.025] to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-2xl font-bold tracking-[-0.07em] text-white">
              {greeting} {username}.
            </span>
            <p className="font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f]">
              Last login: —
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Shield size={18} strokeWidth={1.5} className="text-[#6e6d6f]" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">Verification</span>
              <span className="font-mono text-[11px] tracking-[-0.05em] text-white">2 / 3 steps</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Metrics row ── */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {METRICS.map(({ label, value, sub, accent, subAccent }) => (
          <div key={label} className="flex flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#111111] px-4 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6e6d6f]">{label}</span>
            <div className="flex flex-col gap-0.5">
              <span className={`font-mono text-2xl font-bold tracking-[-0.07em] ${accent}`}>{value}</span>
              <span className={`font-mono text-[10px] tracking-[-0.04em] ${subAccent}`}>{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom grid: Rules + Notifications ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Mandatory Rules ── */}
        <div className="flex flex-col gap-4 rounded-md border border-[#2a2a2a] bg-[#111111] p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} strokeWidth={1.5} className="shrink-0 text-red-500" />
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-red-400">
              Mandatory Platform Rules
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {[
              <>
                <span className="font-semibold text-red-400">No External Communication:</span> You must{' '}
                <span className="font-semibold text-red-400">NEVER</span> share your personal Discord, social media, or any other contact information with the client. All communication must stay within the Arshboost live chat.
              </>,
              <>
                <span className="font-semibold text-red-400">Offline Mode Required:</span> You must appear offline while playing on a client&apos;s account unless explicitly requested otherwise in the order notes.
              </>,
              <>
                <span className="font-semibold text-red-400">No Toxicity or Griefing:</span> You represent Arshboost. Any toxic behavior, griefing, or throwing while on a client&apos;s account will result in an immediate and permanent{' '}
                <span className="font-semibold text-red-400">BAN</span> and forfeiture of all pending payouts.
              </>,
              <>
                <span className="font-semibold text-red-400">Single Active Order:</span> You may{' '}
                <span className="font-semibold text-red-400">ONLY</span> have one active order in progress at a time. Do not claim a new order until your current one is marked as &apos;Completed&apos;.
              </>,
              <>
                <span className="font-semibold text-red-400">VPN Usage:</span> If the client requests VPN usage for their specific region, you are required to use it to protect their account security.
              </>,
              <>
                <span className="font-semibold text-red-400">Payment Disputes:</span> Any attempt to accept direct payments from clients outside of the Arshboost platform is strictly prohibited and will result in legal action and a permanent{' '}
                <span className="font-semibold text-red-400">BAN</span>.
              </>,
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-3 font-[var(--font-roboto)] text-sm leading-relaxed text-zinc-300">
                <span className="mt-[3px] shrink-0 font-mono text-[11px] font-semibold text-red-700">{String(i + 1).padStart(2, '0')}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Notifications ── */}
        <div className="flex flex-col gap-4 rounded-md border border-[#2a2a2a] bg-[#111111] p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell size={16} strokeWidth={1.5} className="shrink-0 text-[#6e6d6f]" />
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                Notifications
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[340px]">
            {notifsLoading ? (
              <p className="py-8 text-center font-mono text-xs tracking-[-0.04em] text-[#4a4a4a]">Loading…</p>
            ) : notifs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                <Bell size={28} strokeWidth={1} className="text-[#3a3a3a]" />
                <p className="font-mono text-xs tracking-[-0.04em] text-[#4a4a4a]">No notifications yet.</p>
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#3a3a3a]">
                  Alerts about your orders and payouts will appear here.
                </p>
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`flex w-full flex-col gap-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-left transition-colors hover:border-[#3a3a3a] ${n.read ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6e6d6f]">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
                      {n.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-[-0.03em] text-[#4a4a4a]">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-zinc-300">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
