'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  MessageSquare,
  Radar,
  Users,
  Settings,
  LogOut,
  DollarSign,
  BarChart2,
  Sparkles,
  Shield,
  Headphones,
  Calculator,
  ScrollText,
  Home,
  ShieldAlert,
  Fingerprint,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types'

interface AdminSidebarProps {
  role: UserRole
  username: string
  email: string
}

// ─── Panel label config ───────────────────────────────────────────────────────

const PANEL_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  admin:      { label: 'ADMIN PANEL',      color: 'text-red-400',   Icon: Shield     },
  support:    { label: 'SUPPORT PANEL',    color: 'text-blue-400',  Icon: Headphones },
  accountant: { label: 'ACCOUNTANT PANEL', color: 'text-green-400', Icon: Calculator },
}

const DEFAULT_PANEL = { label: 'ADMIN PANEL', color: 'text-red-400', Icon: Shield }

// ─── Nav item helper ──────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  disabled,
}: {
  href?: string
  label: string
  icon: React.ElementType
  isActive?: boolean
  disabled?: boolean
}) {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left'

  if (disabled || !href) {
    return (
      <span className={clsx(base, 'text-muted-foreground/30 cursor-not-allowed select-none')}>
        <Icon size={14} strokeWidth={1.5} className="shrink-0" />
        {label}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={clsx(
        base,
        isActive
          ? 'bg-white/10 text-white'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
      )}
    >
      <Icon size={14} strokeWidth={1.5} className="shrink-0" />
      {label}
    </Link>
  )
}

// ─── Static section label ─────────────────────────────────────────────────────

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-1.5 px-3 font-mono text-[10px] font-bold tracking-widest text-muted-foreground/40 uppercase select-none">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function AdminSidebar({ role, username, email }: AdminSidebarProps) {
  const pathname = usePathname()
  const panel = PANEL_CONFIG[role] ?? DEFAULT_PANEL
  const PanelIcon = panel.Icon

  const isAdmin      = role === 'admin'
  const isAccountant = role === 'accountant'
  const isSupport    = role === 'support'

  function isActive(href: string) {
    if (pathname === href) return true
    // Exact-match-only routes — never mark active based on sub-paths
    if (href === '/' || href === '/admin' || href === '/dashboard') return false
    return pathname.startsWith(href + '/')
  }

  return (
    <aside className="hidden md:flex w-64 h-screen shrink-0 flex-col bg-[#0B0B0B] border-r border-border/50">
      {/* Logo */}
      <div className="px-5 py-6">
        <span className="font-sans text-2xl font-bold tracking-[-0.07em] text-muted-foreground cursor-default select-none">
          arshboost.
        </span>
        <p className={`mt-1 font-mono text-[10px] tracking-wider uppercase flex items-center gap-1.5 ${panel.color}`}>
          <PanelIcon size={10} strokeWidth={2} className="shrink-0" />
          {panel.label}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">

        {/* MAIN */}
        <NavSection label="Main">
          <NavItem href="/" label="Main Page" icon={Home} isActive={isActive('/')} />
          {(isAdmin || isSupport) && (
            <NavItem href="/admin" label="Overview Radar" icon={Radar} isActive={isActive('/admin')} />
          )}
          {(isAdmin || isSupport) && (
            <NavItem href="/admin/master-inbox" label="Master Inbox" icon={MessageSquare} isActive={isActive('/admin/master-inbox')} />
          )}
        </NavSection>

        {/* FINANCIALS (admin + accountant) */}
        {(isAdmin || isAccountant) && (
          <NavSection label="Financials">
            <NavItem href="/admin/withdrawals" label="Withdrawal Management" icon={DollarSign} isActive={isActive('/admin/withdrawals')} />
            <NavItem href="/admin/revenue"     label="Revenue"     icon={BarChart2}  isActive={isActive('/admin/revenue')}     />
          </NavSection>
        )}

        {/* MANAGEMENT (admin only) */}
        {isAdmin && (
          <NavSection label="Management">
            <NavItem href="/admin/users"          label="Users"              icon={Users}       isActive={isActive('/admin/users')}          />
            <NavItem href="/admin/security"       label="Security"           icon={Fingerprint} isActive={isActive('/admin/security')}       />
            <NavItem href="/admin/ban-requests"   label="Ban/Unban Requests" icon={ShieldAlert} isActive={isActive('/admin/ban-requests')}   />
            <NavItem href="/admin/settings"       label="Platform Settings"  icon={Settings}    isActive={isActive('/admin/settings')}       />
            <NavItem href="/admin/activity-logs"  label="Activity Logs"      icon={ScrollText}  isActive={isActive('/admin/activity-logs')}  />
          </NavSection>
        )}

        {/* USERS (support only) */}
        {isSupport && (
          <NavSection label="Management">
            <NavItem href="/admin/users" label="User Management" icon={Users} isActive={isActive('/admin/users')} />
          </NavSection>
        )}

        {/* MY BOOSTER PANEL — admin only */}
        {isAdmin && (
          <NavSection label="Booster Panel">
            <NavItem href="/admin/boosts" label="Boosts Panel" icon={Sparkles} isActive={isActive('/admin/boosts')} />
          </NavSection>
        )}

      </nav>

      {/* Bottom profile widget */}
      <div className="mt-auto border-t border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar size="default">
              <AvatarFallback className="bg-zinc-800 text-foreground font-semibold text-xs">
                {(username || email || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{username || email}</p>
            <p className={`text-xs font-mono truncate ${panel.color}`}>{panel.label}</p>
          </div>
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
