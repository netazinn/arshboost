import type { Metadata } from 'next'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'TFT Boost – ArshBoost',
  description: 'Order Teamfight Tactics rank boosting and win boosting from ArshBoost.',
  path: '/tft/rank-boost',
  noIndex: false,
})

export default function TftOrderPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-black">
      <header className="flex items-center justify-between px-8 py-5 md:px-14">
        <Link
          href="/"
          className="font-mono text-base tracking-[-0.1em] text-white transition-opacity hover:opacity-70"
        >
          ArshBoost
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="flex h-9 items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#111111] px-4 font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] transition-colors hover:border-[#6e6d6f] hover:text-white"
          >
            <LogIn size={14} strokeWidth={1.5} />
            Log in
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="font-mono text-sm tracking-[-0.07em] text-[#6e6d6f]">
          TFT Boost — coming soon.
        </p>
      </main>
    </div>
  )
}
