import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { getBoosterOrders } from '@/lib/data/orders'
import { HistoryView } from './_components/HistoryView'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'booster') redirect('/auth/login')

  const orders = await getBoosterOrders(user.id)

  return <HistoryView initialOrders={orders} />
}
