// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'booster' | 'client' | 'support'

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
  game?: Game
  service?: GameService
  client?: Profile
  booster?: Profile | null
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface ChatMessage {
  id: string
  order_id: string
  sender_id: string
  content: string
  image_url: string | null
  status: MessageStatus
  created_at: string
  sender?: Profile
}

// ─── Order Flow (Zustand) ─────────────────────────────────────────────────────

export interface OrderFlowState {
  step: 1 | 2 | 3 | 4
  selectedGame: Game | null
  selectedService: GameService | null
  orderDetails: Record<string, unknown>
  totalPrice: number
}
