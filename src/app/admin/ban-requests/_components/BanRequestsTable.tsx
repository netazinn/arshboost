'use client'

import React, { useState } from 'react'
import { resolveBanRequest, type BanRequest } from '@/lib/actions/ban-requests'
import { Loader2, CheckCircle2, XCircle, ShieldAlert, ShieldOff, Clock } from 'lucide-react'
import { clsx } from 'clsx'

interface Props {
  requests: BanRequest[]
}

const ACTION_BADGE = {
  ban:   { label: 'Ban',   className: 'bg-red-500/10 text-red-400 border-red-500/30'   },
  unban: { label: 'Unban', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
}

const STATUS_BADGE = {
  pending:  { label: 'Pending',  className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/10 text-green-400 border-green-500/30'   },
  rejected: { label: 'Rejected', className: 'bg-zinc-800 text-zinc-400 border-zinc-700'             },
}

function Badge({ scheme }: { scheme: keyof typeof ACTION_BADGE | keyof typeof STATUS_BADGE; type: 'action' | 'status' }) {
  // intentionally unused — use specific helpers below
  return null
}

export function BanRequestsTable({ requests }: Props) {
  const [resolving, setResolving] = useState<string | null>(null)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  async function handleResolve(id: string, approve: boolean) {
    setResolving(id)
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    const res = await resolveBanRequest(id, approve)
    if (res.error) setErrors(prev => ({ ...prev, [id]: res.error! }))
    setResolving(null)
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ShieldAlert size={32} strokeWidth={1.5} className="text-[#3a3a3a]" />
        <p className="font-mono text-[11px] tracking-[-0.04em] text-[#4a4a4a]">No requests found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {['Target User', 'Action', 'Reason', 'Requested By', 'Date', 'Status', ''].map(h => (
              <th
                key={h}
                className="border-b border-[#1a1a1a] px-4 py-3 text-left font-mono text-[10px] font-bold tracking-widest text-[#4a4a4a] uppercase first:pl-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map(req => {
            const actionBadge = ACTION_BADGE[req.action]
            const statusBadge = STATUS_BADGE[req.status]
            const isPending   = req.status === 'pending'
            const isResolving = resolving === req.id

            return (
              <tr key={req.id} className="group">
                {/* Target */}
                <td className="border-b border-[#111] px-4 py-3 first:pl-0">
                  <div className="flex items-center gap-2">
                    {req.action === 'ban'
                      ? <ShieldOff  size={13} strokeWidth={1.5} className="shrink-0 text-red-400/60"  />
                      : <ShieldAlert size={13} strokeWidth={1.5} className="shrink-0 text-blue-400/60" />
                    }
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-white">
                        {req.target?.username ?? '—'}
                      </p>
                      <p className="font-mono text-[9px] tracking-[-0.02em] text-[#4a4a4a]">
                        {req.target?.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Action badge */}
                <td className="border-b border-[#111] px-4 py-3">
                  <span className={clsx(
                    'inline-block rounded border px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest uppercase',
                    actionBadge.className,
                  )}>
                    {actionBadge.label}
                  </span>
                </td>

                {/* Reason */}
                <td className="border-b border-[#111] px-4 py-3 max-w-[220px]">
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-[#b0b0b0] line-clamp-2" title={req.reason ?? ''}>
                    {req.reason ?? <span className="text-[#4a4a4a]">—</span>}
                  </p>
                </td>

                {/* Requester */}
                <td className="border-b border-[#111] px-4 py-3">
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-[#7a7a7a]">
                    {req.requester?.username ?? req.requester?.email ?? '—'}
                  </p>
                </td>

                {/* Date */}
                <td className="border-b border-[#111] px-4 py-3">
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-[#5a5a5a]">
                    {new Date(req.created_at).toLocaleDateString('en-GB', {
                      day:   '2-digit',
                      month: 'short',
                      year:  'numeric',
                    })}
                  </p>
                </td>

                {/* Status */}
                <td className="border-b border-[#111] px-4 py-3">
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest uppercase',
                    statusBadge.className,
                  )}>
                    {req.status === 'pending' && <Clock size={9} strokeWidth={2.5} />}
                    {req.status === 'approved' && <CheckCircle2 size={9} strokeWidth={2.5} />}
                    {req.status === 'rejected' && <XCircle size={9} strokeWidth={2.5} />}
                    {statusBadge.label}
                  </span>
                </td>

                {/* Actions */}
                <td className="border-b border-[#111] px-4 py-3">
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolve(req.id, true)}
                        disabled={isResolving}
                        className="inline-flex items-center gap-1.5 rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[-0.04em] text-green-400 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isResolving ? <Loader2 size={10} strokeWidth={2} className="animate-spin" /> : <CheckCircle2 size={10} strokeWidth={2} />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, false)}
                        disabled={isResolving}
                        className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[-0.04em] text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isResolving ? <Loader2 size={10} strokeWidth={2} className="animate-spin" /> : <XCircle size={10} strokeWidth={2} />}
                        Reject
                      </button>
                      {errors[req.id] && (
                        <p className="font-mono text-[9px] text-red-400">{errors[req.id]}</p>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-[#3a3a3a]">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
