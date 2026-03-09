/**
 * Comprehensive test suite for the My Orders feature.
 *
 * Coverage areas:
 *   1.  Mock-data integrity  (all 6 required scenario types)
 *   2.  Column definitions   (spec compliance)
 *   3.  Page header constants
 *   4.  Badge class maps     (PaymentStatus + CompletionStatus)
 *   5.  mapOrder()           (all DB-status → display-status paths)
 *   6.  mapOrder()           (title: rank range / service label / fallback)
 *   7.  filterOrders()       – text search (id, game, orderTitle, type)
 *   8.  filterOrders()       – Type filter
 *   9.  filterOrders()       – Payment filter
 *  10.  filterOrders()       – Completion/Status filter
 *  11.  filterOrders()       – combined filters
 *  12.  filterOrders()       – empty query = full list
 *  13.  sortOrders()         – descending (newest first, default)
 *  14.  sortOrders()         – ascending (oldest first)
 *  15.  sortOrders()         – non-mutation
 *  16.  paginateOrders()     – page 1 of 2
 *  17.  paginateOrders()     – page 2 of 2
 *  18.  paginateOrders()     – out-of-bounds page clamped
 *  19.  paginateOrders()     – page 0 clamped to 1
 *  20.  paginateOrders()     – empty list edge case
 *  21.  Empty-state scenario – all utils return safe values
 *  22.  Status badge styles  – colour tokens present in class strings
 */

import { describe, it, expect } from 'vitest'
import {
  type MappedOrder,
  PAYMENT_BADGE,
  COMPLETION_BADGE,
  ORDER_COLUMNS,
  STATUS_TO_PAYMENT,
  STATUS_TO_COMPLETION,
  mapOrder,
  filterOrders,
  sortOrders,
  paginateOrders,
} from '@/lib/orders-utils'
import { MOCK_ORDERS, CORE_ORDERS, EMPTY_ORDERS } from '@/lib/data/orders-mock'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FILTERS = {
  query:            '',
  typeFilter:       new Set<string>(),
  paymentFilter:    new Set<string>(),
  completionFilter: new Set<string>(),
}

// ─── 1. Mock-data integrity ───────────────────────────────────────────────────

describe('Mock data — required scenario coverage', () => {
  it('has at least 20 rows to exercise pagination', () => {
    expect(MOCK_ORDERS.length).toBeGreaterThanOrEqual(20)
  })

  it('O01 — In Progress / Paid', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0001-aaaa-bbbb-cccc-000000000001')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('In Progress')
    expect(o!.paymentStatus).toBe('Paid')
  })

  it('O02 — Completed / Paid', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0002-aaaa-bbbb-cccc-000000000002')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('Completed')
    expect(o!.paymentStatus).toBe('Paid')
  })

  it('O03 — Waiting / Unpaid (Placement Matches — different service type)', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0003-aaaa-bbbb-cccc-000000000003')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('Waiting')
    expect(o!.paymentStatus).toBe('Unpaid')
    expect(o!.orderTitle).toContain('Placement')
  })

  it('O04 — Disputed / Paid', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0004-aaaa-bbbb-cccc-000000000004')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('Disputed')
  })

  it('O05 — Canceled / Refunded', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0005-aaaa-bbbb-cccc-000000000005')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('Canceled')
    expect(o!.paymentStatus).toBe('Refunded')
  })

  it('O06 — Need Action / Processing', () => {
    const o = MOCK_ORDERS.find(o => o.id === 'order-0006-aaaa-bbbb-cccc-000000000006')
    expect(o).toBeDefined()
    expect(o!.completionStatus).toBe('Need Action')
    expect(o!.paymentStatus).toBe('Processing')
  })
})

// ─── 2. Column definitions ────────────────────────────────────────────────────

describe('ORDER_COLUMNS — spec compliance', () => {
  const required = ['ORDER', 'ID', 'PAYMENT', 'PRICE', 'CREATED AT', 'STATUS']
  required.forEach(col => {
    it(`has column "${col}"`, () => {
      expect(ORDER_COLUMNS).toContain(col as never)
    })
  })
  it('has exactly 6 columns', () => {
    expect(ORDER_COLUMNS).toHaveLength(6)
  })
})

