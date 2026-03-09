'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications'
import type { AppNotification } from '@/lib/actions/notifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  /** Authenticated user's ID — scopes the Realtime subscription. */
  userId: string
  /** Pass `false` when user has disabled push notifications in Settings */
  pushEnabled?: boolean
}

export function NotificationBell({ userId, pushEnabled = true }: NotificationBellProps) {
  const [isOpen, setIsOpen]               = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading]             = useState(true)
  const containerRef                      = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchNotifications()
    setNotifications(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Realtime: append new notifications pushed for this user ────────────────
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification
          setNotifications((prev) => prev.some((x) => x.id === n.id) ? prev : [n, ...prev])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Close on outside click / Escape ────────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────────
  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    markNotificationRead(id).catch(console.error)
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead().catch(console.error)
  }

  if (!pushEnabled) return null

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className={`relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border-2 bg-[#111111] transition-all duration-300 ${
          isOpen
            ? 'border-[#6e6d6f] text-white'
            : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'
        }`}
      >
        <Bell size={17} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold leading-none text-black"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
            <span className="font-sans text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex max-h-[400px] flex-col overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center font-mono text-xs tracking-[-0.05em] text-[#4a4a4a]">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center font-mono text-xs tracking-[-0.05em] text-[#4a4a4a]">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`flex w-full flex-col gap-1 border-b border-[#1a1a1a] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] ${
                    n.read ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-sans text-xs font-semibold text-white">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
                      {n.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] tracking-[-0.03em] text-[#6e6d6f]">
                    {n.body}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
