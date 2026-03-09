import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  booster: '/dashboard',
  support: '/dashboard/master-inbox',
  admin:   '/dashboard/radar',
  client:  '/',
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') // explicit redirect requested by the caller

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Backfill username from signup metadata into the profiles table.
      const username = data.user.user_metadata?.username as string | undefined
      if (username) {
        await supabase
          .from('profiles')
          .update({ username })
          .eq('id', data.user.id)
          .is('username', null)
      }

      // If caller supplied an explicit `next`, honour it; otherwise route by role.
      if (next && next !== '/') {
        return NextResponse.redirect(new URL(next, origin))
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      const role = profile?.role as string | undefined
      const home = role ? (ROLE_HOME[role] ?? '/') : '/'
      return NextResponse.redirect(new URL(home, origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/register?error=invalid_link', origin))
}
