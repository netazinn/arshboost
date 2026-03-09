import type { Game } from '@/types'
import Image from 'next/image'
import Link from 'next/link'
import { GAME_ICONS } from '@/lib/config/game-icons'

interface GameCardProps {
  game: Game
}

const GAME_ROUTES: Record<string, string> = {
  'valorant':          '/valorant/rank-boost',
  'league-of-legends': '/league-of-legends/rank-boost',
  'apex-legends':      '/apex-legends/rank-boost',
  'tft':               '/tft/rank-boost',
}

export function GameCard({ game }: GameCardProps) {
  const iconSrc = GAME_ICONS[game.slug] ?? game.logo_url
  const isPng  = iconSrc.endsWith('.png') || iconSrc.endsWith('.webp') || iconSrc.endsWith('.jpg')
  const href    = GAME_ROUTES[game.slug] ?? `/order?game=${game.slug}`

  return (
    <Link
      href={href}
      aria-label={`Start boosting ${game.name}`}
      className="group flex h-12 items-center gap-3 rounded-md border border-[#2a2a2a] bg-[#111111] px-4 transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <div className="relative h-7 w-7 shrink-0">
        {isPng ? (
          <Image
            src={iconSrc}
            alt={game.name}
            width={28}
            height={28}
            className="h-7 w-7 rounded-sm object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt={game.name} width={28} height={28} className="object-contain" />
        )}
      </div>
      <span className="truncate font-mono text-xs tracking-[-0.1em] text-[#6e6d6f] transition-colors duration-200 ease-in-out group-hover:text-white">
        {game.name}
      </span>
    </Link>
  )
}
