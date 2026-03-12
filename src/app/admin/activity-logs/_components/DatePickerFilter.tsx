'use client'

import * as React from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PopoverRoot, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

interface DatePickerFilterProps {
  value:       string   // 'YYYY-MM-DD' or ''
  onChange:    (iso: string) => void
  placeholder: string
  label:       string
}

export function DatePickerFilter({ value, onChange, placeholder, label }: DatePickerFilterProps) {
  const [open, setOpen] = React.useState(false)

  const selected: Date | undefined = React.useMemo(() => {
    if (!value) return undefined
    const d = parseISO(value)
    return isValid(d) ? d : undefined
  }, [value])

  function handleSelect(day: Date | undefined) {
    onChange(day ? format(day, 'yyyy-MM-dd') : '')
    if (day) setOpen(false)
  }

  return (
    <div className="flex items-center gap-1.5">
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={label}
          className={cn(
            'flex h-8 items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#111111] px-3',
            'font-mono text-[11px] tracking-[-0.04em] text-[#a0a0a0]',
            'transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6e6d6f]',
            selected && 'border-[#3a3a3a] text-white',
          )}
        >
          <CalendarIcon size={11} strokeWidth={2} className="shrink-0 text-[#6e6d6f]" />
          {selected
            ? format(selected, 'MMM d, yyyy')
            : <span className="text-[#3a3a3a]">{placeholder}</span>}
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            autoFocus
          />
        </PopoverContent>
      </PopoverRoot>

      {/* Per-field clear button — only visible when a date is selected */}
      {selected && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label}`}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111111] text-[#6e6d6f] transition-colors duration-200 hover:border-[#6e6d6f] hover:text-white"
        >
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
