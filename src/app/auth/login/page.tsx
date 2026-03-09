import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LoginForm } from '@/components/features/auth/LoginForm'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Log In – ArshBoost',
  description: 'Log in to your ArshBoost account securely.',
  path: '/auth/login',
  noIndex: true,
})

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen w-full flex-col items-stretch px-8 py-14 md:flex-row md:px-[122px]">
      {/* Back button */}
      <Link
        href="/"
        aria-label="Go back to home"
        className="absolute left-8 top-[60px] flex h-[50px] items-center gap-3 rounded-md border border-[#2a2a2a] bg-[#111111] px-5 font-mono text-base tracking-[-0.07em] text-[#a0a0a0] transition-colors duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white md:left-[122px]"
      >
        <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
        Back
      </Link>

      {/* Left — copy */}
      <article className="mt-32 flex flex-1 flex-col justify-center gap-6 pr-0 md:mt-0 md:pr-24">
        <h1 className="font-sans text-5xl font-semibold leading-[1] tracking-[-0.07em] text-white md:text-[64px]">
          Log in to your <br/> account securely.
        </h1>
        <p className="font-mono text-base tracking-[-0.1em] text-[#a0a0a0] md:text-2xl">
          We use the most secure encryption systems,<br className="hidden md:block" />
          your data is safe with us.
        </p>
      </article>

      {/* Right — form */}
      <aside className="mt-10 flex w-full flex-col justify-center md:mt-0 md:w-[380px]">
        <LoginForm />
      </aside>
    </section>
  )
}
