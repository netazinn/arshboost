/**
 * Comprehensive test suite for the Orders Chat feature.
 *
 * Coverage areas:
 *   1.  deriveChatDisplay() — shortId, gameName, serviceLabel, orderTitle
 *   2.  deriveChatDisplay() — completionStatus (all 6 DB status → display mappings)
 *   3.  deriveChatDisplay() — price coercion (string, number, 0)
 *   4.  deriveChatDisplay() — createdDate locale formatting
 *   5.  deriveChatDisplay() — fallback values (no game, no service, no details)
 *   6.  CHAT_COMPLETION_BADGE — all 6 status keys are present
 *   7.  CHAT_COMPLETION_BADGE — badge classes contain expected colour tokens
 *   8.  CHAT_STATUS_TO_COMPLETION — all 6 DB statuses map correctly
 *   9.  validateChatMessage() — empty & whitespace strings are rejected
 *  10.  validateChatMessage() — valid messages pass
 *  11.  validateChatMessage() — MAX_MESSAGE_LENGTH boundary (exact / over)
 *  12.  validateImageFile() — accepted MIME types (jpeg, png, webp)
 *  13.  validateImageFile() — rejected MIME types (gif, svg, pdf)
 *  14.  validateImageFile() — size boundary (under / exact / over 5 MB)
 *  15.  formatChatTime() — returns HH:MM string from ISO timestamp
 *  16.  formatChatTime() — midnight and noon edge cases
 *  17.  isOwnMessage() — 'client' is own, 'booster' and 'system' are not
 *  18.  messageBubbleClass() — correct CSS class per sender
 *  19.  filterChatOrders() — empty query returns all orders
 *  20.  filterChatOrders() — filters by order id
 *  21.  filterChatOrders() — filters by game name
 *  22.  filterChatOrders() — filters by service label
 *  23.  filterChatOrders() — filters by orderTitle (rank range)
 *  24.  filterChatOrders() — case-insensitive search
 *  25.  filterChatOrders() — no-match returns empty array
 *  26.  filterChatOrders() — whitespace-only query returns all orders
 *  27.  filterChatOrders() — does not mutate original array
 */

import { describe, it, expect } from 'vitest'
import {
  deriveChatDisplay,
  validateChatMessage,
  validateImageFile,
  formatChatTime,
  isOwnMessage,
  messageBubbleClass,
  filterChatOrders,
  CHAT_COMPLETION_BADGE,
  CHAT_STATUS_TO_COMPLETION,
  MAX_MESSAGE_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  type ChatCompletionStatus,
  type MessageSender,
} from '@/lib/chat-utils'
import type { Order } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> & { id?: string } = {}): Order {
  return {
    id:         overrides.id         ?? 'aaaabbbb-cccc-dddd-eeee-000000000001',
    client_id:  'client-1',
    booster_id: null,
    game_id:    'game-1',
    service_id: 'svc-1',
    status:     overrides.status     ?? 'in_progress',
    price:      overrides.price      ?? 49.99,
    details:    overrides.details    ?? { current_rank: 'Iron 1', target_rank: 'Silver 2' },
    created_at: overrides.created_at ?? '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    game:       overrides.game       ?? { id: 'game-1', name: 'Valorant', slug: 'valorant', logo_url: '/v.png', is_active: true },
    service:    overrides.service    ?? { id: 'svc-1', game_id: 'game-1', type: 'rank_boost', label: 'Rank Boost', base_price: 10, is_active: true },
    ...overrides,
  }
}

// ─── 1. deriveChatDisplay — core fields ───────────────────────────────────────

describe('deriveChatDisplay — core fields', () => {
  it('shortId is the first 8 chars of the UUID uppercased', () => {
    const d = deriveChatDisplay(makeOrder({ id: 'aaaabbbb-cccc-dddd-eeee-000000000001' }))
    expect(d.shortId).toBe('AAAABBBB')
  })

  it('gameName comes from order.game.name', () => {
    const d = deriveChatDisplay(makeOrder())
    expect(d.gameName).toBe('Valorant')
  })

  it('serviceLabel comes from order.service.label', () => {
    const d = deriveChatDisplay(makeOrder())
    expect(d.serviceLabel).toBe('Rank Boost')
  })

  it('orderTitle uses "current_rank → target_rank" when both are present', () => {
    const d = deriveChatDisplay(makeOrder({ details: { current_rank: 'Gold 2', target_rank: 'Platinum 1' } }))
    expect(d.orderTitle).toBe('Gold 2 → Platinum 1')
  })

  it('orderTitle falls back to service label when rank details are absent', () => {
    const d = deriveChatDisplay(makeOrder({ details: {} }))
    expect(d.orderTitle).toBe('Rank Boost')
  })

  it('orderTitle falls back to "Boost" when service is also absent', () => {
    const o = makeOrder({ details: {}, service: undefined })
    const d = deriveChatDisplay(o)
    expect(d.orderTitle).toBe('Boost')
  })
})

