'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2, HelpCircle } from 'lucide-react'
import { submitDiscordVerification } from '@/lib/actions/verification'
import type { VerificationRecord } from '@/lib/actions/verification'

// ─── Validation ───────────────────────────────────────────────────────────────

const DISCORD_ID_REGEX = /^\d{17,19}$/

// ─── Component ────────────────────────────────────────────────────────────────

export function DiscordVerificationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (patch: Partial<VerificationRecord>) => void
}) {
  const [username,    setUsername]    = useState('')
  const [uniqueId,    setUniqueId]    = useState('')
  const [usernameErr, setUsernameErr] = useState<string | null>(null)
  const [idErr,       setIdErr]       = useState<string | null>(null)
  const [submitErr,   setSubmitErr]   = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  function validate(): boolean {
    let ok = true
    if (!username.trim()) {
      setUsernameErr('Discord username is required.'); ok = false
    } else {
      setUsernameErr(null)
    }
    if (!DISCORD_ID_REGEX.test(uniqueId.trim())) {
      setIdErr('Must be 17–19 digits (numbers only).'); ok = false
    } else {
      setIdErr(null)
    }
    return ok
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitErr(null)
    setLoading(true)
    const result = await submitDiscordVerification({
      discord_username:  username.trim(),
      discord_unique_id: uniqueId.trim(),
    })
    setLoading(false)
    if (result.error) {
      setSubmitErr(result.error)
    } else {
      onSuccess({ discord_username: username.trim(), discord_unique_id: uniqueId.trim() })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#111111] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
          <div>
            <p className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">Connect Discord</p>
            <p className="mt-0.5 font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
              Link your primary Discord account
            </p>
          </div>
          <button onClick={onClose} className="text-[#4a4a4a] transition-colors hover:text-white">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-6">

          {/* Why we need Unique ID */}
          <div className="flex items-start gap-2.5 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
            <HelpCircle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#6e6d6f]" />
            <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
              We require your <span className="text-white">Unique ID</span> (not just your username) to securely link
              your account regardless of future username changes. This ID never changes.
            </p>
          </div>

          {/* How to find Unique ID */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">How to find your Unique ID</p>
            <ol className="flex flex-col gap-1.5">
              {[
                'Open Discord Settings → Advanced',
                'Enable "Developer Mode"',
                'Right-click your username anywhere → "Copy User ID"',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-px shrink-0 font-mono text-[9px] font-bold text-[#6e6d6f]">{i + 1}.</span>
                  <span className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Discord Username */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
              Discord Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. johndoe"
              className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none placeholder:text-[#3a3a3a] transition-colors focus:border-[#6e6d6f]"
            />
            {usernameErr && <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{usernameErr}</p>}
          </div>

          {/* Discord Unique ID */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
              Unique ID <span className="text-[#4a4a4a]">(17–19 digits)</span>
            </label>
            <input
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value.replace(/\D/g, '').slice(0, 19))}
              placeholder="e.g. 123456789012345678"
              inputMode="numeric"
              className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none placeholder:text-[#3a3a3a] transition-colors focus:border-[#6e6d6f]"
            />
            {idErr && <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{idErr}</p>}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <AlertTriangle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0 text-yellow-400" />
            <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-yellow-400/80">
              You must connect your <span className="font-semibold text-yellow-400">primary</span> Discord account.
              This can only be linked <span className="font-semibold text-yellow-400">ONCE</span> and cannot be changed later.
            </p>
          </div>

          {submitErr && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <AlertTriangle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-400" />
              <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{submitErr}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#2a2a2a] px-6 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[#2a2a2a] px-4 font-mono text-[11px] tracking-[-0.05em] text-[#6e6d6f] transition-colors hover:border-[#6e6d6f] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-md bg-white px-5 font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90 disabled:opacity-50"
          >
            {loading && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
            Connect Discord
          </button>
        </div>

      </div>
    </div>
  )
}
