'use client'

import Image from 'next/image'
import { ChevronDown } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const UNRANKED = { name: 'Unranked', slug: 'unranked', color: '#4a4a4a' }

const TIERS = [
  { name: 'Iron',      slug: 'iron',      color: '#8C8C8C' },
  { name: 'Bronze',    slug: 'bronze',    color: '#C8874B' },
  { name: 'Silver',    slug: 'silver',    color: '#D4D4D4' },
  { name: 'Gold',      slug: 'gold',      color: '#E5B941' },
  { name: 'Platinum',  slug: 'platinum',  color: '#3FC4C4' },
  { name: 'Diamond',   slug: 'diamond',   color: '#9B6EFF' },
  { name: 'Ascendant', slug: 'ascendant', color: '#3FCA71' },
  { name: 'Immortal',  slug: 'immortal',  color: '#FF4655' },
]

const RADIANT = { name: 'Radiant', slug: 'radiant', color: '#FFFFA0' }

// Row 1 grid: Unranked + Iron → Immortal  (9 items → grid-cols-9)
const ROW1_TIERS = [UNRANKED, ...TIERS]

const ROMAN = ['I', 'II', 'III']

const SERVERS = [
  'Europe',
  'North America',
  'Asia Pacific',
  'Brazil',
  'Latin America',
]

// Slugs where divisions are irrelevant
const NO_DIVISION_SLUGS = new Set(['radiant', 'unranked'])

// ─── Unranked Icon ────────────────────────────────────────────────────────────

export function UnrankedIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="48" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="2" />
      <circle cx="50" cy="50" r="36" fill="#111111" stroke="#2a2a2a" strokeWidth="1.5" />
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="44"
        fontWeight="700"
        fill="#5a5a5a"
      >
        ?
      </text>
    </svg>
  )
}

// ─── Props interface ─────────────────────────────────────────────────────────

