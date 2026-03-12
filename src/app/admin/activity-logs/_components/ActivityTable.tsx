'use client'

import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ActivityLog } from './types'

// ─── Action badge config ──────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, string> = {
  'user.banned':                      'border-red-500/30 bg-red-500/10 text-red-400',
  'user.unbanned':                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'user.role.changed':                'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  'withdrawal.approved':              'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'withdrawal.rejected':              'border-red-500/30 bg-red-500/10 text-red-400',
  'settings.financials.update':       'border-blue-500/30 bg-blue-500/10 text-blue-400',
  'settings.operations.update':       'border-blue-500/30 bg-blue-500/10 text-blue-400',
  'settings.communications.update':   'border-blue-500/30 bg-blue-500/10 text-blue-400',
}
const DEFAULT_ACTION_STYLE = 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]'

function actionLabel(action: string): string {
  const MAP: Record<string, string> = {
    'user.banned':                    'User Banned',
    'user.unbanned':                  'User Unbanned',
    'user.role.changed':              'Role Changed',
    'withdrawal.approved':            'Withdrawal Approved',
    'withdrawal.rejected':            'Withdrawal Rejected',
    'settings.financials.update':     'Financials Updated',
    'settings.operations.update':     'Operations Updated',
    'settings.communications.update': 'Comms Updated',
  }
  return MAP[action] ?? action
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityTableProps {
  logs: ActivityLog[]
}

export function ActivityTable({ logs }: ActivityTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#0f0f0f] bg-[#0a0a0a]">
          {['Admin', 'Action', 'Target', 'Date', ''].map((h) => (
            <th
              key={h}
              className="px-5 py-2.5 text-left font-mono text-[9px] font-semibold tracking-[0.05em] uppercase text-[#4a4a4a]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const isOpen = expandedId === log.id
          const adminDisplay = log.admin?.username ?? log.admin?.email ?? log.admin_id.slice(0, 8)
          return (
            <Fragment key={log.id}>
              <tr
                className="border-b border-[#0a0a0a] hover:bg-[#0d0d0d] transition-colors"
              >
                {/* Admin */}
                <td className="px-5 py-3">
                  <span className="font-mono text-[10px] font-semibold text-white tracking-[-0.04em]">
                    {adminDisplay}
                  </span>
                </td>

                {/* Action badge */}
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[9px] font-semibold tracking-[-0.02em] ${ACTION_STYLES[log.action_type] ?? DEFAULT_ACTION_STYLE}`}
                  >
                    {actionLabel(log.action_type)}
                  </span>
                </td>

                {/* Target */}
                <td className="px-5 py-3">
                  <span className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.04em]">
                    {log.target_id
                      ? log.target_id.length > 16
                        ? `#${log.target_id.slice(0, 8).toUpperCase()}`
                        : log.target_id
                      : '—'}
                  </span>
                </td>

                {/* Date */}
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.04em]">
                    {new Date(log.created_at).toLocaleString('en-US', {
                      month:  'short',
                      day:    'numeric',
                      hour:   '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </td>

                {/* Toggle */}
                <td className="px-5 py-3">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                    className="flex items-center gap-1 font-mono text-[9px] text-[#6e6d6f] hover:text-white transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown size={11} strokeWidth={2} />
                      : <ChevronRight size={11} strokeWidth={2} />
                    }
                    Details
                  </button>
                </td>
              </tr>

              {/* Expandable JSON row */}
              {isOpen && (
                <tr className="border-b border-[#0a0a0a] bg-[#070707]">
                  <td colSpan={5} className="px-5 py-4">
                    <pre className="font-mono text-[10px] text-[#9a9a9a] leading-relaxed tracking-[-0.02em] whitespace-pre-wrap break-all max-h-72 overflow-y-auto rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
