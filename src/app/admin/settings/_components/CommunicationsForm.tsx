'use client'

import { useState, useTransition } from 'react'
import { updateCommunicationSettings } from '@/lib/actions/admin'

// ─── Color presets (must match GlobalBanner COLOR_MAP) ────────────────────────

const COLOR_PRESETS = [
  { key: 'amber',  label: 'Warning',  bg: '#fbbf24', text: '#451a03' },
  { key: 'green',  label: 'Success',  bg: '#22c55e', text: '#052e16' },
  { key: 'red',    label: 'Danger',   bg: '#ef4444', text: '#fff1f2' },
  { key: 'blue',   label: 'Info',     bg: '#3b82f6', text: '#eff6ff' },
  { key: 'purple', label: 'Notice',   bg: '#a855f7', text: '#faf5ff' },
  { key: 'slate',  label: 'Neutral',  bg: '#475569', text: '#f8fafc' },
] as const

type ColorKey = typeof COLOR_PRESETS[number]['key']

// ─── Inline Toast ─────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] rounded-lg border px-4 py-3 font-mono text-[11px] tracking-[-0.04em] shadow-2xl ${
        type === 'success'
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-white cursor-pointer">
          {label}
        </label>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          checked
            ? 'border-amber-500/60 bg-amber-500/20'
            : 'border-[#2a2a2a] bg-[#111]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-lg transition-transform duration-200 mt-0.5 ${
            checked ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-[#444]'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: ColorKey
  onChange: (key: ColorKey) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="block text-sm font-medium text-white">Banner Color</span>
      <p className="font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
        Controls the visual urgency of the banner.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onChange(preset.key)}
            style={{ backgroundColor: preset.bg }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
              value === preset.key
                ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#0a0a0a] scale-105'
                : 'opacity-70 hover:opacity-100'
            }`}
            aria-pressed={value === preset.key}
          >
            <span style={{ color: preset.text }}>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Communications Form ──────────────────────────────────────────────────────

interface CommunicationsFormProps {
  initialAnnouncementActive: boolean
  initialAnnouncementText: string
  initialAnnouncementColor: string
}

export function CommunicationsForm({
  initialAnnouncementActive,
  initialAnnouncementText,
  initialAnnouncementColor,
}: CommunicationsFormProps) {
  const [isActive,  setIsActive]  = useState(initialAnnouncementActive)
  const [text,      setText]      = useState(initialAnnouncementText)
  const [color,     setColor]     = useState<ColorKey>(
    (COLOR_PRESETS.find(p => p.key === initialAnnouncementColor)?.key ?? 'amber') as ColorKey
  )
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()

  const activePreset = COLOR_PRESETS.find(p => p.key === color) ?? COLOR_PRESETS[0]

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isActive && !text.trim())
      return showToast('Banner text cannot be empty when the banner is active.', 'error')
    if (text.length > 500)
      return showToast('Banner text must be 500 characters or fewer.', 'error')

    startTransition(async () => {
      const result = await updateCommunicationSettings({
        is_announcement_active: isActive,
        announcement_text:      text,
        announcement_color:     color,
      })
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        showToast('Communication settings saved.', 'success')
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Banner active toggle */}
        <ToggleRow
          id="is_announcement_active"
          label="Show Announcement Banner"
          description="Displays a sticky banner at the top of every page for all visitors."
          checked={isActive}
          onChange={setIsActive}
        />

        <div className="border-t border-[#1a1a1a]" />

        {/* Color picker */}
        <ColorPicker value={color} onChange={setColor} />

        <div className="border-t border-[#1a1a1a]" />

        {/* Banner text */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="announcement_text" className="block text-sm font-medium text-white">
            Banner Text
          </label>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[-0.04em]">
            The message shown inside the announcement banner. Max 500 characters.
          </p>
          <textarea
            id="announcement_text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. We are experiencing high demand. Response times may be delayed."
            className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-sm text-white placeholder-muted-foreground/40 focus:border-white/30 focus:outline-none focus:ring-0 transition-colors resize-none"
          />
          <p className="text-right font-mono text-[10px] text-muted-foreground/50">
            {text.length}/500
          </p>
        </div>

        {/* Live preview */}
        {text.trim() && (
          <>
            <div className="border-t border-[#1a1a1a]" />
            <div>
              <p className="mb-2 font-mono text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase">
                Live Preview
              </p>
              <div
                className="w-full rounded-md px-4 py-2.5 text-center"
                style={{ backgroundColor: activePreset.bg }}
              >
                <p
                  className="font-mono text-xs font-semibold tracking-[-0.03em]"
                  style={{ color: activePreset.text }}
                >
                  {text}
                </p>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-md bg-white px-5 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  )
}

