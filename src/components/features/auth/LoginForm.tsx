'use client'

import { useActionState, useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { RefreshCw, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { loginAction, verifyTotpAction, type AuthActionState } from '@/lib/actions/auth'

const initialState: AuthActionState = { error: null, success: false }
const TIMER_SECONDS  = 90
const LOADING_DELAY  = 600

const sanitize = (v: string) => v.replace(/[<>'"``]/g, '')


export function LoginForm() {
  const [loginState, loginFormAction]       = useActionState(loginAction, initialState)
  const [totpState,  totpFormAction]        = useActionState(verifyTotpAction, initialState)
  const [, startTotpTransition]             = useTransition()

  const [showPassword, setShowPassword]     = useState(false)
  const [emailValue, setEmailValue]         = useState('')
  const [passwordValue, setPasswordValue]   = useState('')

  // Loading states (fake 600ms delay)
  const [step1Loading, setStep1Loading]     = useState(false)
  const [mfaLoading,   setMfaLoading]       = useState(false)

  // Shake + red border states
  const [shakeStep1, setShakeStep1]         = useState(false)
  const [shakeMfa,   setShakeMfa]           = useState(false)
  const [step1HasError, setStep1HasError]   = useState(false)
  const [mfaHasError,   setMfaHasError]     = useState(false)

  const isMfa        = !!loginState.requiresMfa
  const step1FormRef = useRef<HTMLFormElement>(null)
  const totpFormRef  = useRef<HTMLFormElement>(null)

  // ── 2FA client state ──────────────────────────────────────────────────────
  const [codeDisplay, setCodeDisplay]       = useState('')
  const [countdown, setCountdown]           = useState(TIMER_SECONDS)
  const [expired, setExpired]               = useState(false)
  const codeInputRef                        = useRef<HTMLInputElement>(null)
  const timerRef                            = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(TIMER_SECONDS)
    setExpired(false)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setExpired(true); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (isMfa) {
      setCodeDisplay('')
      startTimer()
      setTimeout(() => codeInputRef.current?.focus(), 50)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isMfa, startTimer])

  // Shake when server returns an error
  useEffect(() => {
    if (loginState.error) {
      setStep1HasError(true)
      setShakeStep1(false)
      requestAnimationFrame(() => setShakeStep1(true))
    }
  }, [loginState])

  useEffect(() => {
    if (totpState.error) {
      setMfaHasError(true)
      setShakeMfa(false)
      requestAnimationFrame(() => setShakeMfa(true))
    }
  }, [totpState])

  // Shake when TOTP expires mid-session
  useEffect(() => {
    if (expired) setShakeMfa(true)
  }, [expired])

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCodeDisplay(digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits)
    if (digits.length === 6) setMfaHasError(false)
  }

  const handleRefresh = () => {
    setCodeDisplay('')
    setMfaHasError(false)
    setShakeMfa(false)
    startTimer()
    codeInputRef.current?.focus()
  }

  const rawCode = codeDisplay.replace(' ', '')

  // ── Step 1 submit (with loading delay) ────────────────────────────────────
  const handleStep1Submit = useCallback(() => {
    if (isMfa || step1Loading) return
    if (!emailValue.trim() || passwordValue.length < 8) {
      setStep1HasError(true)
      setShakeStep1(true)
      return
    }
    setStep1HasError(false)
    setStep1Loading(true)
    setTimeout(() => {
      step1FormRef.current?.requestSubmit()
      setStep1Loading(false)
    }, LOADING_DELAY)
  }, [isMfa, step1Loading, emailValue, passwordValue])

  const handleKeyDownStep1 = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isMfa) handleStep1Submit()
  }

  // ── Step 2 submit (with loading delay) ────────────────────────────────────
  const handleTotpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mfaLoading) return
    if (expired || rawCode.length < 6) {
      setMfaHasError(true)
      setShakeMfa(true)
      return
    }
    setMfaHasError(false)
    setMfaLoading(true)
    const formData = new FormData(e.currentTarget)
    setTimeout(() => {
      startTotpTransition(() => totpFormAction(formData))
      setMfaLoading(false)
    }, LOADING_DELAY)
  }

  useEffect(() => {
    if (totpState.error) setMfaLoading(false)
  }, [totpState.error])

  // Google section visible when email is empty and not in MFA step
  const showGoogle = !emailValue && !isMfa
  // Password section visible when email has content or already in MFA
  const showPasswordSection = !!(emailValue || isMfa)

  return (
    <div className="flex w-full flex-col">

      {/* ── Hidden step-1 form ── */}
      {!isMfa && (
        <form
          ref={step1FormRef}
          action={loginFormAction}
          className="hidden"
          noValidate
          aria-hidden="true"
        >
          <input type="hidden" name="email"    value={emailValue} />
          <input type="hidden" name="password" value={passwordValue} />
        </form>
      )}

      {/* ── Google button + divider (animated out when user types) ── */}
      <div
        aria-hidden={!showGoogle}
        style={{
          display: 'grid',
          gridTemplateRows: showGoogle ? '1fr' : '0fr',
          opacity: showGoogle ? 1 : 0,
          transition: showGoogle
            ? 'grid-template-rows 0.48s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.32s cubic-bezier(0.25,0.46,0.45,0.94)'
            : 'grid-template-rows 0.4s cubic-bezier(0.55,0,1,0.45), opacity 0.22s cubic-bezier(0.55,0,1,0.45)',
          pointerEvents: showGoogle ? 'auto' : 'none',
        }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pb-3">
            {/* Continue with Google */}
            <button
              type="button"
              tabIndex={showGoogle ? 0 : -1}
              className="flex h-[50px] w-full items-center justify-center gap-3 rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-base tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[#6e6d6f]" aria-hidden="true" />
              <span className="font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">or</span>
              <span className="h-px flex-1 bg-[#6e6d6f]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Email — always visible ── */}
      <div className="mb-3">
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
          value={emailValue}
          onChange={e => { setEmailValue(sanitize(e.target.value)); setStep1HasError(false) }}
          onKeyDown={handleKeyDownStep1}
          onAnimationEnd={() => setShakeStep1(false)}
          disabled={isMfa}
          className={[
            'h-[50px] w-full rounded-md border bg-[#111111] px-4 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            step1HasError ? 'border-red-500 focus:border-red-400' : 'border-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f] disabled:hover:border-[#2a2a2a]',
            shakeStep1    ? 'animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]' : '',
          ].join(' ')}
        />
      </div>

      {/* ── Password + Login button (animated in when user types) ── */}
      <div
        aria-hidden={!showPasswordSection}
        style={{
          display: 'grid',
          gridTemplateRows: showPasswordSection ? '1fr' : '0fr',
          opacity: showPasswordSection ? 1 : 0,
          transition: showPasswordSection
            ? 'grid-template-rows 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.05s, opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94) 0.08s'
            : 'grid-template-rows 0.38s cubic-bezier(0.55,0,1,0.45), opacity 0.2s cubic-bezier(0.55,0,1,0.45)',
          pointerEvents: showPasswordSection ? 'auto' : 'none',
        }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3">
            {/* Password input */}
            <div className="relative">
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={passwordValue}
                onChange={e => { setPasswordValue(e.target.value); setStep1HasError(false) }}
                onKeyDown={handleKeyDownStep1}
                onAnimationEnd={() => setShakeStep1(false)}
                disabled={isMfa}
                tabIndex={showPasswordSection ? 0 : -1}
                className={[
                  'h-[50px] w-full rounded-md border bg-[#111111] px-4 pr-12 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  step1HasError ? 'border-red-500 focus:border-red-400' : 'border-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f] disabled:hover:border-[#2a2a2a]',
                  shakeStep1    ? 'animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]' : '',
                ].join(' ')}
              />
              {!isMfa && (
                <button
                  type="button"
                  tabIndex={showPasswordSection ? 0 : -1}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6d6f] transition-colors duration-200 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              )}
            </div>

            {/* Log In button */}
            {!isMfa && (
              <button
                type="button"
                onClick={handleStep1Submit}
                tabIndex={showPasswordSection ? 0 : -1}
                disabled={step1Loading || !emailValue.trim() || passwordValue.length < 8}
                className="h-[50px] w-full rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-base tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#2a2a2a]"
              >
                {step1Loading ? 'Continuing...' : 'Continue →'}
              </button>
            )}

            {/* Step 1 error */}
            {!isMfa && loginState.error && (
              <p role="alert" className="font-mono text-xs tracking-[-0.1em] text-red-400">
                {loginState.error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Step 2: TOTP form ── */}
      {isMfa && (
        <form
          ref={totpFormRef}
          onSubmit={handleTotpSubmit}
          className="mt-3 flex w-full flex-col gap-3"
          noValidate
        >
          <input type="hidden" name="factorId" value={loginState.mfaFactorId ?? ''} />
          <input type="hidden" name="code"     value={rawCode} />

          <div className="flex gap-2 animate-[fade-in-up_0.38s_cubic-bezier(0.25,0.46,0.45,0.94)_both]">
            <div
              className="relative flex flex-1 items-center"
              onAnimationEnd={() => setShakeMfa(false)}
            >
              <label htmlFor="totp-code" className="sr-only">2FA Code</label>
              <input
                ref={codeInputRef}
                id="totp-code"
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={codeDisplay}
                onChange={handleCodeChange}
                placeholder="000 000"
                autoComplete="one-time-code"
                disabled={expired}
                className={[
                  'h-[50px] w-full rounded-md border bg-[#111111] px-4 font-mono text-base tracking-[0.2em] transition-all duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                  mfaHasError || expired
                    ? 'border-red-500 text-[#a0a0a0] placeholder:text-red-900 focus:border-red-400'
                    : 'border-[#6e6d6f] text-[#a0a0a0] placeholder:text-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f] focus:text-white disabled:hover:border-[#2a2a2a]',
                  shakeMfa ? 'animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]' : '',
                ].join(' ')}
              />
              <span className="pointer-events-none absolute right-[44px] top-1/2 h-5 w-px -translate-y-1/2 bg-[#6e6d6f]" aria-hidden="true" />
              <button
                type="button"
                onClick={handleRefresh}
                aria-label="Refresh 2FA timer"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a0] transition-colors duration-200 hover:text-white"
              >
                <RefreshCw size={15} strokeWidth={1.5} />
              </button>
            </div>

            <button
              type="submit"
              disabled={mfaLoading || expired || rawCode.length < 6}
              className="h-[50px] w-[140px] shrink-0 rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-base tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#2a2a2a]"
            >
              {mfaLoading ? 'Verifying...' : 'Log In'}
            </button>
          </div>

          {expired ? (
            <p
              role="alert"
              className="animate-[fade-in-up_0.38s_cubic-bezier(0.25,0.46,0.45,0.94)_0.06s_both] font-mono text-xs tracking-[-0.1em] text-red-400"
            >
              Code expired. Press refresh to start over.
            </p>
          ) : (
            <p className="animate-[fade-in-up_0.38s_cubic-bezier(0.25,0.46,0.45,0.94)_0.06s_both] font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
              Code expires in{' '}
              <span className={countdown <= 10 ? 'text-red-400' : 'text-[#a0a0a0]'}>{countdown}s</span>
            </p>
          )}

          {totpState.error && (
            <p role="alert" className="animate-[fade-in-up_0.38s_cubic-bezier(0.25,0.46,0.45,0.94)_both] font-mono text-xs tracking-[-0.1em] text-red-400">
              {totpState.error}
            </p>
          )}
        </form>
      )}

      {/* Register link */}
      <p className="mt-3 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-[#a0a0a0] underline-offset-2 transition-colors duration-200 hover:text-white hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}
