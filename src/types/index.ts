// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'booster' | 'client' | 'support' | 'accountant'

export interface Profile {
  id: string
  email: string
  role: UserRole
  username: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ─── Games & Services ────────────────────────────────────────────────────────

export type ServiceType =
  | 'rank_boost'
  | 'win_boost'
  | 'duo_boost'
  | 'placement_matches'
  | 'unrated_matches'

export interface Game {
  id: string
  name: string
  slug: string
  logo_url: string
  is_active: boolean
}

export interface GameService {
  id: string
  game_id: string
  type: ServiceType
  label: string
  base_price: number
  is_active: boolean
  game?: Game
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'dispute'
  | 'support'

export interface Order {
  id: string
  client_id: string
  booster_id: string | null
  game_id: string
  service_id: string
  status: OrderStatus
  price: number
  details: Record<string, unknown>
  created_at: string
  updated_at: string
  // Dispute resolution (admin/support)
  resolution_notes?: string | null
  resolution_client_pct?: number | null
  resolved_by?: string | null
  resolved_at?: string | null
  game?: Game
  service?: GameService
  client?: Profile
  booster?: Profile | null
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface ChatMessage {
  id: string
  order_id: string | null
  dm_thread_id?: string | null
  sender_id: string
  content: string
  image_url: string | null
  is_system?: boolean
  is_read?: boolean
  system_type?: string | null
  status: MessageStatus
  created_at: string
  sender?: Profile
}

// ─── Transactions / Wallet ───────────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type PaymentMethod = 'card' | 'paypal' | 'crypto' | 'balance' | 'other'

// ─── Withdrawals ─────────────────────────────────────────────────────────────

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected'

export interface Withdrawal {
  id: string
  booster_id: string
  amount: number
  status: WithdrawalStatus
  transaction_id: string | null
  receipt_url: string | null
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  booster?: Profile
  reviewer?: Profile | null
}

export interface Transaction {
  id: string
  user_id: string
  order_id: string | null
  payment_method: PaymentMethod
  status: TransactionStatus
  amount: number
  currency: string
  promo_code: string | null
  discount_amount: number
  created_at: string
  updated_at: string
  order?: Pick<Order, 'id' | 'details' | 'game' | 'service'>
}

// ─── Order Flow (Zustand) ─────────────────────────────────────────────────────

export interface OrderFlowState {
  step: 1 | 2 | 3 | 4
  selectedGame: Game | null
  selectedService: GameService | null
  orderDetails: Record<string, unknown>
  totalPrice: number
}
