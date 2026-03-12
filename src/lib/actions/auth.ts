'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isDisposableEmail } from '@/lib/utils/anomaly-detection'

// ─── Role → dashboard mapping ────────────────────────────────────────────────

const ROLE_HOME: Record<string, string> = {
  booster: '/dashboard',
  support: '/admin',
  admin:   '/admin',
  accountant: '/admin/withdrawals',
  client:  '/',
}

async function getRoleHome(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/dashboard/orders'
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as string | undefined
  return role ? (ROLE_HOME[role] ?? '/') : '/'
}

// ─── Login ───────────────────────────────────────────────────────────────────

export interface AuthActionState {
  error: string | null
  success: boolean
  pendingVerification?: boolean
  requiresMfa?: boolean
  mfaFactorId?: string
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.', success: false }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // Dev-mode: simulate 2FA challenge for test account
  if (!error && process.env.NODE_ENV === 'development' && email === 'admin@arshboost.com') {
    return { error: null, success: false, requiresMfa: true, mfaFactorId: 'dev-bypass' }
  }

  if (error) {
    if (error.code === 'mfa_challenge_required') {
      const { data: factorData } = await supabase.auth.mfa.listFactors()
      const totpFactor = factorData?.totp?.[0]
      return {
        error: null,
        success: false,
        requiresMfa: true,
        mfaFactorId: totpFactor?.id ?? '',
      }
    }
    return { error: error.message, success: false }
  }

  revalidatePath('/', 'layout')
  const home = await getRoleHome(supabase)
  redirect(home)
}

// ─── Verify TOTP (2FA) ────────────────────────────────────────────────────────

export async function verifyTotpAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const code     = formData.get('code')     as string
  const factorId = formData.get('factorId') as string

  if (!code || code.length < 6) {
    return { error: 'Enter the 6-digit code.', success: false, requiresMfa: true, mfaFactorId: factorId }
  }

  const supabase = await createClient()

  // Dev-mode bypass: accept 123456 without real TOTP check
  if (process.env.NODE_ENV === 'development' && factorId === 'dev-bypass') {
    if (code !== '123456') {
      return { error: 'Invalid code. Use 123456 in dev mode.', success: false, requiresMfa: true, mfaFactorId: factorId }
    }
    revalidatePath('/', 'layout')
    const home = await getRoleHome(supabase)
    redirect(home)
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })

  if (error) {
    return { error: error.message, success: false, requiresMfa: true, mfaFactorId: factorId }
  }

  revalidatePath('/', 'layout')
  const home = await getRoleHome(supabase)
  redirect(home)
}

// ─── Register ────────────────────────────────────────────────────────────────

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email    = formData.get('email')    as string
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!email || !username || !password) {
    return { error: 'All fields are required.', success: false }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.', success: false }
  }

  // ── Disposable email check ─────────────────────────────────────────────────
  const burner = await isDisposableEmail(email)
  if (burner) {
    return { error: 'Please use a valid, permanent email address to register.', success: false }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })

  if (error) {
    return { error: error.message, success: false }
  }

  // If email confirmation is required, identities will be empty
  const needsVerification = !data.session

  if (needsVerification) {
    return { error: null, success: true, pendingVerification: true }
  }

  // Auto-confirmed (e.g. dev mode) — update username and redirect
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ username })
      .eq('id', data.user.id)
  }

  revalidatePath('/', 'layout')
  const homeForNew = await getRoleHome(supabase)
  redirect(homeForNew)
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  // Do NOT call redirect() here — the client performs a hard navigation
  // (window.location.href) so the Next.js router cache is fully wiped.
}
