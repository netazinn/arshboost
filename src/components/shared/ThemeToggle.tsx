'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111] transition-all duration-200 ease-in-out"
      />
    )
  }

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111] text-[#6e6d6f] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white"
    >
      {theme === 'dark' ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
    </button>
  )
}