interface ValorantPlacementsBoostProps {
  plTier: string
  setPlTier: (t: string) => void
  plDivision: number
  setPlDivision: (d: number) => void
  plMatches: number
  setPlMatches: (m: number) => void
  plServer: string
  setPlServer: (s: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValorantPlacementsBoost({
  plTier, setPlTier,
  plDivision, setPlDivision,
  plMatches, setPlMatches,
  plServer, setPlServer,
}: ValorantPlacementsBoostProps) {
  const isDivisionDisabled = NO_DIVISION_SLUGS.has(plTier)
  const selectedColor =
    ROW1_TIERS.find(t => t.slug === plTier)?.color ??
    (plTier === 'radiant' ? RADIANT.color : '#ffffff')

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Previous Rank box ─────────────────────────────────────────────── */}
      <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col gap-4">

        {/* Header: icon circle + title bar */}
        <div className="flex items-stretch gap-3">
          <div
            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#111111]"
            style={{ boxShadow: `0 0 0 2px ${selectedColor}33` }}
          >
            {plTier === 'unranked' ? (
              <UnrankedIcon size={40} />
            ) : (
              <Image
                src={`/images/valorant/ranks/${plTier}.webp`}
                alt={plTier}
                width={40}
                height={40}
                className="object-contain drop-shadow-md"
              />
            )}
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
            <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">
              Previous Rank
            </p>
            <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">
              Select your previous tier and division.
            </p>
          </div>
        </div>

        {/* Row 1: Unranked → Ascendant (8 cols) */}
        <div className="grid grid-cols-8 gap-2">
          {ROW1_TIERS.slice(0, 8).map((tier) => {
            const isSelected = plTier === tier.slug
            return (
              <button
                key={tier.slug}
                onClick={() => {
                  setPlTier(tier.slug)
                  if (NO_DIVISION_SLUGS.has(tier.slug)) setPlDivision(1)
                }}
                className="flex h-[62px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{
                  border: isSelected
                    ? `1.5px solid ${tier.color}`
                    : '1.5px solid transparent',
                }}
              >
                {tier.slug === 'unranked' ? (
                  <UnrankedIcon size={28} />
                ) : (
                  <Image
                    src={`/images/valorant/ranks/${tier.slug}.webp`}
                    alt={tier.name}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Row 2: Division buttons (cols 1-3) + Immortal (col 7) + Radiant (col 8) */}
        <div className="grid grid-cols-8 gap-2">

          {/* Division I / II / III — disabled (not unmounted) for Unranked/Radiant */}
          <div
            className={`col-span-3 grid grid-cols-3 gap-2 transition-opacity duration-200 ${
              isDivisionDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
            }`}
          >
            {[1, 2, 3].map((div) => {
              const isSelected = plDivision === div
              return (
                <button
                  key={div}
                  onClick={() => setPlDivision(div)}
                  className="flex h-[46px] items-center justify-center rounded-md bg-[#111111] font-mono text-sm tracking-[-0.07em] transition-all duration-200"
                  style={{
                    border: isSelected
                      ? `1.5px solid ${selectedColor}`
                      : '1.5px solid transparent',
                    color: isSelected ? selectedColor : '#6e6d6f',
                  }}
                >
                  {ROMAN[div - 1]}
                </button>
              )
            })}
          </div>

          {/* Immortal — col 7 */}
          {(() => {
            const immortal = TIERS[7] // immortal
            const isSelected = plTier === 'immortal'
            return (
              <button
                onClick={() => setPlTier('immortal')}
                className="col-start-7 flex h-[46px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{ border: isSelected ? `1.5px solid ${immortal.color}` : '1.5px solid transparent' }}
              >
                <Image
                  src="/images/valorant/ranks/immortal.webp"
                  alt="Immortal"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </button>
            )
          })()}

          {/* Radiant — col 8 */}
          <button
            onClick={() => { setPlTier('radiant'); setPlDivision(1) }}
            className="col-start-8 flex h-[46px] items-center justify-center rounded-md bg-[#111111] transition-all duration-200 hover:bg-[#1a1a1a]"
            style={{
              border: plTier === 'radiant'
                ? `1.5px solid ${RADIANT.color}`
                : '1.5px solid transparent',
            }}
          >
            <Image
              src="/images/valorant/ranks/radiant.webp"
              alt="Radiant"
              width={28}
              height={28}
              className="object-contain"
            />
          </button>
        </div>
      </div>

      {/* ── Server dropdown ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative col-span-1">
          <select
            value={plServer}
            onChange={e => setPlServer(e.target.value)}
            className="h-[52px] w-full appearance-none rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-4 font-mono text-sm tracking-[-0.07em] text-[#a0a0a0] focus:outline-none hover:border-[#6e6d6f] transition-all cursor-pointer"
          >
            {SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown
            size={13}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6d6f]"
          />
        </div>
      </div>

      {/* ── Matches Amount box ────────────────────────────────────────────── */}
      <div className="flex-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col justify-between gap-10">

        {/* Header row: circle badge + title bar */}
        <div className="flex items-stretch gap-3">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#111111]">
            <span className="font-sans text-3xl font-bold tracking-[-0.07em] text-white">
              {plMatches}
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
            <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">
              Matches Amount
            </p>
            <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">
              Select your desired amount of matches.
            </p>
          </div>
        </div>

        {/* Progress indicator + Slider */}
        <div className="flex flex-col gap-5">

          {/* Segmented progress indicator — 5 clickable segments */}
          <div className="flex gap-[3px]">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setPlMatches(n)}
                className="flex-1 h-10 transition-all duration-200 cursor-pointer"
                style={{
                  background: n <= plMatches ? 'white' : '#1e1e1e',
                  boxShadow: n <= plMatches ? '0 0 8px rgba(255,255,255,0.35)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-2 mt-4">
            <style>{`
              .pl-slider { -webkit-appearance: none; appearance: none; background: transparent; }
              .pl-slider::-webkit-slider-runnable-track {
                height: 3px;
                background: linear-gradient(
                  to right,
                  rgba(255,255,255,0.8) 0%,
                  rgba(255,255,255,0.8) calc((${plMatches - 1}) / 4 * 100%),
                  #2a2a2a calc((${plMatches - 1}) / 4 * 100%),
                  #2a2a2a 100%
                );
              }
              .pl-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                margin-top: -6.5px;
                cursor: pointer;
                box-shadow: 0 0 8px rgba(255,255,255,0.25);
              }
              .pl-slider::-moz-range-track { height: 3px; background: #2a2a2a; }
              .pl-slider::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                border: none;
                cursor: pointer;
              }
              .pl-slider::-moz-range-progress { height: 3px; background: rgba(255,255,255,0.8); }
            `}</style>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={plMatches}
              onChange={e => setPlMatches(Number(e.target.value))}
              className="pl-slider w-full cursor-pointer"
            />
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5].map(n => (
                <span
                  key={n}
                  className="font-mono text-[10px] tracking-[-0.05em]"
                  style={{ color: n <= plMatches ? 'rgba(255,255,255,0.5)' : '#3a3a3a' }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
