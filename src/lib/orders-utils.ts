/**
 * Pure, framework-agnostic utility functions for the My Orders feature.
 * All functions are tested via src/lib/__tests__/orders.test.ts
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus    = 'Unpaid' | 'Processing' | 'Paid' | 'Refunded' | 'Partially Refunded'
export type CompletionStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Canceled' | 'Disputed' | 'Need Action'
export type OrderType        = 'Boost' | 'Account'

export interface MappedOrder {
  id:               string
  game:             string
  type:             OrderType
  orderTitle:       string
  paymentStatus:    PaymentStatus
  completionStatus: CompletionStatus
  price:            number
  createdAt:        string
}

// ─── Badge class maps ─────────────────────────────────────────────────────────

export const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  'Unpaid':             'border border-red-500/40 text-red-400 bg-red-500/10',
  'Processing':         'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Paid':               'border border-green-500/40 text-green-400 bg-green-500/10',
  'Refunded':           'border border-blue-500/40 text-blue-400 bg-blue-500/10',
  'Partially Refunded': 'border border-orange-500/40 text-orange-400 bg-orange-500/10',
}

export const COMPLETION_BADGE: Record<CompletionStatus, string> = {
  'Waiting':     'border border-white/20 text-[#6e6d6f] bg-white/5',
  'In Progress': 'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Completed':   'border border-green-500/40 text-green-400 bg-green-500/10',
  'Canceled':    'border border-red-500/40 text-red-400 bg-red-500/10',
  'Disputed':    'border border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Need Action': 'border border-purple-500/40 text-purple-400 bg-purple-500/10',
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const ORDER_COLUMNS = ['ORDER', 'ID', 'PAYMENT', 'PRICE', 'CREATED AT', 'STATUS'] as const
export type OrderColumn = (typeof ORDER_COLUMNS)[number]

// ─── Order status → display status mapping ────────────────────────────────────

export const STATUS_TO_PAYMENT: Record<string, PaymentStatus> = {
  pending:          'Unpaid',
  awaiting_payment: 'Unpaid',
  in_progress:      'Paid',
  completed:        'Paid',
  cancelled:        'Refunded',
  dispute:          'Paid',
}

export const STATUS_TO_COMPLETION: Record<string, CompletionStatus> = {
  pending:          'Waiting',
  awaiting_payment: 'Waiting',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Canceled',
  dispute:          'Disputed',
}

// ─── Filtering ────────────────────────────────────────────────────────────────

export interface OrderFilters {
  query:            string
  typeFilter:       Set<string>
  paymentFilter:    Set<string>
  completionFilter: Set<string>
}

export function filterOrders(orders: MappedOrder[], filters: OrderFilters): MappedOrder[] {
  const q = filters.query.trim().toLowerCase()

  return orders.filter(o => {
    if (q) {
      const hit =
        o.id.toLowerCase().includes(q) ||
        o.game.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        o.orderTitle.toLowerCase().includes(q)
      if (!hit) return false
    }
    if (filters.typeFilter.size       && !filters.typeFilter.has(o.type))                  return false
    if (filters.paymentFilter.size    && !filters.paymentFilter.has(o.paymentStatus))      return false
    if (filters.completionFilter.size && !filters.completionFilter.has(o.completionStatus)) return false
    return true
  })
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export function sortOrders(orders: MappedOrder[], ascending: boolean): MappedOrder[] {
  return [...orders].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return ascending ? diff : -diff
  })
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface OrderPaginationResult {
  rows:       MappedOrder[]
  totalPages: number
  safePage:   number
  rowFrom:    number
  rowTo:      number
}

export function paginateOrders(
  orders: MappedOrder[],
  page: number,
  pageSize: number,
): OrderPaginationResult {
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const safePage   = Math.min(Math.max(1, page), totalPages)
  const sliceStart = (safePage - 1) * pageSize
  const sliceEnd   = sliceStart + pageSize
  return {
    rows:       orders.slice(sliceStart, sliceEnd),
    totalPages,
    safePage,
    rowFrom:    orders.length === 0 ? 0 : sliceStart + 1,
    rowTo:      Math.min(sliceEnd, orders.length),
  }
}

// ─── mapOrder (mirrors page.tsx logic, extracted for testability) ─────────────

interface RawOrderLike {
  id:          string
  status:      string
  price:       number | string
  created_at:  string
  details?:    Record<string, unknown> | null
  game?:       { name: string } | null
  service?:    { label: string } | null
}

export function mapOrder(o: RawOrderLike): MappedOrder {
  const d = (o.details ?? {}) as Record<string, unknown>
  const title =
    d.current_rank && d.target_rank
      ? `${d.current_rank} → ${d.target_rank}`
      : o.service?.label ?? 'Boost'

  return {
    id:               o.id,
    game:             o.game?.name ?? 'Unknown',
    type:             'Boost',
    orderTitle:       title,
    paymentStatus:    (STATUS_TO_PAYMENT[o.status]    ?? 'Paid')        as PaymentStatus,
    completionStatus: (STATUS_TO_COMPLETION[o.status] ?? 'In Progress') as CompletionStatus,
    price:            Number(o.price),
    createdAt:        o.created_at,
  }
}
