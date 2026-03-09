import type { LucideIcon } from 'lucide-react'

interface DashboardPageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle: string
}

export function DashboardPageHeader({ icon: Icon, title, subtitle }: DashboardPageHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Icon size={22} strokeWidth={1.5} className="text-white" />
      </div>
      <div>
        <h1 className="font-sans text-2xl font-semibold leading-tight tracking-[-0.07em] text-white">
          {title}
        </h1>
        <p className="mt-0.5 font-mono text-xs tracking-[-0.1em] text-[#6e6d6f]">
          {subtitle}
        </p>
      </div>
    </div>
  )
}
