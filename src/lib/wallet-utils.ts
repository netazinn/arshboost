/**
 * Pure, framework-agnostic utility functions for the My Wallet feature.
 * All functions are tested via src/lib/__tests__/wallet.test.ts
 */

import type { Transaction, TransactionStatus, PaymentMethod } from '@/types'

// ─── Label maps ───────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending:   'Pending',
  completed: 'Completed',
  failed:    'Failed',
  refunded:  'Refunded',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  card:    'Credit Card',
  paypal:  'PayPal',
  crypto:  'Crypto',
  balance: 'Balance',
  other:   'Other',
}

// ─── Column definitions ───────────────────────────────────────────────────────

/** Canonical list of table column header labels. Used in tests + table rendering. */
export const WALLET_COLUMNS = [
  'ORDER',
  'PAYMENT METHOD',
  'STATUS',
  'TRANSACTION ID',
  'AMOUNT',
  'DISCOUNT',
  'LAST UPDATED',
] as const

export type WalletColumn = (typeof WALLET_COLUMNS)[number]

// ─── Discount helpers ─────────────────────────────────────────────────────────

/** Returns true when the transaction has a non-zero discount. */
export function hasDiscount(tx: Transaction): boolean {
  return Number(tx.discount_amount) > 0
}

// ─── Title derivation ─────────────────────────────────────────────────────────

/**
 * Derive a human-readable order title from the linked order's details.
 * Preference: rank range > service label > order ID > generic fallback.
 */
export function deriveTitle(tx: Transaction): string {
  const d = (tx.order?.details ?? {}) as Record<string, unknown>
  if (d.current_rank && d.target_rank) return `${d.current_rank} → ${d.target_rank}`
  if (tx.order?.service?.label) return tx.order.service.label
  if (tx.order_id) return `Order #${tx.order_id.slice(0, 8).toUpperCase()}`
  return 'Transaction'
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface WalletStats {
  totalSpent:   number
  totalSavings: number
  pendingCount: number
  totalCount:   number
}

export function computeStats(transactions: Transaction[]): WalletStats {
  const completed = transactions.filter(t => t.status === 'completed')
  return {
    totalSpent:   completed.reduce((s, t) => s + Number(t.amount), 0),
    totalSavings: completed.reduce((s, t) => s + Number(t.discount_amount), 0),
    pendingCount: transactions.filter(t => t.status === 'pending').length,
    totalCount:   transactions.length,
  }
}

// ─── Filtering ────────────────────────────────────────────────────────────────

export interface WalletFilters {
  query:         string
  /** Set of STATUS_LABEL values, e.g. { 'Completed', 'Pending' } */
  statusFilter:  Set<string>
  /** Set of METHOD_LABEL values, e.g. { 'Credit Card' } */
  methodFilter:  Set<string>
}

export function filterTransactions(
  transactions: Transaction[],
  { query, statusFilter, methodFilter }: WalletFilters,
): Transaction[] {
  const q = query.trim().toLowerCase()

  return transactions.filter(t => {
    // ── text search ─────────────────────────────────────────────────────────
    if (q) {
      const title = deriveTitle(t)
      const hit =
        t.id.toLowerCase().includes(q) ||
        (t.order_id ?? '').toLowerCase().includes(q) ||
        title.toLowerCase().includes(q) ||
        (t.promo_code ?? '').toLowerCase().includes(q)
      if (!hit) return false
    }

    // ── status filter ────────────────────────────────────────────────────────
    if (statusFilter.size && !statusFilter.has(STATUS_LABEL[t.status])) return false

    // ── payment method filter ────────────────────────────────────────────────
    if (methodFilter.size && !methodFilter.has(METHOD_LABEL[t.payment_method])) return false

    return true
  })
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export function sortTransactions(
  transactions: Transaction[],
  ascending: boolean,
): Transaction[] {
  return [...transactions].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return ascending ? diff : -diff
  })
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationResult {
  rows:       Transaction[]
  totalPages: number
  safePage:   number
  rowFrom:    number
  rowTo:      number
}

export function paginateTransactions(
  transactions: Transaction[],
  page: number,
  pageSize: number,
): PaginationResult {
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))
  const safePage   = Math.min(Math.max(1, page), totalPages)
  const sliceStart = (safePage - 1) * pageSize
  const sliceEnd   = sliceStart + pageSize
  const rows       = transactions.slice(sliceStart, sliceEnd)
  return {
    rows,
    totalPages,
    safePage,
    rowFrom: transactions.length === 0 ? 0 : sliceStart + 1,
    rowTo:   Math.min(sliceEnd, transactions.length),
  }
}
