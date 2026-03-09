import { createClient } from '@/lib/supabase/server'
import type { Game } from '@/types'

export async function getActiveGames(): Promise<Game[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .select('id, name, slug, logo_url, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[getActiveGames]', error.message)
    return []
  }

  return data ?? []
}
