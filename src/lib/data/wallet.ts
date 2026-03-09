import { createClient } from '@/lib/supabase/server'
import type { Transaction } from '@/types'

// ─── Client transactions ──────────────────────────────────────────────────────

export async function getClientTransactions(userId: string): Promise<Transaction[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      order:orders(
        id,
        details,
        game:games(id, name, slug, logo_url),
        service:games_services(id, type, label)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getClientTransactions]', error.message)
    return []
  }

  return (data ?? []) as Transaction[]
}
