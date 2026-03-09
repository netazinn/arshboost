/**
 * Pure, framework-agnostic utility functions for the Orders Chat feature.
 * All functions are tested via src/lib/__tests__/chat.test.ts
 */

import type { Order } from '@/types'

// ─── Display types ────────────────────────────────────────────────────────────

export type ChatCompletionStatus =
  | 'Waiting'
  | 'In Progress'
  | 'Completed'
  | 'Canceled'
  | 'Disputed'
  | 'Need Action'

export interface ChatOrderDisplay {
  shortId:          string
  gameName:         string
  serviceLabel:     string
  orderTitle:       string
  completionStatus: ChatCompletionStatus
  price:            number
  createdDate:      string
}

// ─── Badge class map ──────────────────────────────────────────────────────────

export const CHAT_COMPLETION_BADGE: Record<ChatCompletionStatus, string> = {
  'Waiting':     'border border-white/20 text-[#6e6d6f] bg-white/5',
  'In Progress': 'border border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  'Completed':   'border border-green-500/40 text-green-400 bg-green-500/10',
  'Canceled':    'border border-red-500/40 text-red-400 bg-red-500/10',
  'Disputed':    'border border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Need Action': 'border border-purple-500/40 text-purple-400 bg-purple-500/10',
}

// ─── Status → display mapping ─────────────────────────────────────────────────

export const CHAT_STATUS_TO_COMPLETION: Record<string, ChatCompletionStatus> = {
  pending:          'Waiting',
  awaiting_payment: 'Waiting',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Canceled',
  dispute:          'Disputed',
}

// ─── deriveChatDisplay ────────────────────────────────────────────────────────

export function deriveChatDisplay(order: Order): ChatOrderDisplay {
  const d = (order.details ?? {}) as Record<string, unknown>

  const title =
    d.current_rank && d.target_rank
      ? `${d.current_rank} → ${d.target_rank}`
      : order.service?.label ?? 'Boost'

  return {
    shortId:          order.id.slice(0, 8).toUpperCase(),
    gameName:         order.game?.name    ?? 'Unknown',
    serviceLabel:     order.service?.label ?? 'Boost',
    orderTitle:       title,
    completionStatus: (CHAT_STATUS_TO_COMPLETION[order.status] ?? 'In Progress') as ChatCompletionStatus,
    price:            Number(order.price),
    createdDate:      new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
  }
}

// ─── Message validation ───────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 2000
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type ImageMimeType = (typeof ALLOWED_IMAGE_TYPES)[number]

export interface MessageValidationResult {
  valid: boolean
  error: string | null
}

/** Returns { valid: true } when message can be sent, otherwise { valid: false, error } */
export function validateChatMessage(text: string): MessageValidationResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { valid: false, error: 'Message cannot be empty.' }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} chars).` }
  }
  return { valid: true, error: null }
}

/** Returns { valid: true } when an image file is acceptable, otherwise { valid: false, error } */
export function validateImageFile(type: string, sizeBytes: number): MessageValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(type as ImageMimeType)) {
    return { valid: false, error: 'Only JPG, PNG or WebP images are allowed.' }
  }
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'Image must be under 5 MB.' }
  }
  return { valid: true, error: null }
}

// ─── Chat time formatting ─────────────────────────────────────────────────────

/** Formats an ISO timestamp as HH:MM (24-hour, locale-safe). */
export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ─── Sender helpers ───────────────────────────────────────────────────────────

export type MessageSender = 'client' | 'booster' | 'system'

/**
 * Determines whether a message bubble should be right-aligned.
 * Only 'client' messages are self-authored from the client's perspective.
 */
export function isOwnMessage(sender: MessageSender): boolean {
  return sender === 'client'
}

/**
 * Returns the CSS class string for a message bubble based on sender.
 * System messages are treated as full-width notices.
 */
export function messageBubbleClass(sender: MessageSender): string {
  if (sender === 'system')  return 'bg-white/5 text-[#6e6d6f] text-center text-[10px]'
  if (sender === 'client')  return 'bg-white text-black'
  return 'bg-[#2a2a2a] text-white'
}

// ─── Order-list sidebar helpers ───────────────────────────────────────────────

/**
 * Filters orders by a search query (id, title, game, service) — case-insensitive.
 */
export function filterChatOrders(orders: Order[], query: string): Order[] {
  const q = query.trim().toLowerCase()
  if (!q) return orders

  return orders.filter((o) => {
    const d = (o.details ?? {}) as Record<string, unknown>
    const title =
      d.current_rank && d.target_rank
        ? `${d.current_rank} → ${d.target_rank}`
        : o.service?.label ?? ''

    return (
      o.id.toLowerCase().includes(q)            ||
      (o.game?.name   ?? '').toLowerCase().includes(q) ||
      (o.service?.label ?? '').toLowerCase().includes(q) ||
      title.toLowerCase().includes(q)
    )
  })
}
