'use client'

import { useActionState, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { registerAction, type AuthActionState } from '@/lib/actions/auth'

const initialState: AuthActionState = { error: null, success: false }

const BANNED_USERNAMES = ['admin', 'user', 'test', 'root', 'arsh', 'moderator', 'arshboost']
const EMAIL_REGEX      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sanitizeEmail    = (v: string) => v.replace(/[<>'"\\;]/g, '')
const sanitizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9\-_]/g, '')

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'banned'

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const [countdown, setCountdown] = useState(30)

  const [emailValue,    setEmailValue]    = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [usernameValue, setUsernameValue] = useState('')

  const [revealPassword, setRevealPassword] = useState(false)
  const [emailError,     setEmailError]     = useState(false)
  const [shakeEmail,     setShakeEmail]     = useState(false)
  const [shakeUsername,  setShakeUsername]  = useState(false)
  const [submitLoading,  setSubmitLoading]  = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const emailValid    = EMAIL_REGEX.test(emailValue)
  const ruleLength    = passwordValue.length >= 8
  const ruleUpper     = /[A-Z]/.test(passwordValue)
  const ruleLower     = /[a-z]/.test(passwordValue)
  const ruleDigit     = /[0-9]/.test(passwordValue)
  const passwordOk    = ruleLength && ruleUpper && ruleLower && ruleDigit
  const pwStrength    = [ruleLength, ruleUpper, ruleLower, ruleDigit].filter(Boolean).length

  const showGoogle       = !emailValue
  const showPasswordStep = !!emailValue
  const showUsernameStep = passwordOk
  const allValid         = emailValid && passwordOk && usernameStatus === 'available' && usernameValue.length >= 3

  useEffect(() => {
    if (!showUsernameStep || usernameValue.length < 3) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setUsernameStatus(BANNED_USERNAMES.includes(usernameValue) ? 'banned' : 'available')
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [usernameValue, showUsernameStep])

  useEffect(() => {
    if (!showUsernameStep) setUsernameStatus('idle')
  }, [showUsernameStep])

  const handleEmailBlur = () => {
    if (emailValue && !emailValid) {
      setEmailError(true)
      setShakeEmail(false)
      requestAnimationFrame(() => setShakeEmail(true))
    } else {
      setEmailError(false)
    }
  }

  const handleSubmit = useCallback(() => {
    if (!allValid || submitLoading) return
    setSubmitLoading(true)
    setTimeout(() => {
      formRef.current?.requestSubmit()
      setSubmitLoading(false)
    }, 600)
  }, [allValid, submitLoading])

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && usernameStatus === 'available') handleSubmit()
  }

  useEffect(() => {
    if (state.error) setSubmitLoading(false)
  }, [state.error])

  useEffect(() => {
    if (!state.pendingVerification) return
    setCountdown(30)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          router.push('/auth/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [state.pendingVerification, router])

  if (state.pendingVerification) {
    return (
      <div className="flex w-full flex-col gap-8">
        <p className="text-center font-mono text-base tracking-[-0.1em] text-white">Check Your Inbox</p>
        <div className="w-full rounded-xl border border-[#2a2a2a] bg-[#111111] px-6 py-10 text-center">
          <p className="font-mono text-sm tracking-[-0.1em] text-white">
            We sent a confirmation link to your email address. Click it to activate your account.
          </p>
          {/* Countdown progress bar */}
          <div className="mt-6 h-0.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
            <div
              className="h-full bg-[#6e6d6f] transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
          <p className="mt-3 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
            Redirecting to login in {countdown}s
          </p>
        </div>
        <p className="text-center font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
          Already confirmed?{' '}
          <a href="/auth/login" className="text-[#a0a0a0] underline-offset-2 transition-colors duration-200 hover:text-white hover:underline">
            Log in
          </a>
        </p>
      </div>
    )
  }

  const progress = allValid ? 100 : showUsernameStep ? 66 : showPasswordStep ? 33 : 0

  return (
    <div className="flex w-full flex-col">

      {/* Progress bar */}
      <div
        className="mb-4 h-0.5 w-full overflow-hidden bg-[#2a2a2a]"
        style={{
          opacity: progress > 0 ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${progress}%`,
            transition: 'width 0.5s cubic-bezier(0.25,0.46,0.45,0.94), background-color 0.4s ease',
            height: '100%',
            backgroundColor: progress === 100 ? '#16a34a' : '#6e6d6f',
          }}
        />
      </div>

      {/* Hidden real form */}
      <form ref={formRef} action={formAction} className="hidden" aria-hidden="true" noValidate>
        <input type="hidden" name="email"    value={emailValue} />
        <input type="hidden" name="password" value={passwordValue} />
        <input type="hidden" name="username" value={usernameValue} />
      </form>

      {/* Google button + divider */}
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
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[#6e6d6f]" aria-hidden="true" />
              <span className="font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">or</span>
              <span className="h-px flex-1 bg-[#6e6d6f]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="mb-3">
        <label htmlFor="reg-email" className="sr-only">Email</label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
          value={emailValue}
          onChange={e => { setEmailValue(sanitizeEmail(e.target.value)); setEmailError(false) }}
          onBlur={handleEmailBlur}
          onAnimationEnd={() => setShakeEmail(false)}
          className={[
            'h-[50px] w-full rounded-md border bg-[#111111] px-4 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:text-white focus:outline-none',
            emailError
              ? 'border-red-500 focus:border-red-400 hover:border-red-400'
              : 'border-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f]',
            shakeEmail ? 'animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]' : '',
          ].join(' ')}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateRows: emailError ? '1fr' : '0fr',
            opacity: emailError ? 1 : 0,
            transition: 'grid-template-rows 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.25s ease',
          }}
        >
          <div className="overflow-hidden">
            <p className="pt-1.5 font-mono text-xs tracking-[-0.1em] text-red-400">
              Please enter a valid email address.
            </p>
          </div>
        </div>
      </div>

      {/* Password step */}
      <div
        aria-hidden={!showPasswordStep}
        style={{
          display: 'grid',
          gridTemplateRows: showPasswordStep ? '1fr' : '0fr',
          opacity: showPasswordStep ? 1 : 0,
          transition: showPasswordStep
            ? 'grid-template-rows 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.04s, opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94) 0.07s'
            : 'grid-template-rows 0.38s cubic-bezier(0.55,0,1,0.45), opacity 0.2s cubic-bezier(0.55,0,1,0.45)',
          pointerEvents: showPasswordStep ? 'auto' : 'none',
        }}
      >
        <div className="overflow-hidden">
          <div className="mb-3 flex flex-col gap-3">
            <div className="relative">
              <label htmlFor="reg-password" className="sr-only">Password</label>
              <input
                id="reg-password"
                type={revealPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Password"
                required
                value={passwordValue}
                onChange={e => setPasswordValue(e.target.value)}
                tabIndex={showPasswordStep ? 0 : -1}
                className={[
                  'h-[50px] w-full rounded-md border bg-[#111111] px-4 pr-12 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:text-white focus:outline-none',
                  passwordOk
                    ? 'border-green-600 focus:border-green-500 hover:border-green-500'
                    : 'border-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f]',
                ].join(' ')}
              />
              <button
                type="button"
                tabIndex={showPasswordStep ? 0 : -1}
                onClick={() => setRevealPassword(v => !v)}
                aria-label={revealPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6d6f] transition-colors duration-200 hover:text-white"
              >
                {revealPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Strength bar */}
            <div className="flex gap-1" aria-label={`Password strength: ${pwStrength} of 4`}>
              {[1, 2, 3, 4].map(seg => {
                const filled = seg <= pwStrength
                const bg = !filled
                  ? '#2a2a2a'
                  : pwStrength <= 1 ? '#ef4444'
                  : pwStrength <= 2 ? '#f97316'
                  : pwStrength <= 3 ? '#eab308'
                  : '#16a34a'
                return (
                  <div
                    key={seg}
                    style={{ backgroundColor: bg, transition: 'background-color 0.35s ease' }}
                    className="h-0.5 flex-1"
                  />
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {([
                { ok: ruleLength, label: 'At least 8 characters' },
                { ok: ruleUpper,  label: 'One uppercase letter'  },
                { ok: ruleLower,  label: 'One lowercase letter'  },
                { ok: ruleDigit,  label: 'One number'            },
              ] as const).map(({ ok, label }) => {
                const started = passwordValue.length > 0
                const color = ok ? 'text-green-500' : started ? 'text-red-400' : 'text-[#6e6d6f]'
                return (
                  <div key={label} className="flex items-center gap-2">
                    <Check
                      size={13}
                      strokeWidth={2.5}
                      className={['shrink-0 transition-colors duration-300', color].join(' ')}
                    />
                    <span
                      className={[
                        'font-mono text-xs tracking-[-0.1em] transition-colors duration-300',
                        color,
                      ].join(' ')}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Username step */}
      <div
        aria-hidden={!showUsernameStep}
        style={{
          display: 'grid',
          gridTemplateRows: showUsernameStep ? '1fr' : '0fr',
          opacity: showUsernameStep ? 1 : 0,
          transition: showUsernameStep
            ? 'grid-template-rows 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.04s, opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94) 0.07s'
            : 'grid-template-rows 0.38s cubic-bezier(0.55,0,1,0.45), opacity 0.2s cubic-bezier(0.55,0,1,0.45)',
          pointerEvents: showUsernameStep ? 'auto' : 'none',
        }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <label htmlFor="reg-username" className="sr-only">Username</label>
              <input
                id="reg-username"
                type="text"
                autoComplete="username"
                placeholder="Username"
                required
                value={usernameValue}
                onChange={e => {
                  setUsernameValue(sanitizeUsername(e.target.value))
                  setShakeUsername(false)
                }}
                onKeyDown={handleUsernameKeyDown}
                onAnimationEnd={() => setShakeUsername(false)}
                tabIndex={showUsernameStep ? 0 : -1}
                className={[
                  'h-[50px] w-full rounded-md border bg-[#111111] px-4 pr-12 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:text-white focus:outline-none',
                  usernameStatus === 'available'
                    ? 'border-green-600 focus:border-green-500 hover:border-green-500'
                    : usernameStatus === 'taken' || usernameStatus === 'banned'
                      ? 'border-red-500 focus:border-red-400 hover:border-red-400'
                      : 'border-[#6e6d6f] hover:border-[#6e6d6f] focus:border-[#6e6d6f]',
                  shakeUsername ? 'animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]' : '',
                ].join(' ')}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <Loader2 size={15} strokeWidth={1.5} className="animate-spin text-[#6e6d6f]" />
                )}
                {usernameStatus === 'available' && (
                  <Check
                    size={15}
                    strokeWidth={2.5}
                    className="animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both] text-green-500"
                  />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'banned') && (
                  <X
                    size={15}
                    strokeWidth={2.5}
                    className="animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both] text-red-400"
                  />
                )}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateRows: usernameStatus !== 'idle' && usernameValue.length >= 3 ? '1fr' : '0fr',
                opacity: usernameStatus !== 'idle' && usernameValue.length >= 3 ? 1 : 0,
                marginTop: '-4px',
                transition: 'grid-template-rows 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.25s ease',
              }}
            >
              <div className="overflow-hidden">
                <p
                  className={[
                    'pb-1 font-mono text-xs tracking-[-0.1em]',
                    usernameStatus === 'available'
                      ? 'text-green-500'
                      : usernameStatus === 'taken' || usernameStatus === 'banned'
                        ? 'text-red-400'
                        : 'text-[#6e6d6f]',
                  ].join(' ')}
                >
                  {usernameStatus === 'checking'  && 'Checking availability...'}
                  {usernameStatus === 'available' && `@${usernameValue} is available`}
                  {usernameStatus === 'banned'    && 'This username is not allowed.'}
                  {usernameStatus === 'taken'     && 'This username is already taken.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              tabIndex={showUsernameStep ? 0 : -1}
              disabled={!allValid || submitLoading}
              className="h-[50px] w-full rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-base tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#2a2a2a] disabled:hover:text-[#a0a0a0]"
            >
              {submitLoading ? 'Creating account...' : 'Sign Up'}
            </button>

            {state.error && (
              <p role="alert" className="font-mono text-xs tracking-[-0.1em] text-red-400">
                {state.error}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="text-[#a0a0a0] underline-offset-2 transition-colors duration-200 hover:text-white hover:underline"
        >
          Log in
        </Link>
      </p>

    </div>
  )
}
