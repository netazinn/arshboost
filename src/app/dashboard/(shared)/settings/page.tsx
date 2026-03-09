import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { DashboardPageHeader } from '@/components/features/dashboard/DashboardPageHeader'
import { SettingsView } from '@/components/features/dashboard/SettingsView'
import { BoosterSettingsView } from '@/components/features/dashboard/BoosterSettingsView'
import { Footer } from '@/components/shared/Footer'

export const metadata: Metadata = {
  title: 'Settings – ArshBoost',
  robots: { index: false },
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/auth/login')

  const params = await searchParams
  const tab = params.tab as string | undefined

  if (profile.role === 'booster') {
    const VALID_TABS = ['general', 'notifications', 'verification', 'bank'] as const
    type TabId = typeof VALID_TABS[number]
    const initialTab = VALID_TABS.includes(tab as TabId) ? (tab as TabId) : undefined
    return <BoosterSettingsView initialTab={initialTab} profile={profile} />
  }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-8 py-10 flex flex-col gap-6">
        <DashboardPageHeader
          icon={Settings}
          title="Settings"
          subtitle="Manage your account preferences and security."
        />
        <SettingsView profile={profile} />
      </main>
      <Footer />
    </>
  )
}
