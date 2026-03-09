'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Radar,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  DollarSign,
  BarChart2,
  Sparkles,
  Medal,
  Shield,
  Headphones,
  Calculator,
  AlertTriangle,
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
      <span className={`${base} text-muted-foreground/30 cursor-not-allowed select-none`}>
        <Icon size={14} strokeWidth={1.5} className="shrink-0" />
        {label}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      }`}
    >
      <Icon size={14} strokeWidth={1.5} className="shrink-0" />
      {label}
    </Link>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1 mt-6 mb-2"
      >
        <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase">
          {label}
        </span>
        {open
          ? <ChevronDown size={11} strokeWidth={2} className="text-muted-foreground/40" />
          : <ChevronRight size={11} strokeWidth={2} className="text-muted-foreground/40" />
        }
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {children}
        </div>
      )}
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
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/')
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
        <CollapsibleSection label="Main" defaultOpen>
          {/* Kanban Radar: admin only */}
          {isAdmin && (
            <NavItem href="/dashboard/radar" label="Kanban Radar" icon={Radar} isActive={isActive('/dashboard/radar')} />
          )}
          <NavItem href="/dashboard/master-inbox" label="Master Inbox" icon={MessageSquare} isActive={isActive('/dashboard/master-inbox')} />
        </CollapsibleSection>

        {/* FINANCIALS (admin + accountant) */}
        {(isAdmin || isAccountant) && (
          <CollapsibleSection label="Financials" defaultOpen>
            <NavItem href="/dashboard/withdrawals" label="Withdrawals" icon={DollarSign} isActive={isActive('/dashboard/withdrawals')} />
            <NavItem href="/dashboard/revenue"     label="Revenue"     icon={BarChart2}  isActive={isActive('/dashboard/revenue')}     />
          </CollapsibleSection>
        )}

        {/* MANAGEMENT (admin only) */}
        {isAdmin && (
          <CollapsibleSection label="Management" defaultOpen>
            <NavItem href="/dashboard/users"    label="Users"             icon={Users}    isActive={isActive('/dashboard/users')}    />
            <NavItem href="/dashboard/settings" label="Platform Settings" icon={Settings} isActive={isActive('/dashboard/settings')} />
          </CollapsibleSection>
        )}

        {/* OPERATIONS — Active Disputes: admin only */}
        {isAdmin && (
          <CollapsibleSection label="Operations">
            <NavItem href="/dashboard/radar?filter=dispute" label="Active Disputes" icon={AlertTriangle} isActive={false} />
          </CollapsibleSection>
        )}

        {/* MY BOOSTER PANEL — admin only, stripped to Boosts + Tips */}
        {isAdmin && (
          <CollapsibleSection label="My Booster Panel">
            <NavItem href="/dashboard/boosts" label="Boosts Panel"  icon={Sparkles} isActive={isActive('/dashboard/boosts')} />
            <NavItem href="/dashboard/tips"   label="Tips History"  icon={Medal}    isActive={isActive('/dashboard/tips')}   />
          </CollapsibleSection>
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
          <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/auth/login">
              <LogOut size={15} strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  )
}