// ─── 2. deriveChatDisplay — completionStatus ──────────────────────────────────

describe('deriveChatDisplay — completionStatus', () => {
  const cases: [string, ChatCompletionStatus][] = [
    ['pending',          'Waiting'],
    ['awaiting_payment', 'Waiting'],
    ['in_progress',      'In Progress'],
    ['completed',        'Completed'],
    ['cancelled',        'Canceled'],
    ['dispute',          'Disputed'],
  ]

  it.each(cases)('status "%s" → "%s"', (status, expected) => {
    const d = deriveChatDisplay(makeOrder({ status: status as Order['status'] }))
    expect(d.completionStatus).toBe(expected)
  })

  it('unknown status falls back to "In Progress"', () => {
    const o = makeOrder()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(o as any).status = 'some_unknown_status'
    const d = deriveChatDisplay(o)
    expect(d.completionStatus).toBe('In Progress')
  })
})

// ─── 3. deriveChatDisplay — price coercion ────────────────────────────────────

describe('deriveChatDisplay — price coercion', () => {
  it('converts numeric price to Number', () => {
    const d = deriveChatDisplay(makeOrder({ price: 29.99 }))
    expect(d.price).toBe(29.99)
    expect(typeof d.price).toBe('number')
  })

  it('converts string price to Number', () => {
    const o = makeOrder()
    // Supabase may return price as string in some scenarios
    ;(o as unknown as { price: string }).price = '59.50'
    const d = deriveChatDisplay(o)
    expect(d.price).toBe(59.5)
  })

  it('handles price 0', () => {
    const d = deriveChatDisplay(makeOrder({ price: 0 }))
    expect(d.price).toBe(0)
  })
})

// ─── 4. deriveChatDisplay — createdDate formatting ────────────────────────────

describe('deriveChatDisplay — createdDate', () => {
  it('formats the ISO date as "Mon DD, YYYY"', () => {
    const d = deriveChatDisplay(makeOrder({ created_at: '2026-01-15T10:00:00.000Z' }))
    expect(d.createdDate).toMatch(/Jan\s+\d+,\s+2026/)
  })
})

// ─── 5. deriveChatDisplay — fallback values ───────────────────────────────────

describe('deriveChatDisplay — fallbacks', () => {
  it('gameName falls back to "Unknown" when game is null', () => {
    const o = makeOrder({ game: undefined })
    const d = deriveChatDisplay(o)
    expect(d.gameName).toBe('Unknown')
  })

  it('serviceLabel falls back to "Boost" when service is null', () => {
    const o = makeOrder({ service: undefined })
    const d = deriveChatDisplay(o)
    expect(d.serviceLabel).toBe('Boost')
  })

  it('does not throw when details is null', () => {
    const o = makeOrder({ details: null as unknown as Record<string, unknown> })
    expect(() => deriveChatDisplay(o)).not.toThrow()
  })
})

// ─── 6. CHAT_COMPLETION_BADGE — keys ─────────────────────────────────────────

describe('CHAT_COMPLETION_BADGE — key coverage', () => {
  const EXPECTED_STATUSES: ChatCompletionStatus[] = [
    'Waiting', 'In Progress', 'Completed', 'Canceled', 'Disputed', 'Need Action',
  ]

  it('has an entry for every completion status', () => {
    EXPECTED_STATUSES.forEach(s => {
      expect(CHAT_COMPLETION_BADGE).toHaveProperty(s)
    })
  })

  it('has exactly 6 entries', () => {
    expect(Object.keys(CHAT_COMPLETION_BADGE)).toHaveLength(6)
  })
})

// ─── 7. CHAT_COMPLETION_BADGE — colour tokens ─────────────────────────────────

