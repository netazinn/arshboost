'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Game } from '@/types'
import { GameCard } from './GameCard'

interface GameGridProps {
  games: Game[]
}

export function GameGrid({ games }: GameGridProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? games.filter((g) =>
        g.name.toLowerCase().includes(query.toLowerCase())
      )
    : games

  return (
    <section aria-label="Game selection" className="flex w-full flex-col items-center gap-4">
      {/* Search bar */}
      <div className="relative w-full max-w-[466px]">
        <label htmlFor="game-search" className="sr-only">
          Search for your game
        </label>
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6e6d6f]"
          aria-hidden="true"
        />
        <input
          id="game-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for your game"
          autoComplete="off"
          className="h-[50px] w-full rounded-md border border-[#2a2a2a] bg-[#111111] pl-10 pr-4 text-center font-mono text-base tracking-[-0.1em] text-[#6e6d6f] placeholder:text-[#6e6d6f] focus:border-[#6e6d6f] focus:text-white focus:outline-none focus:placeholder:text-[#6e6d6f] transition-all duration-200 ease-in-out"
        />
      </div>

      {/* Game grid */}
      {filtered.length > 0 ? (
        <ul
          role="list"
          className="grid w-full max-w-[954px] grid-cols-2 gap-2 md:grid-cols-4"
        >
          {filtered.map((game) => (
            <li key={game.id}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-sm tracking-[-0.1em] text-[#6e6d6f]">
          No games found for &quot;{query}&quot;
        </p>
      )}

      {/* Warranty line */}
      <p className="flex items-center gap-2 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5zm-3.75 5.25a3.75 3.75 0 1 1 7.5 0v3h-7.5v-3z"
            clipRule="evenodd"
          />
        </svg>
        Every purchase is protected by ArshBoost&apos;s Comprehensive Warranty
      </p>
    </section>
  )
}
