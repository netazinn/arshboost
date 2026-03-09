import type { Metadata } from 'next'
import { GameGrid } from '@/components/features/game-grid/GameGrid'
import { getActiveGames } from '@/lib/data/games'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'ArshBoost – Simple, Secure & Fast Game Boosting',
  description:
    'Create, pay and track your order in one screen. Professional rank boost, win boost, and duo boost services.',
  path: '/',
})

export default async function HomePage() {
  const games = await getActiveGames()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16 pt-6">
      {/* Hero */}
      <section className="flex flex-col items-center gap-1 text-center" aria-labelledby="hero-heading">
        <h1
          id="hero-heading"
          className="font-sans text-4xl font-semibold leading-tight tracking-[-0.07em] text-white md:text-5xl"
        >
          Simple, Secure &amp; Fast
        </h1>
        <p className="font-mono text-sm tracking-[-0.1em] text-[#6e6d6f] md:text-base">
          Create, pay and track your order in one screen!
        </p>
      </section>

      {/* Game grid with search */}
      <GameGrid games={games} />
    </div>
  )
}
