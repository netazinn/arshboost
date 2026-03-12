'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import type { GameRevenue } from '@/lib/actions/revenue'

interface RevenueByGameChartProps {
  data: GameRevenue[]
}

// Distinct accent colors per bar index — consistent with the dark theme
const BAR_COLORS = ['#ffffff', '#a3a3a3', '#737373', '#525252', '#404040']

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; payload?: GameRevenue }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const orders = payload[0].payload?.orders ?? 0
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] text-[#6e6d6f] tracking-[-0.03em]">{label}</p>
      <p className="font-mono text-sm font-bold text-white tracking-[-0.05em]">
        ${(payload[0].value ?? 0).toFixed(2)}
      </p>
      <p className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em] mt-0.5">
        {orders} order{orders !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function RevenueByGameChart({ data }: RevenueByGameChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 flex items-center justify-center h-48">
        <p className="font-mono text-[11px] text-[#4a4a4a]">No game revenue data yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-[#c8c8c8]">
          Revenue by Game
        </p>
        <p className="font-mono text-[10px] text-[#4a4a4a] tracking-[-0.04em] mt-0.5">
          Distribution across supported games
        </p>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1a1a1a"
              horizontal={false}
            />

            <XAxis
              type="number"
              tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#4a4a4a' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />

            <YAxis
              type="category"
              dataKey="game"
              tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#9a9a9a' }}
              tickLine={false}
              axisLine={false}
              width={80}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />

            <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