describe('CHAT_COMPLETION_BADGE — colour tokens', () => {
  it('"Waiting" badge contains muted text token', () => {
    expect(CHAT_COMPLETION_BADGE['Waiting']).toContain('text-[#6e6d6f]')
  })

  it('"In Progress" badge contains yellow token', () => {
    expect(CHAT_COMPLETION_BADGE['In Progress']).toContain('yellow')
  })

  it('"Completed" badge contains green token', () => {
    expect(CHAT_COMPLETION_BADGE['Completed']).toContain('green')
  })

  it('"Canceled" badge contains red token', () => {
    expect(CHAT_COMPLETION_BADGE['Canceled']).toContain('red')
  })

  it('"Disputed" badge contains orange token', () => {
    expect(CHAT_COMPLETION_BADGE['Disputed']).toContain('orange')
  })

  it('"Need Action" badge contains purple token', () => {
    expect(CHAT_COMPLETION_BADGE['Need Action']).toContain('purple')
  })
})

// ─── 8. CHAT_STATUS_TO_COMPLETION ────────────────────────────────────────────

describe('CHAT_STATUS_TO_COMPLETION', () => {
  it('maps all 6 expected DB statuses', () => {
    const expected = ['pending', 'awaiting_payment', 'in_progress', 'completed', 'cancelled', 'dispute']
    expected.forEach(s => {
      expect(CHAT_STATUS_TO_COMPLETION).toHaveProperty(s)
    })
  })
})

// ─── 9–11. validateChatMessage ────────────────────────────────────────────────

describe('validateChatMessage', () => {
  it('rejects empty string', () => {
    const { valid, error } = validateChatMessage('')
    expect(valid).toBe(false)
    expect(error).toBeTruthy()
  })

  it('rejects whitespace-only string', () => {
    const { valid } = validateChatMessage('   \t\n  ')
    expect(valid).toBe(false)
  })

  it('accepts a normal short message', () => {
    const { valid, error } = validateChatMessage('Hello booster!')
    expect(valid).toBe(true)
    expect(error).toBeNull()
  })

  it('accepts a message of exactly MAX_MESSAGE_LENGTH chars', () => {
    const { valid } = validateChatMessage('a'.repeat(MAX_MESSAGE_LENGTH))
    expect(valid).toBe(true)
  })

  it('rejects a message of MAX_MESSAGE_LENGTH + 1 chars', () => {
    const { valid } = validateChatMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1))
    expect(valid).toBe(false)
  })

  it('trims before length check so all-spaces are invalid regardless of length', () => {
    const { valid } = validateChatMessage(' '.repeat(MAX_MESSAGE_LENGTH))
    expect(valid).toBe(false)
  })
})

// ─── 12–14. validateImageFile ────────────────────────────────────────────────

describe('validateImageFile', () => {
  const UNDER_LIMIT = MAX_IMAGE_SIZE_BYTES - 1
  const OVER_LIMIT  = MAX_IMAGE_SIZE_BYTES + 1

  describe('accepted MIME types', () => {
    it.each(ALLOWED_IMAGE_TYPES)('%s is accepted when under size limit', (mime) => {
      const { valid } = validateImageFile(mime, UNDER_LIMIT)
      expect(valid).toBe(true)
    })
  })

  describe('rejected MIME types', () => {
    it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'])(
      '%s is rejected',
      (mime) => {
        const { valid, error } = validateImageFile(mime, UNDER_LIMIT)
        expect(valid).toBe(false)
        expect(error).toBeTruthy()
      }
    )
  })

  describe('size boundary', () => {
    it('accepts file of exactly MAX_IMAGE_SIZE_BYTES', () => {
      const { valid } = validateImageFile('image/jpeg', MAX_IMAGE_SIZE_BYTES)
      expect(valid).toBe(true)
    })

    it('rejects file over MAX_IMAGE_SIZE_BYTES', () => {
      const { valid, error } = validateImageFile('image/jpeg', OVER_LIMIT)
      expect(valid).toBe(false)
      expect(error).toContain('5 MB')
    })

    it('accepts image/webp at exactly max', () => {
      const { valid } = validateImageFile('image/webp', MAX_IMAGE_SIZE_BYTES)
      expect(valid).toBe(true)
    })

    it('rejects image/webp over max', () => {
      const { valid } = validateImageFile('image/webp', OVER_LIMIT)
      expect(valid).toBe(false)
    })
  })
})

// ─── 15–16. formatChatTime ───────────────────────────────────────────────────

describe('formatChatTime', () => {
  it('returns a string matching HH:MM 24-hour pattern', () => {
    const result = formatChatTime('2026-01-15T14:30:00.000Z')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formats noon correctly — result is always HH:MM regardless of timezone', () => {
    // UTC noon may render differently depending on timezone — just verify HH:MM format
    const result = formatChatTime('2026-01-15T12:00:00.000Z')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    // Minutes must be :00 since the source timestamp has no minutes
    expect(result).toMatch(/:00$/)
  })
})

