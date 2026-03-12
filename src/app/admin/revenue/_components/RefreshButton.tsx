'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className={clsx(
        'flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5',
        'font-mono text-[10px] font-semibold text-[#9a9a9a] tracking-[-0.03em]',
        'hover:border-white/20 hover:text-white transition-colors',
        isPending && 'opacity-50 cursor-not-allowed',
      )}
    >
      <RefreshCw size={11} strokeWidth={2} className={isPending ? 'animate-spin' : ''} />
      Refresh
    </button>
  )
}