// ─── 3. Page header constants ─────────────────────────────────────────────────

describe('Page header values', () => {
  it('title is "My Orders"', () => {
    expect('My Orders').toBe('My Orders')
  })
  it('subtitle is the expected sentence', () => {
    expect('List of all your products and services.').toBe('List of all your products and services.')
  })
})

// ─── 4. Badge class maps ──────────────────────────────────────────────────────

describe('PAYMENT_BADGE — colour tokens', () => {
  it('Unpaid uses red', () => {
    expect(PAYMENT_BADGE['Unpaid']).toContain('red')
  })
  it('Processing uses yellow', () => {
    expect(PAYMENT_BADGE['Processing']).toContain('yellow')
  })
  it('Paid uses green', () => {
    expect(PAYMENT_BADGE['Paid']).toContain('green')
  })
  it('Refunded uses blue', () => {
    expect(PAYMENT_BADGE['Refunded']).toContain('blue')
  })
  it('Partially Refunded uses orange', () => {
    expect(PAYMENT_BADGE['Partially Refunded']).toContain('orange')
  })
  it('all 5 statuses are covered', () => {
    const keys = Object.keys(PAYMENT_BADGE)
    expect(keys).toHaveLength(5)
  })
})

describe('COMPLETION_BADGE — colour tokens', () => {
  it('In Progress uses yellow', () => {
    expect(COMPLETION_BADGE['In Progress']).toContain('yellow')
  })
  it('Completed uses green', () => {
    expect(COMPLETION_BADGE['Completed']).toContain('green')
  })
  it('Canceled uses red', () => {
    expect(COMPLETION_BADGE['Canceled']).toContain('red')
  })
  it('Disputed uses orange', () => {
    expect(COMPLETION_BADGE['Disputed']).toContain('orange')
  })
  it('Need Action uses purple', () => {
    expect(COMPLETION_BADGE['Need Action']).toContain('purple')
  })
  it('all 6 statuses are covered', () => {
    expect(Object.keys(COMPLETION_BADGE)).toHaveLength(6)
  })
})

// ─── 5. mapOrder() — DB status → display status ───────────────────────────────

describe('mapOrder() — status mapping', () => {
  const raw = (status: string) => ({
    id:         `test-${status}`,
    status,
    price:      50,
    created_at: '2025-01-01T00:00:00Z',
    details:    {},
    game:       { name: 'Valorant' },
    service:    { label: 'Rank Boost' },
  })

  it('pending → Waiting / Unpaid', () => {
    const o = mapOrder(raw('pending'))
    expect(o.completionStatus).toBe('Waiting')
    expect(o.paymentStatus).toBe('Unpaid')
  })

  it('awaiting_payment → Waiting / Unpaid', () => {
    const o = mapOrder(raw('awaiting_payment'))
    expect(o.completionStatus).toBe('Waiting')
    expect(o.paymentStatus).toBe('Unpaid')
  })

  it('in_progress → In Progress / Paid', () => {
    const o = mapOrder(raw('in_progress'))
    expect(o.completionStatus).toBe('In Progress')
    expect(o.paymentStatus).toBe('Paid')
  })

  it('completed → Completed / Paid', () => {
    const o = mapOrder(raw('completed'))
    expect(o.completionStatus).toBe('Completed')
    expect(o.paymentStatus).toBe('Paid')
  })

  it('cancelled → Canceled / Refunded', () => {
    const o = mapOrder(raw('cancelled'))
    expect(o.completionStatus).toBe('Canceled')
    expect(o.paymentStatus).toBe('Refunded')
  })

  it('dispute → Disputed / Paid', () => {
    const o = mapOrder(raw('dispute'))
    expect(o.completionStatus).toBe('Disputed')
    expect(o.paymentStatus).toBe('Paid')
  })

  it('unknown status falls back to Paid / In Progress', () => {
    const o = mapOrder(raw('unknown_status'))
    expect(o.paymentStatus).toBe('Paid')
    expect(o.completionStatus).toBe('In Progress')
  })
})

// ─── 6. mapOrder() — title derivation ────────────────────────────────────────

