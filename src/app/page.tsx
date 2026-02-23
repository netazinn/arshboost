import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ArshBoost – Professional Game Boosting Service',
  description:
    'Rank boost, win boost, duo boost – achieve your desired rank fast and safely with ArshBoost professional boosters.',
}

export default function HomePage() {
  return (
    <main>
      {/* Phase 3: Landing Page will be implemented here */}
      <section className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-4xl font-bold tracking-tight">ArshBoost</h1>
        <p className="mt-4 text-muted-foreground">
          Professional Game Boosting Service
        </p>
      </section>
    </main>
  )
}
