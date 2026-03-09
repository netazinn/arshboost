'use client'

import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import type { UnratedGameMode } from '@/lib/unrated-boost-calculator'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVERS = [
  'Europe',
  'North America',
  'Asia Pacific',
  'Brazil',
  'Latin America',
]

const GAME_MODES: { slug: UnratedGameMode; label: string; description: string }[] = [
  { slug: 'unrated',  label: 'Unrated',  description: 'Standard unrated matches' },
  { slug: 'featured', label: 'Featured', description: 'Featured game mode matches' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ValorantUnratedBoostProps {
  ubMode:     UnratedGameMode
  setUbMode:  (m: UnratedGameMode) => void
  ubMatches:  number
  setUbMatches: (n: number) => void
  ubServer:   string
  setUbServer: (s: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValorantUnratedBoost({
  ubMode, setUbMode,
  ubMatches, setUbMatches,
  ubServer, setUbServer,
}: ValorantUnratedBoostProps) {

  const fillPct = ((ubMatches - 1) / 14) * 100

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Game Mode box ─────────────────────────────────────────────────── */}
      <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-stretch gap-3">
          {/* Icon: dynamic per active mode */}
          <div
            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#111111]"
            style={{ boxShadow: ubMode === 'unrated' ? '0 0 0 2px rgba(255,255,160,0.25)' : '0 0 0 2px rgba(255,70,85,0.25)' }}
          >
            {ubMode === 'unrated' ? (
              /* Unrated: filled circle in Radiant gold */
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="13" fill="#1a1a1a" stroke="#FFFFA0" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="7" fill="#FFFFA0" opacity="0.85" />
              </svg>
            ) : (
              /* Featured: red diamond (unchanged) */
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="16,2 30,16 16,30 2,16" fill="#1a1a1a" stroke="#FF4655" strokeWidth="1.5" />
                <polygon points="16,8 24,16 16,24 8,16" fill="#FF4655" opacity="0.8" />
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
            <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">Game Mode</p>
            <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">Select your desired unrated mode.</p>
          </div>
        </div>

        {/* Mode selector — 2 large side-by-side buttons */}
        <div className="grid grid-cols-2 gap-3">
          {GAME_MODES.map(mode => {
            const isActive = ubMode === mode.slug
            const accent   = mode.slug === 'unrated' ? '#FFFFA0' : '#FF4655'
            const accentRgb = mode.slug === 'unrated' ? '255,255,160' : '255,70,85'
            return (
              <button
                key={mode.slug}
                onClick={() => setUbMode(mode.slug)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-md bg-[#111111] py-5 transition-all duration-200 hover:bg-[#1a1a1a]"
                style={{
                  border:     isActive ? `1.5px solid ${accent}` : '1.5px solid transparent',
                  boxShadow:  isActive ? `0 0 18px 2px rgba(${accentRgb},0.18)` : 'none',
                }}
              >
                <span
                  className="font-sans text-base font-semibold tracking-[-0.06em]"
                  style={{ color: isActive ? accent : '#6e6d6f' }}
                >
                  {mode.label}
                </span>
                <span
                  className="font-mono text-[10px] tracking-[-0.04em]"
                  style={{ color: isActive ? '#a0a0a0' : '#3a3a3a' }}
                >
                  {mode.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Server dropdown ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative col-span-1">
          <select
            value={ubServer}
            onChange={e => setUbServer(e.target.value)}
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

        {/* Header: circle badge + title */}
        <div className="flex items-stretch gap-3">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#111111]">
            <span className="font-sans text-3xl font-bold tracking-[-0.07em] text-white">{ubMatches}</span>
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-md border border-[#2a2a2a] bg-[#111111] px-5">
            <p className="font-sans text-lg font-semibold tracking-[-0.07em] text-white">Matches Amount</p>
            <p className="mt-0.5 font-mono text-xs tracking-[-0.07em] text-[#a0a0a0]">Select your desired amount of matches.</p>
          </div>
        </div>

        {/* Progress + Slider */}
        <div className="flex flex-col gap-5">

          {/* 15-segment clickable track */}
          <div className="flex gap-[2px]">
            {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setUbMatches(n)}
                className="flex-1 h-18 transition-all duration-150 cursor-pointer"
                style={{
                  background: n <= ubMatches ? 'white' : '#1e1e1e',
                  boxShadow:  n <= ubMatches ? '0 0 6px rgba(255,255,255,0.30)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-2 mt-4">
            <style>{`
              .ub-slider { -webkit-appearance: none; appearance: none; background: transparent; }
              .ub-slider::-webkit-slider-runnable-track {
                height: 3px;
                background: linear-gradient(
                  to right,
                  rgba(255,255,255,0.8) 0%,
                  rgba(255,255,255,0.8) ${fillPct}%,
                  #2a2a2a ${fillPct}%,
                  #2a2a2a 100%
                );
              }
              .ub-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                margin-top: -6.5px;
                cursor: pointer;
                box-shadow: 0 0 8px rgba(255,255,255,0.25);
              }
              .ub-slider::-moz-range-track { height: 3px; background: #2a2a2a; }
              .ub-slider::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                border: none;
                cursor: pointer;
              }
              .ub-slider::-moz-range-progress { height: 3px; background: rgba(255,255,255,0.8); }
            `}</style>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={ubMatches}
              onChange={e => setUbMatches(Number(e.target.value))}
              className="ub-slider w-full cursor-pointer"
            />
            {/* Tick labels: show 1, 5, 10, 15 to avoid clutter */}
            <div className="relative h-4">
              {[1, 5, 10, 15].map(n => {
                const pct = ((n - 1) / 14) * 100
                return (
                  <span
                    key={n}
                    className="absolute font-mono text-[10px] tracking-[-0.05em] -translate-x-1/2"
                    style={{
                      left: `${pct}%`,
                      color: n <= ubMatches ? 'rgba(255,255,255,0.5)' : '#3a3a3a',
                    }}
                  >
                    {n}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