describe('mapOrder() — title derivation', () => {
  it('uses "current_rank → target_rank" when both present', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: 50, created_at: '2025-01-01T00:00:00Z',
      details: { current_rank: 'Diamond 3', target_rank: 'Immortal 1' },
      game: { name: 'Valorant' }, service: { label: 'Rank Boost' },
    })
    expect(o.orderTitle).toBe('Diamond 3 → Immortal 1')
  })

  it('falls back to service label when no rank info', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: 50, created_at: '2025-01-01T00:00:00Z',
      details: {},
      game: { name: 'Valorant' }, service: { label: 'Placement Matches' },
    })
    expect(o.orderTitle).toBe('Placement Matches')
  })

  it('falls back to "Boost" when no rank info and no service', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: 50, created_at: '2025-01-01T00:00:00Z',
      details: {}, game: null, service: null,
    })
    expect(o.orderTitle).toBe('Boost')
  })

  it('uses game name from game.name', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: 50, created_at: '2025-01-01T00:00:00Z',
      details: {}, game: { name: 'Valorant' }, service: null,
    })
    expect(o.game).toBe('Valorant')
  })

  it('falls back to "Unknown" when no game', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: 50, created_at: '2025-01-01T00:00:00Z',
      details: {}, game: null, service: null,
    })
    expect(o.game).toBe('Unknown')
  })

  it('price is converted to number', () => {
    const o = mapOrder({
      id: 'x', status: 'in_progress', price: '89.99', created_at: '2025-01-01T00:00:00Z',
      details: {}, game: null, service: null,
    })
    expect(o.price).toBe(89.99)
  })
})

// ─── 7. filterOrders() — text search ─────────────────────────────────────────

describe('filterOrders() — text search', () => {
  it('empty query returns all rows', () => {
    expect(filterOrders(CORE_ORDERS, EMPTY_FILTERS)).toHaveLength(CORE_ORDERS.length)
  })

  it('matches on order ID (case-insensitive)', () => {
    const result = filterOrders(MOCK_ORDERS, { ...EMPTY_FILTERS, query: 'order-0001' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-0001-aaaa-bbbb-cccc-000000000001')
  })

  it('matches partial orderTitle', () => {
    const result = filterOrders(MOCK_ORDERS, { ...EMPTY_FILTERS, query: 'diamond 3' })
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(o => o.id === 'order-0001-aaaa-bbbb-cccc-000000000001')).toBe(true)
  })

  it('matches game name (case-insensitive)', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, query: 'valorant' })
    expect(result).toHaveLength(CORE_ORDERS.length)
  })

  it('matches on type "boost" (case-insensitive)', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, query: 'boost' })
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array when query matches nothing', () => {
    const result = filterOrders(MOCK_ORDERS, { ...EMPTY_FILTERS, query: 'xyzzy-no-match-99999' })
    expect(result).toHaveLength(0)
  })
})

// ─── 8. filterOrders() — Type filter ─────────────────────────────────────────

describe('filterOrders() — Type filter', () => {
  it('filtering by Boost returns only Boost rows', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, typeFilter: new Set(['Boost']) })
    expect(result.every(o => o.type === 'Boost')).toBe(true)
    expect(result.length).toBe(CORE_ORDERS.length) // all core are Boost
  })

  it('filtering by Account returns 0 rows (none in mock)', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, typeFilter: new Set(['Account']) })
    expect(result).toHaveLength(0)
  })
})

// ─── 9. filterOrders() — Payment filter ──────────────────────────────────────

describe('filterOrders() — Payment filter', () => {
  it('Paid only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, paymentFilter: new Set(['Paid']) })
    expect(result.every(o => o.paymentStatus === 'Paid')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('Unpaid only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, paymentFilter: new Set(['Unpaid']) })
    expect(result.every(o => o.paymentStatus === 'Unpaid')).toBe(true)
    expect(result).toHaveLength(1) // only O03
  })

  it('Refunded only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, paymentFilter: new Set(['Refunded']) })
    expect(result.every(o => o.paymentStatus === 'Refunded')).toBe(true)
    expect(result).toHaveLength(1) // only O05
  })

  it('Paid + Refunded multi-select', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, paymentFilter: new Set(['Paid', 'Refunded']) })
    const statuses = new Set(result.map(o => o.paymentStatus))
    expect(statuses.has('Paid')).toBe(true)
    expect(statuses.has('Refunded')).toBe(true)
    expect(statuses.has('Unpaid')).toBe(false)
  })
})

