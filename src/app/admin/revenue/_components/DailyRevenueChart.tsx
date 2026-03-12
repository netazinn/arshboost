'use client'

import { useId } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { DailyRevenue } from '@/lib/actions/revenue'

interface DailyRevenueChartProps {
  data: DailyRevenue[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.03em]">{label}</p>
      <p className="font-mono text-sm font-bold text-white tracking-[-0.05em]">
        ${(payload[0].value ?? 0).toFixed(2)}
      </p>
    </div>
  )
}

export function DailyRevenueChart({ data }: DailyRevenueChartProps) {
  const gradientId = useId()
  // Show only every ~5th label on x-axis to avoid crowding
  const tickInterval = Math.max(1, Math.floor(data.length / 6))

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-[#c8c8c8]">
          Daily Revenue
        </p>
        <p className="font-mono text-[10px] text-[#4a4a4a] tracking-[-0.04em] mt-0.5">
          Last 30 days — completed &amp; approved orders
        </p>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1a1a1a"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#4a4a4a' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />

            <YAxis
              tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#4a4a4a' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }} />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#ffffff"
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: '#ffffff', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
