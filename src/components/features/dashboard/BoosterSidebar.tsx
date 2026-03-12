'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  MessageSquare,
  Sparkles,
  Rocket,
  Wallet,
  Medal,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const NAV_GROUPS: {
  label: string
  items: { href: string | null; label: string; icon: React.ElementType }[]
}[] = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard',       label: 'Dashboard',   icon: LayoutGrid  },
      { href: '/dashboard/inbox', label: 'Chat Inbox',  icon: MessageSquare },
    ],
  },
  {
    label: 'BOOSTING',
    items: [
      { href: '/dashboard/boosts',   label: 'Boosts Panel', icon: Sparkles },
      { href: '/dashboard/history',  label: 'Completed History',  icon: Rocket   },
    ],
  },
  {
    label: 'PAYMENTS',
    items: [
      { href: '/dashboard/wallet', label: 'Wallet',       icon: Wallet },
      { href: null,                label: 'Tips History', icon: Medal  },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/dashboard/settings',      label: 'Settings',     icon: Settings    },
      { href: '/dashboard/verification',    label: 'Verification', icon: ShieldCheck },

    ],
  },
]

export function BoosterSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 h-screen shrink-0 flex-col bg-[#0B0B0B] border-r border-border/50">
      {/* Logo */}
      <div className="px-5 py-6">
        <span className="font-sans text-2xl font-bold tracking-[-0.07em] text-muted-foreground cursor-default select-none">
          arshboost.
        </span>
        <p className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground/40 uppercase">Booster Panel</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2 px-3 mt-6">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === '/dashboard'
                    ? pathname === '/dashboard'
                    : href !== null && (pathname === href || pathname.startsWith(href + '/'))

                const baseClass = `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors`

                if (href === null) {
                  return (
                    <span
                      key={label}
                      className={`${baseClass} text-muted-foreground/40 cursor-not-allowed select-none`}
                    >
                      <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                      {label}
                    </span>
                  )
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${baseClass} ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom profile widget */}
      <div className="mt-auto border-t border-border/50 p-4">
        <div className="flex items-center gap-3">
          {/* Avatar with online dot */}
          <div className="relative shrink-0">
            <Avatar size="default">
              <AvatarFallback className="bg-zinc-800 text-foreground font-semibold text-xs">
                B
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">booster</p>
            <p className="text-xs text-muted-foreground">Partner Mode</p>
          </div>

          {/* Log out button */}
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => { window.location.href = '/auth/signout' }}
          >
            <LogOut size={15} strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </aside>
  )
}