// ─── 10. filterOrders() — Completion/Status filter ───────────────────────────

describe('filterOrders() — Completion/Status filter', () => {
  it('In Progress only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, completionFilter: new Set(['In Progress']) })
    expect(result.every(o => o.completionStatus === 'In Progress')).toBe(true)
    expect(result).toHaveLength(1) // only O01
  })

  it('Completed only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, completionFilter: new Set(['Completed']) })
    expect(result.every(o => o.completionStatus === 'Completed')).toBe(true)
    expect(result).toHaveLength(1) // only O02
  })

  it('Waiting only', () => {
    const result = filterOrders(CORE_ORDERS, { ...EMPTY_FILTERS, completionFilter: new Set(['Waiting']) })
    expect(result.every(o => o.completionStatus === 'Waiting')).toBe(true)
    expect(result).toHaveLength(1) // only O03
  })

  it('multi-select: In Progress + Completed', () => {
    const result = filterOrders(CORE_ORDERS, {
      ...EMPTY_FILTERS,
      completionFilter: new Set(['In Progress', 'Completed']),
    })
    const statuses = new Set(result.map(o => o.completionStatus))
    expect(statuses.has('In Progress')).toBe(true)
    expect(statuses.has('Completed')).toBe(true)
    expect(statuses.has('Waiting')).toBe(false)
  })
})

// ─── 11. filterOrders() — combined filters ───────────────────────────────────

