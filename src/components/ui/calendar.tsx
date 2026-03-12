'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// ─── Default year navigation range ───────────────────────────────────────────

const _now     = new Date()
const YEAR_MIN = new Date(_now.getFullYear() - 5, 0,  1)
const YEAR_MAX = new Date(_now.getFullYear() + 2, 11, 31)

// ─── Chevron for nav buttons AND dropdown triggers ────────────────────────────

function NavChevron({
  orientation,
  size,
  className,
}: {
  orientation?: 'up' | 'down' | 'left' | 'right'
  size?: number
  className?: string
  disabled?: boolean
}) {
  if (orientation === 'left')
    return <ChevronLeft  size={size ?? 13} strokeWidth={2} className={className} />
  if (orientation === 'down')
    return <ChevronDown  size={10}         strokeWidth={2.5} className={className} />
  return <ChevronRight size={size ?? 13} strokeWidth={2} className={className} />
}

// ─── Shared nav-button style ──────────────────────────────────────────────────

const NAV_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] ' +
  'bg-[#111111] text-[#6e6d6f] transition-colors duration-200 ' +
  'hover:border-[#6e6d6f] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'

// ─── Component ────────────────────────────────────────────────────────────────

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      navLayout="around"
      startMonth={YEAR_MIN}
      endMonth={YEAR_MAX}
      className={cn('p-4', className)}
      classNames={{
        // ── Layout ─────────────────────────────────────────────────────────
        // month is a 3-column grid: [prev-btn | caption | next-btn]
        //                          [   month_grid (col-span-full)   ]
        months:        'flex flex-col',
        month:         'grid grid-cols-[auto_1fr_auto] items-center gap-x-1',
        month_caption: 'col-start-2 row-start-1 flex items-center justify-center',
        month_grid:    'col-span-full mt-3 w-full border-collapse',

        // ── Dropdown triggers (month & year selects) ────────────────────
        // dropdown_root: the visible "button" (relative container)
        // dropdown:      the invisible native <select> overlaid on top
        // caption_label: the visible text + chevron inside the button
        dropdowns:     'flex items-center gap-1.5',
        dropdown_root: [
          'group relative flex h-7 items-center rounded-md',
          'border border-[#2a2a2a] bg-[#111111] px-2.5',
          'hover:border-[#6e6d6f] transition-colors duration-200 cursor-pointer',
        ].join(' '),
        dropdown: 'absolute inset-0 z-10 cursor-pointer opacity-0',
        caption_label: [
          'flex items-center gap-1.5 select-none pointer-events-none',
          'font-mono text-[11px] tracking-[-0.04em] text-[#a0a0a0]',
          'transition-colors duration-200 group-hover:text-white',
        ].join(' '),

        // ── Navigation buttons (placed by navLayout="around") ───────────
        button_previous: NAV_BTN + ' col-start-1 row-start-1',
        button_next:     NAV_BTN + ' col-start-3 row-start-1',

        // ── Weekday header ──────────────────────────────────────────────
        weekdays: 'flex',
        weekday: [
          'w-9 text-center font-mono text-[9px] font-semibold',
          'text-[#4a4a4a] uppercase tracking-[0.06em] pb-1',
        ].join(' '),

        // ── Day grid ────────────────────────────────────────────────────
        weeks:      'space-y-1 mt-1',
        week:       'flex w-full',
        day:        'relative p-0 flex-1 flex items-center justify-center',
        day_button: [
          'h-8 w-8 rounded-md font-mono text-[11px] tracking-[-0.04em] text-[#a0a0a0]',
          'transition-colors duration-200 hover:bg-[#1a1a1a] hover:text-white',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6e6d6f]',
        ].join(' '),

        // ── Day modifiers (applied to <td>, reach inner button via child selectors) ──
        selected: '[&>button]:bg-white [&>button]:text-[#0a0a0a] [&>button]:font-semibold [&>button:hover]:bg-white/90',
        today:    '[&>button:not([disabled])]:text-white [&>button:not([disabled])]:font-semibold',
        outside:  'opacity-30 [&>button]:pointer-events-none',
        disabled: 'opacity-30 pointer-events-none',
        hidden:   'invisible',
        ...classNames,
      }}
      components={{ Chevron: NavChevron }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'
export { Calendar }
