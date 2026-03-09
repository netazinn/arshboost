'use client'

import { useState, useRef, useEffect } from 'react'
import {
  CheckCircle2, XCircle, FileText, Upload, Loader2,
  ExternalLink, AlertTriangle, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { approveWithdrawal, rejectWithdrawal } from '@/lib/actions/admin'
import type { Withdrawal, WithdrawalStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_CLS: Record<WithdrawalStatus, string> = {
  pending:  'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  approved: 'border-green-500/30 bg-green-500/10 text-green-400',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-400',
}

// ─── Approve Modal ────────────────────────────────────────────────────────────

interface ApproveModalProps {
  withdrawal: Withdrawal
  reviewerId: string
  onClose: () => void
  onApproved: (id: string) => void
}

function ApproveModal({ withdrawal, reviewerId, onClose, onApproved }: ApproveModalProps) {
  const [txId, setTxId]         = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!txId.trim()) { setError('Transaction ID is required.'); return }
    if (!file)         { setError('Receipt PDF is required.'); return }
    if (file.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return }

    setUploading(true)
    setError(null)

    try {
      // 1. Upload PDF to Supabase storage
      const supabase = createClient()
      const storagePath = `${reviewerId}/${withdrawal.id}-${Date.now()}.pdf`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })

      if (uploadErr || !uploadData) throw new Error(uploadErr?.message ?? 'Upload failed')

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(uploadData.path)

      // 2. Approve the withdrawal with the file URL + transaction ID
      const { error: approveErr } = await approveWithdrawal({
        withdrawalId: withdrawal.id,
        transactionId: txId.trim(),
        receiptUrl: publicUrl,
      })
      if (approveErr) throw new Error(approveErr)

      onApproved(withdrawal.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e1e] px-6 py-4">
          <div>
            <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Approve Withdrawal</p>
            <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] mt-0.5">
              {withdrawal.booster?.username ?? withdrawal.booster?.email} — ${withdrawal.amount.toFixed(2)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#6e6d6f] hover:text-white transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {/* Transaction ID */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] uppercase">
              Transaction ID <span className="text-red-400">*</span>
            </label>
            <input
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              placeholder="e.g. TXN-20260307-ABCDEF"
              className="rounded-lg border border-[#2a2a2a] bg-[#111] px-3.5 py-2.5 font-mono text-xs tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none focus:border-[#4a4a4a] transition-colors"
            />
          </div>

          {/* PDF Upload */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] uppercase">
              Receipt (PDF) <span className="text-red-400">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3.5 py-2.5">
                <FileText size={14} strokeWidth={1.5} className="text-green-400 shrink-0" />
                <span className="font-mono text-[10px] tracking-[-0.04em] text-green-400 flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-[#6e6d6f] hover:text-white transition-colors shrink-0">
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-[#2a2a2a] bg-[#111] px-3.5 py-3 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] hover:border-[#4a4a4a] hover:text-[#9a9a9a] transition-colors"
              >
                <Upload size={13} strokeWidth={1.5} />
                Click to upload PDF receipt
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertTriangle size={12} strokeWidth={1.5} className="text-red-400 shrink-0" />
              <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-[#1e1e1e] px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#2a2a2a] px-4 py-2 font-mono text-xs tracking-[-0.05em] text-[#6e6d6f] hover:text-white hover:border-[#4a4a4a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 font-mono text-xs font-semibold tracking-[-0.05em] text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <CheckCircle2 size={12} strokeWidth={2} />}
            {uploading ? 'Processing…' : 'Approve & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({ withdrawal, onClose, onRejected }: {
  withdrawal: Withdrawal
  onClose: () => void
  onRejected: (id: string) => void
}) {
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleReject() {
    setLoading(true)
    const { error: err } = await rejectWithdrawal({ withdrawalId: withdrawal.id, notes })
    setLoading(false)
    if (err) { setError(err); return }
    onRejected(withdrawal.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] px-6 py-4">
          <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Reject Withdrawal</p>
          <button onClick={onClose} className="text-[#6e6d6f] hover:text-white transition-colors"><X size={16} strokeWidth={1.5} /></button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
            Rejecting ${withdrawal.amount.toFixed(2)} request from {withdrawal.booster?.username ?? withdrawal.booster?.email}
          </p>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for rejection (optional)..."
            rows={3}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3.5 py-2.5 font-mono text-xs tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none focus:border-[#4a4a4a] resize-none transition-colors"
          />
          {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 border-t border-[#1e1e1e] px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#2a2a2a] px-4 py-2 font-mono text-xs text-[#6e6d6f] hover:text-white hover:border-[#4a4a4a] transition-colors">Cancel</button>
          <button
            onClick={handleReject} disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-mono text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <XCircle size={12} strokeWidth={2} />}
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Table ───────────────────────────────────────────────────────────────

type Tab = WithdrawalStatus | 'all'

export function WithdrawalsTable({
  initialWithdrawals,
  reviewerId,
}: {
  initialWithdrawals: Withdrawal[]
  reviewerId: string
}) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(initialWithdrawals)
  const [tab, setTab]                 = useState<Tab>('pending')
  const [approveTarget, setApproveTarget] = useState<Withdrawal | null>(null)
  const [rejectTarget, setRejectTarget]   = useState<Withdrawal | null>(null)

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('admin:withdrawals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, async () => {
        const { data } = await supabase
          .from('withdrawals')
          .select(`*, booster:profiles!withdrawals_booster_id_fkey(id,username,email,avatar_url)`)
          .order('created_at', { ascending: false })
        if (data) setWithdrawals(data as Withdrawal[])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const filtered = tab === 'all'
    ? withdrawals
    : withdrawals.filter((w) => w.status === tab)

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'pending',  label: 'Pending',  count: withdrawals.filter((w) => w.status === 'pending').length },
    { id: 'approved', label: 'Approved', count: withdrawals.filter((w) => w.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: withdrawals.filter((w) => w.status === 'rejected').length },
    { id: 'all',      label: 'All',      count: withdrawals.length },
  ]

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1a1a1a] pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] tracking-[-0.05em] border-b-2 transition-colors ${
              tab === t.id
                ? 'border-white text-white'
                : 'border-transparent text-[#6e6d6f] hover:text-[#9a9a9a]'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${
                tab === t.id ? 'bg-white/10 text-white' : 'bg-[#1e1e1e] text-[#6e6d6f]'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText size={24} strokeWidth={1} className="text-[#2a2a2a]" />
            <p className="font-mono text-sm text-[#4a4a4a] tracking-[-0.05em]">No {tab !== 'all' ? tab : ''} requests</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                {['Booster', 'Amount', 'Status', 'Date', 'Transaction ID', 'Receipt', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[9px] font-semibold tracking-[0.05em] uppercase text-[#4a4a4a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="border-b border-[#0f0f0f] hover:bg-[#0d0d0d] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white">
                      {w.booster?.username ?? w.booster?.email ?? '—'}
                    </p>
                    <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] mt-0.5">
                      #{w.id.slice(0, 8).toUpperCase()}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[12px] font-semibold tracking-[-0.06em] text-white">
                      ${w.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${STATUS_CLS[w.status]}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                      {formatDate(w.created_at)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#c8c8c8]">
                      {w.transaction_id ?? <span className="text-[#3a3a3a]">—</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {w.receipt_url ? (
                      <a
                        href={w.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[-0.04em] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <FileText size={11} strokeWidth={1.5} /> View PDF
                        <ExternalLink size={9} strokeWidth={2} />
                      </a>
                    ) : (
                      <span className="font-mono text-[10px] text-[#3a3a3a]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {w.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setApproveTarget(w)}
                          className="flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[-0.03em] text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          <CheckCircle2 size={10} strokeWidth={2} /> Approve
                        </button>
                        <button
                          onClick={() => setRejectTarget(w)}
                          className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[-0.03em] text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle size={10} strokeWidth={2} /> Reject
                        </button>
                      </div>
                    )}
                    {w.status !== 'pending' && (
                      <span className="font-mono text-[9px] text-[#3a3a3a] tracking-[-0.03em]">
                        {w.status === 'approved' ? `By ${w.reviewer?.username ?? '—'}` : 'Rejected'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {approveTarget && (
        <ApproveModal
          withdrawal={approveTarget}
          reviewerId={reviewerId}
          onClose={() => setApproveTarget(null)}
          onApproved={(id) => {
            setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: 'approved' } : w))
            setApproveTarget(null)
          }}
        />
      )}
      {rejectTarget && (
        <RejectModal
          withdrawal={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={(id) => {
            setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: 'rejected' } : w))
            setRejectTarget(null)
          }}
        />
      )}
    </>
  )
}