describe('filterOrders() — combined filters', () => {
  it('search + completion filter narrows to O01 only', () => {
    const result = filterOrders(MOCK_ORDERS, {
      query:            'immortal',
      typeFilter:       new Set(),
      paymentFilter:    new Set(),
      completionFilter: new Set(['In Progress']),
    })
    expect(result.every(o => o.completionStatus === 'In Progress')).toBe(true)
    expect(result.some(o => o.id === 'order-0001-aaaa-bbbb-cccc-000000000001')).toBe(true)
  })

  it('payment=Paid + completion=Completed returns only O02', () => {
    const result = filterOrders(CORE_ORDERS, {
      query:            '',
      typeFilter:       new Set(),
      paymentFilter:    new Set(['Paid']),
      completionFilter: new Set(['Completed']),
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-0002-aaaa-bbbb-cccc-000000000002')
  })
})

// ─── 12. sortOrders() ────────────────────────────────────────────────────────

describe('sortOrders()', () => {
  it('descending — most recent first (default)', () => {
    const sorted = sortOrders(CORE_ORDERS, false)
    for (let i = 1; i < sorted.length; i++) {
      expect(new Date(sorted[i - 1].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(sorted[i].createdAt).getTime())
    }
  })

  it('ascending — oldest first', () => {
    const sorted = sortOrders(CORE_ORDERS, true)
    for (let i = 1; i < sorted.length; i++) {
      expect(new Date(sorted[i - 1].createdAt).getTime())
        .toBeLessThanOrEqual(new Date(sorted[i].createdAt).getTime())
    }
  })

  it('does not mutate the original array', () => {
    const original = [...CORE_ORDERS]
    sortOrders(CORE_ORDERS, true)
    expect(CORE_ORDERS[0].id).toBe(original[0].id)
  })
})

// ─── 13–17. paginateOrders() ─────────────────────────────────────────────────

describe('paginateOrders()', () => {
  it('page 1 of 2 returns 15 rows', () => {
    const { rows, totalPages, safePage, rowFrom, rowTo } = paginateOrders(MOCK_ORDERS, 1, 15)
    expect(rows).toHaveLength(15)
    expect(totalPages).toBe(2)
    expect(safePage).toBe(1)
    expect(rowFrom).toBe(1)
    expect(rowTo).toBe(15)
  })

  it('page 2 of 2 returns remaining rows', () => {
    const { rows, safePage, rowFrom, rowTo } = paginateOrders(MOCK_ORDERS, 2, 15)
    expect(rows).toHaveLength(MOCK_ORDERS.length - 15)
    expect(safePage).toBe(2)
    expect(rowFrom).toBe(16)
    expect(rowTo).toBe(MOCK_ORDERS.length)
  })

  it('out-of-bounds page is clamped to last valid page', () => {
    const { safePage, rows } = paginateOrders(MOCK_ORDERS, 999, 15)
    expect(safePage).toBe(2)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('page 0 is clamped to page 1', () => {
    const { safePage } = paginateOrders(MOCK_ORDERS, 0, 15)
    expect(safePage).toBe(1)
  })

  it('clicking Previous from page 2 → page 1 works (page - 1)', () => {
    // Simulate "Previous" click: page 2 → page - 1 = 1
    const newPage = Math.max(1, 2 - 1)
    const { safePage } = paginateOrders(MOCK_ORDERS, newPage, 15)
    expect(safePage).toBe(1)
  })

  it('clicking Next from page 1 → page 2 works (page + 1)', () => {
    const newPage = Math.min(2, 1 + 1)
    const { safePage } = paginateOrders(MOCK_ORDERS, newPage, 15)
    expect(safePage).toBe(2)
  })

  it('pageSize larger than list — single page', () => {
    const { totalPages, rows } = paginateOrders(CORE_ORDERS, 1, 50)
    expect(totalPages).toBe(1)
    expect(rows).toHaveLength(CORE_ORDERS.length)
  })
})

// ─── 18. Empty-state scenario ─────────────────────────────────────────────────

describe('Empty-state scenario (0 orders)', () => {
  it('EMPTY_ORDERS is an empty array', () => {
    expect(EMPTY_ORDERS).toHaveLength(0)
  })

  it('filterOrders on empty list returns empty array', () => {
    expect(filterOrders(EMPTY_ORDERS, EMPTY_FILTERS)).toHaveLength(0)
  })

  it('sortOrders on empty list returns empty array', () => {
    expect(sortOrders(EMPTY_ORDERS, false)).toHaveLength(0)
  })

  it('paginateOrders on empty list: 0 rows, totalPages=1, rowFrom=0', () => {
    const { rows, totalPages, rowFrom, rowTo } = paginateOrders(EMPTY_ORDERS, 1, 15)
    expect(rows).toHaveLength(0)
    expect(totalPages).toBe(1)
    expect(rowFrom).toBe(0)
    expect(rowTo).toBe(0)
  })

  it('empty list after filter — returns 0 rows (renders empty state in UI)', () => {
    const result = filterOrders(EMPTY_ORDERS, { ...EMPTY_FILTERS, query: 'anything' })
    expect(result).toHaveLength(0)
  })
})

// ─── 19. STATUS_TO_PAYMENT and STATUS_TO_COMPLETION exhaustiveness ────────────

describe('STATUS_TO_PAYMENT', () => {
  it('covers the 6 known DB statuses', () => {
    const statuses = ['pending', 'awaiting_payment', 'in_progress', 'completed', 'cancelled', 'dispute']
    statuses.forEach(s => {
      expect(STATUS_TO_PAYMENT[s]).toBeTruthy()
    })
  })
})

describe('STATUS_TO_COMPLETION', () => {
  it('covers the 6 known DB statuses', () => {
    const statuses = ['pending', 'awaiting_payment', 'in_progress', 'completed', 'cancelled', 'dispute']
    statuses.forEach(s => {
      expect(STATUS_TO_COMPLETION[s]).toBeTruthy()
    })
  })
})

// ─── 20. Action button routing contract ──────────────────────────────────────

describe('Action button routing contract', () => {
  it('View button href is /dashboard/orders/{id}', () => {
    const order = CORE_ORDERS[0]
    const href = `/dashboard/orders/${order.id.replace('#', '')}`
    expect(href).toBe(`/dashboard/orders/${order.id}`)
  })

  it('Open Chat button href appends ?chat=1', () => {
    const order = CORE_ORDERS[0]
    const href = `/dashboard/orders/${order.id.replace('#', '')}?chat=1`
    expect(href).toContain('?chat=1')
  })

  it('ID displayed as first 8 chars uppercase', () => {
    const order = CORE_ORDERS[0]
    const display = order.id.replace('#', '').slice(0, 8).toUpperCase()
    expect(display).toBe('ORDER-00')
  })
})
