import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * GET /auth/signout
 *
 * Dedicated Route Handler for sign-out.
 * Wiring the Supabase client directly to the NextResponse object guarantees
 * that Set-Cookie deletion headers appear on the HTTP response the browser
 * receives, which is more reliable than using Server Actions + cookies().
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/login', request.url))

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.signOut()

  return response
}
