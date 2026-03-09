'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ProfileActionState {
  error: string | null
  success: boolean
}

export async function updateProfileAction(
  data: { username?: string; avatar_url?: string }
): Promise<ProfileActionState> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Unauthorized.', success: false }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(data.username !== undefined && { username: data.username }),
      ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath('/dashboard/settings')
  return { error: null, success: true }
}
