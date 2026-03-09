'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Briefcase,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Package,
  Users,
  Wallet,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  client: [
    {
      label: 'My Orders',
      href: '/dashboard/orders',
      icon: <Package size={16} strokeWidth={1.5} />,
    },
    {
      label: 'My Wallet',
      href: '/dashboard/wallet',
      icon: <Wallet size={16} strokeWidth={1.5} />,
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings size={16} strokeWidth={1.5} />,
    },
  ],
  booster: [
    {
      label: 'Job Board',
      href: '/dashboard/boosts',
      icon: <LayoutGrid size={16} strokeWidth={1.5} />,
    },
    {
      label: 'My Jobs',
      href: '/dashboard/boosts',
      icon: <Briefcase size={16} strokeWidth={1.5} />,
    },
  ],
  support: [
    {
      label: 'All Orders',
      href: '/dashboard/support',
      icon: <Users size={16} strokeWidth={1.5} />,
    },
    {
      label: 'Disputes',
      href: '/dashboard/support/disputes',
      icon: <ShieldAlert size={16} strokeWidth={1.5} />,
    },
  ],
  admin: [
    {
      label: 'All Orders',
      href: '/dashboard/support',
      icon: <Users size={16} strokeWidth={1.5} />,
    },
    {
      label: 'Disputes',
      href: '/dashboard/support/disputes',
      icon: <ShieldAlert size={16} strokeWidth={1.5} />,
    },
  ],
  accountant: [],
}

const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Client',
  booster: 'Booster',
  support: 'Support',
  admin: 'Admin',
  accountant: 'Accountant',
}

interface DashboardShellProps {
  profile: Profile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const navItems = NAV_ITEMS[profile.role] ?? NAV_ITEMS.client

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const sidebar = (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0d0d0d]">
      {/* Logo */}
      <div className="flex h-[72px] shrink-0 items-center border-b border-[#2a2a2a] px-6">
        <Link
          href="/"
          className="font-sans text-xl font-bold tracking-[-0.07em] text-[#6e6d6f] transition-colors hover:text-white"
        >
          arshboost.
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex h-10 items-center gap-3 rounded-md px-3 font-mono text-xs tracking-[-0.1em] transition-all duration-150 ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-[#6e6d6f] hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="shrink-0 border-t border-[#2a2a2a] p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] font-mono text-[10px] uppercase text-white">
            {(profile.username ?? profile.email).charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] tracking-[-0.1em] text-white">
              {profile.username ?? profile.email}
            </p>
            <p className="font-mono text-[10px] tracking-[-0.1em] text-[#6e6d6f]">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex h-9 w-full items-center gap-2 rounded-md px-3 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f] transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={14} strokeWidth={1.5} />
          Log Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black">
      {/* Desktop sidebar */}
      <div className="hidden h-full md:flex">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 flex h-full">{sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex h-[72px] shrink-0 items-center border-b border-[#2a2a2a] px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white"
            aria-label="Open menu"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <span className="ml-4 font-sans text-lg font-bold tracking-[-0.07em] text-[#6e6d6f]">
            arshboost.
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
