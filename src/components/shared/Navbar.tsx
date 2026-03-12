import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { UserMenu } from './UserMenu'

export async function Navbar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getProfile(user.id) : null

  return (
    <header className="w-full">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-8 pt-12">
        {/* Logo */}
        <Link
          href="/"
          aria-label="ArshBoost home"
          className="font-sans text-3xl font-bold leading-none tracking-[-0.07em] text-[#6e6d6f] transition-colors duration-200 ease-in-out hover:text-white"
        >
          arshboost.
        </Link>

        {/* Right actions */}
        <nav className="flex items-center gap-3" aria-label="Main navigation">
          {profile && user ? (
            <UserMenu profile={{ id: user.id, email: profile.email, username: profile.username, avatar_url: profile.avatar_url, role: profile.role }} />
          ) : (
            <Link
              href="/auth/login"
              className="flex h-[50px] min-w-[120px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-xs tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white md:min-w-[224px]"
            >
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
