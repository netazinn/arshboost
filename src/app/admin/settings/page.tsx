import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getGlobalSettings } from '@/lib/data/settings'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { FinancialsForm } from './_components/FinancialsForm'
import { OperationsForm } from './_components/OperationsForm'
import { CommunicationsForm } from './_components/CommunicationsForm'
import { SettingsTabs } from './_components/SettingsTabs'
import { Settings, DollarSign, Wrench, MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Platform Settings – ArshBoost', robots: { index: false } }

export default async function PlatformSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'admin') redirect('/admin')

  const settings = await getGlobalSettings()

  const financialsCard = (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] divide-y divide-[#1a1a1a]">
      <div className="px-6 py-4 flex items-center gap-3">
        <DollarSign size={16} strokeWidth={1.5} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-white">Financial Controls</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
            Adjust platform fee, withdrawal thresholds, and boost pricing multipliers.
          </p>
        </div>
      </div>
      <div className="px-6 py-6">
        <FinancialsForm
          initialFee={settings.flat_platform_fee}
          initialMinWithdrawal={settings.min_withdrawal_amount}
          initialDuoMultiplier={settings.duo_boost_multiplier}
        />
      </div>
    </div>
  )

  const operationsCard = (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] divide-y divide-[#1a1a1a]">
      <div className="px-6 py-4 flex items-center gap-3">
        <Wrench size={16} strokeWidth={1.5} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-white">Operational Controls</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
            Manage emergency switches, platform timers, and cooldown policies.
          </p>
        </div>
      </div>
      <div className="px-6 py-6">
        <OperationsForm
          initialMaintenanceMode={settings.is_maintenance_mode}
          initialHaltOrders={settings.halt_new_orders}
          initialAutoCompleteHours={settings.auto_complete_hours}
          initialAutoCancelHours={settings.auto_cancel_hours}
          initialIbanCooldownDays={settings.iban_cooldown_days}
        />
      </div>
    </div>
  )

  const communicationsCard = (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] divide-y divide-[#1a1a1a]">
      <div className="px-6 py-4 flex items-center gap-3">
        <MessageSquare size={16} strokeWidth={1.5} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-white">Announcement Banner</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
            Control the global announcement banner shown to all visitors.
          </p>
        </div>
      </div>
      <div className="px-6 py-6">
        <CommunicationsForm
          initialAnnouncementActive={settings.is_announcement_active}
          initialAnnouncementText={settings.announcement_text}
          initialAnnouncementColor={settings.announcement_color}
        />
      </div>
    </div>
  )

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      <DashboardPageHeader
        icon={Settings}
        title="Platform Settings"
        subtitle="Configure global platform behaviour, pricing rules, and feature flags."
      />
      <SettingsTabs
        financialsContent={financialsCard}
        operationsContent={operationsCard}
        communicationsContent={communicationsCard}
      />
    </main>
  )
}
