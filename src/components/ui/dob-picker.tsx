'use client'

import * as React from 'react'
import { format, parseISO, isValid, subYears } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PopoverRoot, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── Constants ────────────────────────────────────────────────────────────────

// User must be at least 18; the calendar won't allow more recent dates
const MAX_DOB = subYears(new Date(), 18)
const MIN_DOB = new Date(1950, 0, 1)

// ─── Component ────────────────────────────────────────────────────────────────

export interface DOBPickerProps {
  /** Controlled ISO date string: 'YYYY-MM-DD' or empty string */
  value:     string
  onChange:  (iso: string) => void
  /** Highlights the trigger border red (e.g. from RHF error state) */
  hasError?: boolean
}

export function DOBPicker({ value, onChange, hasError }: DOBPickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo<Date | undefined>(() => {
    if (!value) return undefined
    const d = parseISO(value)
    return isValid(d) ? d : undefined
  }, [value])

  function handleSelect(day: Date | undefined) {
    onChange(day ? format(day, 'yyyy-MM-dd') : '')
    if (day) setOpen(false)
  }

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select date of birth"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border bg-[#0a0a0a] px-3 text-left',
            'font-mono text-xs tracking-[-0.05em] outline-none',
            'transition-colors duration-200 ease-in-out',
            'hover:border-[#6e6d6f] focus-visible:border-[#6e6d6f]',
            hasError
              ? 'border-red-500 hover:border-red-400 focus-visible:border-red-400'
              : selected
                ? 'border-[#3a3a3a] text-white'
                : 'border-[#2a2a2a] text-[#3a3a3a]',
          )}
        >
          <CalendarIcon
            size={12}
            strokeWidth={1.5}
            className={cn('shrink-0', selected ? 'text-[#6e6d6f]' : 'text-[#3a3a3a]')}
          />
          {selected ? (
            <span className="text-white">{format(selected, 'MMMM d, yyyy')}</span>
          ) : (
            <span>Select date of birth</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0 z-[60]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          // Year range: 1950 → 18 years ago
          startMonth={MIN_DOB}
          endMonth={MAX_DOB}
          // Default view: 25 years ago so users don't land at 2008
          defaultMonth={selected ?? subYears(new Date(), 25)}
          // Disable today + anything less than 18 years ago
          disabled={[{ after: MAX_DOB }]}
          autoFocus
        />
      </PopoverContent>
    </PopoverRoot>
  )
}
