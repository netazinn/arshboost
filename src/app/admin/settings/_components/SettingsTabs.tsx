'use client'

import { useState } from 'react'
import { DollarSign, Wrench, MessageSquare } from 'lucide-react'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'financials' | 'operations' | 'communications'

const TABS: { id: TabId; label: string; icon: React.ElementType; disabled?: boolean }[] = [
  { id: 'financials',     label: 'Financials',     icon: DollarSign    },
  { id: 'operations',     label: 'Operations',     icon: Wrench        },
  { id: 'communications', label: 'Communications', icon: MessageSquare  },
]

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabPill({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md font-mono text-xs transition-colors select-none ${
        disabled
          ? 'text-muted-foreground/30 cursor-not-allowed'
          : active
            ? 'bg-white/10 text-white border border-white/15'
            : 'text-muted-foreground hover:text-foreground cursor-pointer'
      }`}
    >
      <Icon size={13} strokeWidth={1.5} />
      {label}
      {disabled && (
        <span className="ml-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-muted-foreground/50">
          SOON
        </span>
      )}
    </button>
  )
}

// ─── Settings Tabs ────────────────────────────────────────────────────────────

interface SettingsTabsProps {
  financialsContent: React.ReactNode
  operationsContent: React.ReactNode
  communicationsContent: React.ReactNode
}

export function SettingsTabs({ financialsContent, operationsContent, communicationsContent }: SettingsTabsProps) {
  const [active, setActive] = useState<TabId>('financials')

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#1a1a1a] pb-3">
        {TABS.map((t) => (
          <TabPill
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={active === t.id}
            disabled={t.disabled}
            onClick={t.disabled ? undefined : () => setActive(t.id)}
          />
        ))}
      </div>

      {/* Panels */}
      {active === 'financials'     && financialsContent}
      {active === 'operations'     && operationsContent}
      {active === 'communications' && communicationsContent}
    </>
  )
}
