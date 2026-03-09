'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { claimBoostAction } from '@/app/dashboard/(booster)/actions'

// ── Display type ──────────────────────────────────────────────────────────────
// Built server-side from an Order row and passed as serialisable props.

export interface BoostDisplay {
  /** Full UUID – used as stable React key and for claim actions */
  id:           string
  /** First 8 chars of the UUID, uppercase – shown in the UI */
  shortId:      string
  game:         string
  service:      string
  startRank:    string | null
  endRank:      string | null
  startRRRange: string | null
  targetRR:     number | null
  /** Short region code, e.g. "EU", "NA" */
  server:       string
  /** Full region name, e.g. "Europe" */
  serverFull:   string
  queue:        string
  options:      string[]
  /** Lowercase agent slugs, e.g. ["jett", "omen"] */
  agents:       string[]
  wins?:        number
  payout:       number
  postedAt:     string
}

// ── Rank image map ────────────────────────────────────────────────────────────

const RANK_IMG: Record<string, string> = {
  Iron:      '/images/valorant/ranks/iron.webp',
  Bronze:    '/images/valorant/ranks/bronze.webp',
  Silver:    '/images/valorant/ranks/silver.webp',
  Gold:      '/images/valorant/ranks/gold.webp',
  Platinum:  '/images/valorant/ranks/platinum.webp',
  Diamond:   '/images/valorant/ranks/diamond.webp',
  Ascendant: '/images/valorant/ranks/ascendant.webp',
  Immortal:  '/images/valorant/ranks/immortal.webp',
  Radiant:   '/images/valorant/ranks/radiant.webp',
  Unranked:  '/images/valorant/ranks/unranked.svg',
}

function getRankImg(rank: string | null): string {
  if (!rank) return RANK_IMG.Unranked
  const key = Object.keys(RANK_IMG).find(k => rank.startsWith(k))
  return key ? RANK_IMG[key] : RANK_IMG.Unranked
}

// ── Visual primitives ─────────────────────────────────────────────────────────

function RankCell({ rank, showArrow = false }: { rank: string | null; showArrow?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {showArrow && (
        <span className="font-mono text-[12px] leading-none text-[#D9D9D9]">→</span>
      )}
      <Image
        src={getRankImg(rank)}
        alt={rank ?? 'Unranked'}
        width={18}
        height={18}
        className="shrink-0 object-contain"
      />
      <span className="font-mono text-[12px] leading-none tracking-[-0.05em] text-[#A0A0A0]">
        {rank ?? 'Unranked'}
      </span>
    </div>
  )
}

function AgentAvatars({ agents }: { agents: string[] }) {
  const shown = agents.slice(0, 4)
  return (
    <div className="flex">
      {shown.map((agent, i) => (
        <div
          key={agent}
          style={{ zIndex: shown.length - i }}
          className="relative -ml-1.5 first:ml-0 h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 border-[#0B0B0B] bg-zinc-800"
        >
          <Image
            src={`/images/valorant/agents/${agent}.webp`}
            alt={agent}
            fill
            className="object-cover object-top"
          />
        </div>
      ))}
    </div>
  )
}

function DataCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <span className="font-mono text-[10px] uppercase leading-none tracking-[0.03em] text-[#6E6D6F]">
        {label}
      </span>
      {children}
    </div>
  )
}

function DataValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[12px] leading-none tracking-[-0.05em] whitespace-nowrap text-[#A0A0A0]">
      {children}
    </span>
  )
}

// ── Options grid (owns its own expand state) ──────────────────────────────────

