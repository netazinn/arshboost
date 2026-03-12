import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { BoosterVerificationView } from '@/components/features/dashboard/BoosterVerificationView'

export const metadata: Metadata = {
  title: 'Verification – ArshBoost',
  robots: { index: false },
}

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/auth/login')
  if (profile.role !== 'booster') redirect('/dashboard')

  return <BoosterVerificationView profile={profile} />
}
