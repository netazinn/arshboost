'use client'

import { DollarSign, TrendingUp, Wallet, ShoppingCart } from 'lucide-react'

interface MetricCardsProps {
  totalVolume: number
  platformNetProfit: number
  pendingBoosterBalances: number
  totalCompletedOrders: number
}

const CARDS = [
  {
    key: 'totalVolume' as const,
    label: 'Total Volume',
    sub: 'Completed order revenue',
    icon: DollarSign,
    color: 'text-white',
    border: 'border-[#2a2a2a]',
    format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: 'platformNetProfit' as const,
    label: 'Platform Net Profit',
    sub: 'Fees collected by platform',
    icon: TrendingUp,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: 'pendingBoosterBalances' as const,
    label: 'Booster Balances',
    sub: 'Pending withdrawal pool',
    icon: Wallet,
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: 'totalCompletedOrders' as const,
    label: 'Completed Orders',
    sub: 'Approved / finished',
    icon: ShoppingCart,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    format: (v: number) => v.toLocaleString('en-US'),
  },
]

export function MetricCards(props: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map(({ key, label, sub, icon: Icon, color, border, format }) => (
        <div
          key={key}
          className={`rounded-xl border ${border} bg-[#0f0f0f] p-5 flex flex-col gap-3`}
        >
          <Icon size={18} strokeWidth={1.5} className={color} />
          <div>
            <p className={`font-mono text-2xl font-bold tracking-[-0.07em] ${color}`}>
              {format(props[key])}
            </p>
            <p className="font-mono text-[10px] font-semibold text-white/80 tracking-[-0.04em] mt-0.5">
              {label}
            </p>
            <p className="font-mono text-[9px] text-[#6e6d6f] tracking-[-0.03em] mt-0.5">
              {sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