function OptionsGrid({ boost }: { boost: BoostDisplay }) {
  const [open, setOpen] = useState(false)
  const visible = boost.options.slice(0, 2)
  const hidden  = boost.options.slice(2)

  return (
    <div className="mt-5 mb-5 grid grid-cols-[1fr_1fr_1.5fr] gap-y-4 gap-x-4 px-5">
      {/* Row 1 */}
      <DataCell label="START RR">
        <DataValue>{boost.startRRRange ? `${boost.startRRRange} RR` : '—'}</DataValue>
      </DataCell>

      <DataCell label="TARGET RR">
        <DataValue>{boost.targetRR != null ? `${boost.targetRR} RR` : '—'}</DataValue>
      </DataCell>

      <DataCell label="AGENTS">
        {boost.agents.length > 0 ? (
          <AgentAvatars agents={boost.agents} />
        ) : (
          <DataValue>—</DataValue>
        )}
      </DataCell>

      {/* Row 2 */}
      <DataCell label="QUEUE">
        <DataValue>{boost.queue ? boost.queue.toUpperCase() : '—'}</DataValue>
      </DataCell>

      <DataCell label="SERVER">
        <DataValue>{boost.serverFull ? boost.serverFull.toUpperCase() : '—'}</DataValue>
      </DataCell>

      <DataCell label="EXTRA OPTIONS">
        <div className="relative flex flex-row flex-wrap items-center gap-1">
          {boost.options.length === 0 && <DataValue>None</DataValue>}
          {visible.map(o => (
            <span
              key={o}
              className="rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-[#A0A0A0]"
            >
              {o}
            </span>
          ))}
          {hidden.length > 0 && (
            <>
              <button
                onClick={() => setOpen(v => !v)}
                className="rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-[#A0A0A0] hover:bg-white/10 transition-colors"
              >
                +{hidden.length}
              </button>
              {open && (
                <div className="absolute bottom-full left-0 z-20 mb-1 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-[#101010] p-2 shadow-xl">
                  {hidden.map(o => (
                    <span
                      key={o}
                      className="whitespace-nowrap rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-[#A0A0A0]"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DataCell>
    </div>
  )
}

// ── Claim button ──────────────────────────────────────────────────────────────

function ClaimButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [claimError, setClaimError] = useState<string | null>(null)

  function handleClaim() {
    setClaimError(null)
    startTransition(async () => {
      const result = await claimBoostAction(orderId)
      if (result.error) {
        setClaimError(result.error)
      } else {
        router.push(`/dashboard/boosts/${orderId}?chat=1`)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {claimError && (
        <p className="font-mono text-[10px] leading-snug text-red-400 max-w-[200px] text-right">
          {claimError}
        </p>
      )}
      <button
        onClick={handleClaim}
        disabled={pending}
        className="flex items-center justify-center rounded-md border border-white/[0.06] bg-[#202020] px-5 py-2.5 font-mono text-[14px] tracking-[-0.04em] text-[#D9D9D9] transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Claiming…' : 'Claim →'}
      </button>
    </div>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────

export function JobCard({ boost }: { boost: BoostDisplay }) {
  const endLabel = boost.endRank
    ? boost.targetRR != null
      ? `${boost.endRank} (${boost.targetRR}RR)`
      : boost.endRank
    : null

  return (
    <div className="flex w-full min-h-[220px] flex-col justify-between overflow-hidden rounded-md border-2 border-white/5 bg-[#0B0B0B] font-mono shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_2px_6px_2px_rgba(0,0,0,0.15)]">

      {/* Body */}
      <div>
        {/* Header */}
        <div className="flex flex-row items-center gap-4 px-5 pt-5 pb-0">
          {/* Game icon */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-red-500 shadow-md shadow-red-900/40">
            <Image
              src="/icons/valorant.png"
              alt={boost.game}
              fill
              className="object-cover"
            />
          </div>

          {/* Title + subtitle */}
          <div className="min-w-0 pt-1">
            <p className="flex flex-wrap items-center gap-x-1 font-mono text-[15px] leading-[20px] tracking-[-0.05em] text-[#D9D9D9]">
              <span>{boost.startRank ?? '—'}</span>
              <span>→</span>
              <span>{endLabel ?? (boost.wins ? `${boost.wins} Wins` : '—')}</span>
              {boost.server && (
                <>
                  <span className="text-[#555]">·</span>
                  <Globe className="inline-block h-3.5 w-3.5 shrink-0 text-[#6E6D6F]" />
                  <span>{boost.server}</span>
                </>
              )}
            </p>
            <p className="mt-0.5 font-mono text-[11px] leading-[15px] tracking-[-0.04em] text-[#6E6D6F]">
              {boost.game} · {boost.service} · {boost.shortId}
            </p>
          </div>
        </div>

        {/* Data grid */}
        <OptionsGrid boost={boost} />
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-row items-center justify-between border-t border-white/5 bg-[#101010] px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-[6px]">
            <span className="font-mono text-[28px] leading-none tracking-[-0.06em] text-[#AAAAAA]">
              ${boost.payout.toFixed(2)}
            </span>
            <span className="font-mono text-[14px] leading-none tracking-[-0.04em] text-[#AAAAAA]">
              USD
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#4a4a4a]">{boost.postedAt}</span>
        </div>
        <ClaimButton orderId={boost.id} />
      </div>
    </div>
  )
}

// ── RankCell re-export (used by the lock screen in page.tsx if needed) ─────────
export { RankCell }
