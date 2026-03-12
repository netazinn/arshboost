import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Called after Discord OAuth2 completes via supabase.auth.linkIdentity.
// Exchanges the code, extracts the Discord identity, and saves it to
// booster_verifications before redirecting back to the settings page.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/dashboard/settings?tab=verification&discord=error&reason=${encodeURIComponent(reason)}`, origin),
    )

  if (error) return fail(error)
  if (!code)  return fail('no_code')

  const supabase = await createClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) return fail(exchangeError?.message ?? 'session_error')

  // Find the Discord identity that was just linked
  const discordIdentity = data.user.identities?.find((i) => i.provider === 'discord')
  if (!discordIdentity) return fail('no_discord_identity')

  const id = discordIdentity.identity_data
  const discord_unique_id  = String(id?.provider_id ?? id?.sub ?? '').trim()
  const discord_username   = String(id?.name ?? id?.full_name ?? '').trim()
  // Discord CDN avatar — may be null for default avatars
  const discord_avatar_url = (String(id?.avatar_url ?? id?.picture ?? '').trim()) || null

  if (!discord_unique_id) return fail('missing_discord_id')

  // Upsert to booster_verifications (creates row if none exists yet)
  const { error: saveError } = await supabase
    .from('booster_verifications')
    .upsert(
      {
        user_id: data.user.id,
        discord_username:  discord_username  || null,
        discord_unique_id,
        discord_avatar_url,
      },
      { onConflict: 'user_id' },
    )

  if (saveError) return fail(`save_failed: ${saveError.message}`)

  return NextResponse.redirect(
    new URL('/dashboard/settings?tab=verification&discord=connected', origin),
  )
}
