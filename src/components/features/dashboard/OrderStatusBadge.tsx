import type { OrderStatus } from '@/types'

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:          'bg-[#2a2a2a] text-[#9ca3af]',
  awaiting_payment: 'bg-yellow-500/10 text-yellow-400',
  in_progress:      'bg-blue-500/10 text-blue-400',
  completed:        'bg-green-500/10 text-green-400',
  cancelled:        'bg-red-500/10 text-red-400',
  dispute:          'bg-orange-500/10 text-orange-400',
  support:          'bg-blue-500/10 text-blue-400',
  waiting_action:   'bg-purple-500/10 text-purple-400',
  cancel_requested: 'bg-red-500/10 text-red-300',
  approved:         'bg-emerald-500/10 text-emerald-400',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:          'Pending',
  awaiting_payment: 'Awaiting Payment',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Cancelled',
  dispute:          'Dispute',
  support:          'Support',
  waiting_action:   'Waiting Action',
  cancel_requested: 'Cancel Requested',
  approved:         'Approved',
}

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className = '' }: OrderStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] tracking-[-0.05em] ${STATUS_STYLES[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
