export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ban_requests: {
        Row: {
          id:           string
          target_id:    string
          requested_by: string
          action:       'ban' | 'unban'
          reason:       string | null
          status:       'pending' | 'approved' | 'rejected'
          resolved_by:  string | null
          resolved_at:  string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          target_id:    string
          requested_by: string
          action:       'ban' | 'unban'
          reason?:      string | null
          status?:      'pending' | 'approved' | 'rejected'
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?:  string
        }
        Update: {
          id?:          string
          target_id?:   string
          requested_by?: string
          action?:      'ban' | 'unban'
          reason?:      string | null
          status?:      'pending' | 'approved' | 'rejected'
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "ban_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ban_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          dm_thread_id: string | null
          id: string
          image_url: string | null
          is_read: boolean
          is_system: boolean
          order_id: string | null
          sender_id: string
          system_type: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          dm_thread_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          is_system?: boolean
          order_id?: string | null
          sender_id: string
          system_type?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          dm_thread_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          is_system?: boolean
          order_id?: string | null
          sender_id?: string
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      games_services: {
        Row: {
          base_price: number
          created_at: string
          game_id: string
          id: string
          is_active: boolean
          label: string
          type: Database["public"]["Enums"]["service_type"]
        }
        Insert: {
          base_price: number
          created_at?: string
          game_id: string
          id?: string
          is_active?: boolean
          label: string
          type: Database["public"]["Enums"]["service_type"]
        }
        Update: {
          base_price?: number
          created_at?: string
          game_id?: string
          id?: string
          is_active?: boolean
          label?: string
          type?: Database["public"]["Enums"]["service_type"]
        }
        Relationships: [
          {
            foreignKeyName: "games_services_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          type: string
          related_order_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body: string
          type: string
          related_order_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          type?: string
          related_order_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_verifications: {
        Row: {
          id: string
          user_id: string
          verification_status: string
          first_name: string | null
          last_name: string | null
          dob: string | null
          id_type: string | null
          id_serial_number: string | null
          id_document_url: string | null
          id_selfie_url: string | null
          proof_of_address_text: string | null
          proof_of_address_url: string | null
          discord_username: string | null
          discord_unique_id: string | null
          discord_avatar_url: string | null
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          verification_status?: string
          first_name?: string | null
          last_name?: string | null
          dob?: string | null
          id_type?: string | null
          id_serial_number?: string | null
          id_document_url?: string | null
          id_selfie_url?: string | null
          proof_of_address_text?: string | null
          proof_of_address_url?: string | null
          discord_username?: string | null
          discord_unique_id?: string | null
          discord_avatar_url?: string | null
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          verification_status?: string
          first_name?: string | null
          last_name?: string | null
          dob?: string | null
          id_type?: string | null
          id_serial_number?: string | null
          id_document_url?: string | null
          id_selfie_url?: string | null
          proof_of_address_text?: string | null
          proof_of_address_url?: string | null
          discord_username?: string | null
          discord_unique_id?: string | null
          discord_avatar_url?: string | null
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booster_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          id:              string
          user_id:         string
          order_id:        string | null
          payment_method:  'card' | 'paypal' | 'crypto' | 'balance' | 'other'
          status:          'pending' | 'completed' | 'failed' | 'refunded'
          amount:          number
          currency:        string
          promo_code:      string | null
          discount_amount: number
          created_at:      string
          updated_at:      string
        }
        Insert: {
          id?:              string
          user_id:          string
          order_id?:        string | null
          payment_method?:  'card' | 'paypal' | 'crypto' | 'balance' | 'other'
          status?:          'pending' | 'completed' | 'failed' | 'refunded'
          amount:           number
          currency?:        string
          promo_code?:      string | null
          discount_amount?: number
          created_at?:      string
          updated_at?:      string
        }
        Update: {
          id?:              string
          user_id?:         string
          order_id?:        string | null
          payment_method?:  'card' | 'paypal' | 'crypto' | 'balance' | 'other'
          status?:          'pending' | 'completed' | 'failed' | 'refunded'
          amount?:          number
          currency?:        string
          promo_code?:      string | null
          discount_amount?: number
          created_at?:      string
          updated_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          id: string
          booster_id: string
          amount: number
          status: string
          transaction_id: string | null
          receipt_url: string | null
          notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booster_id: string
          amount: number
          status?: string
          transaction_id?: string | null
          receipt_url?: string | null
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booster_id?: string
          amount?: number
          status?: string
          transaction_id?: string | null
          receipt_url?: string | null
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booster_id: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          details: Json
          game_id: string
          id: string
          net_payout: number | null
          price: number
          service_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          booster_id?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          details?: Json
          game_id: string
          id?: string
          net_payout?: number | null
          price: number
          service_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          booster_id?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          details?: Json
          game_id?: string
          id?: string
          net_payout?: number | null
          price?: number
          service_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "games_services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_details_status: string
          bank_details_updated_at: string | null
          bank_holder_name: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bank_details_status?: string
          bank_details_updated_at?: string | null
          bank_holder_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bank_details_status?: string
          bank_details_updated_at?: string | null
          bank_holder_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      order_status:
        | "pending"
        | "awaiting_payment"
        | "in_progress"
        | "waiting_action"
        | "cancel_requested"
        | "completed"
        | "approved"
        | "cancelled"
        | "dispute"
        | "support"
      service_type:
        | "rank_boost"
        | "win_boost"
        | "duo_boost"
        | "placement_matches"
        | "unrated_matches"
      user_role: "admin" | "booster" | "client" | "support" | "accountant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "pending",
        "awaiting_payment",
        "in_progress",
        "waiting_action",
        "cancel_requested",
        "completed",
        "approved",
        "cancelled",
        "dispute",
        "support",
      ],
      service_type: [
        "rank_boost",
        "win_boost",
        "duo_boost",
        "placement_matches",
        "unrated_matches",
      ],
      user_role: ["admin", "booster", "client", "support", "accountant"],
    },
  },
} as const