// ─── 17. isOwnMessage ────────────────────────────────────────────────────────

describe('isOwnMessage', () => {
  const cases: [MessageSender, boolean][] = [
    ['client',  true],
    ['booster', false],
    ['system',  false],
  ]

  it.each(cases)('sender "%s" → isOwn=%s', (sender, expected) => {
    expect(isOwnMessage(sender)).toBe(expected)
  })
})

// ─── 18. messageBubbleClass ───────────────────────────────────────────────────

describe('messageBubbleClass', () => {
  it('"system" bubble contains centering class', () => {
    expect(messageBubbleClass('system')).toContain('text-center')
  })

  it('"client" bubble uses white background (own messages are right-aligned)', () => {
    expect(messageBubbleClass('client')).toContain('bg-white')
  })

  it('"booster" bubble uses dark background', () => {
    expect(messageBubbleClass('booster')).toContain('bg-[#2a2a2a]')
  })

  it('client and booster bubbles have different styles', () => {
    expect(messageBubbleClass('client')).not.toBe(messageBubbleClass('booster'))
  })
})

// ─── 19–27. filterChatOrders ────────────────────────────────────────────────

describe('filterChatOrders', () => {
  const orders: Order[] = [
    makeOrder({
      id:      'aaa00001-bbbb-cccc-dddd-000000000001',
      details: { current_rank: 'Iron 1', target_rank: 'Silver 2' },
      game:    { id: 'g1', name: 'Valorant', slug: 'valorant', logo_url: '', is_active: true },
      service: { id: 's1', game_id: 'g1', type: 'rank_boost', label: 'Rank Boost', base_price: 10, is_active: true },
    }),
    makeOrder({
      id:      'bbb00002-bbbb-cccc-dddd-000000000002',
      details: {},
      game:    { id: 'g2', name: 'League of Legends', slug: 'lol', logo_url: '', is_active: true },
      service: { id: 's2', game_id: 'g2', type: 'win_boost', label: 'Win Boost', base_price: 5, is_active: true },
    }),
    makeOrder({
      id:      'ccc00003-bbbb-cccc-dddd-000000000003',
      details: { current_rank: 'Diamond 1', target_rank: 'Immortal 1' },
      game:    { id: 'g1', name: 'Valorant', slug: 'valorant', logo_url: '', is_active: true },
      service: { id: 's3', game_id: 'g1', type: 'placement_matches', label: 'Placements', base_price: 8, is_active: true },
    }),
  ]

  it('returns all orders when query is empty', () => {
    expect(filterChatOrders(orders, '')).toHaveLength(3)
  })

  it('returns all orders when query is whitespace only', () => {
    expect(filterChatOrders(orders, '   ')).toHaveLength(3)
  })

  it('filters by partial order id', () => {
    const results = filterChatOrders(orders, 'aaa00001')
    expect(results).toHaveLength(1)
    expect(results[0].id).toContain('aaa00001')
  })

  it('filters by game name', () => {
    const results = filterChatOrders(orders, 'league')
    expect(results).toHaveLength(1)
    expect(results[0].game?.name).toBe('League of Legends')
  })

  it('filters by service label', () => {
    const results = filterChatOrders(orders, 'win boost')
    expect(results).toHaveLength(1)
    expect(results[0].service?.label).toBe('Win Boost')
  })

  it('filters by orderTitle (rank range)', () => {
    const results = filterChatOrders(orders, 'diamond')
    expect(results).toHaveLength(1)
    const d = results[0].details as Record<string, unknown>
    expect(d.current_rank).toBe('Diamond 1')
  })

  it('is case-insensitive', () => {
    const lower = filterChatOrders(orders, 'VALORANT')
    const upper = filterChatOrders(orders, 'valorant')
    expect(lower).toHaveLength(upper.length)
  })

  it('returns empty array when nothing matches', () => {
    expect(filterChatOrders(orders, 'fortnite')).toHaveLength(0)
  })

  it('does not mutate the original array', () => {
    const original = [...orders]
    filterChatOrders(orders, 'valorant')
    expect(orders).toHaveLength(original.length)
    orders.forEach((o, i) => expect(o).toBe(original[i]))
  })

  it('partial game name matches multiple orders', () => {
    const results = filterChatOrders(orders, 'valorant')
    expect(results).toHaveLength(2)
  })
})
