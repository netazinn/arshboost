'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  MessageSquare,
  Wallet,
  LifeBuoy,
  Settings,
  LogOut,
  ChevronDown,
  ShoppingCart,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { NotificationBell } from './NotificationBell'

interface UserMenuProps {
  profile: Pick<Profile, 'id' | 'email' | 'username' | 'avatar_url' | 'role'>
}

const ROLE_DASHBOARD: Record<string, string> = {
  client:  '/dashboard/orders',
  booster: '/dashboard',
  support: '/dashboard/support',
  admin:   '/dashboard/support',
}

const ROLE_CTA_ICON: Record<string, React.ReactNode> = {
  client:  <ShoppingCart size={14} strokeWidth={1.5} />,
  booster: <LayoutGrid size={14} strokeWidth={1.5} />,
  support: <LayoutGrid size={14} strokeWidth={1.5} />,
  admin:   <LayoutGrid size={14} strokeWidth={1.5} />,
}

const ROLE_LABEL: Record<string, string> = {
  client:  'My Orders',
  booster: 'Dashboard',
  support: 'Dashboard',
  admin:   'Dashboard',
}

type Presence = 'online' | 'away' | 'offline'

const PRESENCE_COLOR: Record<Presence, string> = {
  online:  'bg-green-500',
  away:    'bg-yellow-500',
  offline: 'bg-gray-500',
}

export function UserMenu({ profile }: UserMenuProps) {
  const [isOpen, setIsOpen]          = useState(false)
  const [presence, setPresence]      = useState<Presence>('offline')
  const [isPending, startTransition] = useTransition()
  const containerRef                 = useRef<HTMLDivElement>(null)
  const router                       = useRouter()

  const dashHref   = ROLE_DASHBOARD[profile.role] ?? '/dashboard/orders'
  const ctaLabel   = ROLE_LABEL[profile.role]     ?? 'My Orders'
  const ctaIcon    = ROLE_CTA_ICON[profile.role]  ?? <ShoppingCart size={14} strokeWidth={1.5} />
  const displayName = profile.username ?? profile.email
  const initial    = displayName.charAt(0).toUpperCase()

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Presence tracking
  useEffect(() => {
    function goOnline() {
      if (!document.hidden) setPresence('online')
    }
    function goAway() {
      setPresence('away')
    }
    function onVisibility() {
      document.hidden ? setPresence('away') : setPresence('online')
    }

    // Set initial state
    setPresence(document.hidden ? 'away' : 'online')

    window.addEventListener('focus', goOnline)
    window.addEventListener('blur', goAway)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('focus', goOnline)
      window.removeEventListener('blur', goAway)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const dotClass = `${PRESENCE_COLOR[presence]} transition-colors duration-300`

  function handleLogout() {
    setIsOpen(false)
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    })
  }

  const Avatar = ({ size }: { size: 'lg' | 'sm' }) => {
    const dim = size === 'lg' ? 'h-[50px] w-[50px]' : 'h-9 w-9'
    const text = size === 'lg' ? 'text-sm' : 'text-xs'
    return (
      <div className={`${dim} shrink-0 overflow-hidden rounded-full bg-[#2a2a2a] flex items-center justify-center`}>
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className={`font-sans font-semibold text-white select-none ${text}`}>
            {initial}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* CTA button */}
      <Link
        href={dashHref}
        className="flex h-[50px] min-w-[120px] items-center justify-center gap-2 rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-xs tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white md:min-w-[160px]"
      >
        {ctaIcon}
        {ctaLabel}
      </Link>

      {/* Notification bell */}
      <NotificationBell userId={profile.id} pushEnabled />

      {/* Avatar trigger + dropdown */}
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Open profile menu"
          disabled={isPending}
          className={`relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[#111111] transition-all duration-300 disabled:opacity-50 ${
            isOpen
              ? 'border-[#6e6d6f]'
              : 'border-[#2a2a2a] hover:border-[#6e6d6f]'
          }`}
        >
          <Avatar size="lg" />
        </button>
        {/* Presence dot on trigger */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black ${dotClass}`}
        />

        {/* Dropdown panel */}
        {isOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[240px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111] shadow-2xl"
          >
            {/* Header – user info */}
            <div className="flex items-center gap-3 border-b border-[#2a2a2a] px-4 py-4">
              {/* Avatar with online dot */}
              <div className="relative shrink-0">
                <Avatar size="sm" />
                <span aria-hidden="true" className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111111] ${dotClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-sm font-semibold leading-tight text-white">
                  {profile.username ?? profile.email.split('@')[0]}
                </p>
                <p className="truncate font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f]">
                  {profile.email}
                </p>
              </div>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-[#4a4a4a] transition-transform duration-200 rotate-180"
              />
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <MenuItem href={dashHref} icon={<LayoutGrid size={15} strokeWidth={1.5} />} label={ctaLabel} onClick={() => setIsOpen(false)} />
              <MenuItem href="/dashboard/orders/chat" icon={<MessageSquare size={15} strokeWidth={1.5} />} label="Orders Chat" onClick={() => setIsOpen(false)} />
              <MenuItem href="/dashboard/wallet" icon={<Wallet size={15} strokeWidth={1.5} />} label="Wallet" onClick={() => setIsOpen(false)} />
              <MenuItem href="#" icon={<LifeBuoy size={15} strokeWidth={1.5} />} label="Support" onClick={() => setIsOpen(false)} />
              <MenuItem href="/dashboard/settings" icon={<Settings size={15} strokeWidth={1.5} />} label="Settings" onClick={() => setIsOpen(false)} />
            </div>

            {/* Divider + Logout */}
            <div className="border-t border-[#2a2a2a] py-1.5">
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 font-mono text-xs tracking-[-0.05em] text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={15} strokeWidth={1.5} />
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 font-mono text-xs tracking-[-0.05em] text-[#9ca3af] transition-colors hover:bg-white/5 hover:text-white"
    >
      {icon}
      {label}
    </Link>
  )
}
