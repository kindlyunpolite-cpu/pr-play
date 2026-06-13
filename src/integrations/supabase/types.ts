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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_states: {
        Row: {
          active_suit: string | null
          created_at: string
          current_player_id: string | null
          deck: Json
          direction: number
          discard_pile: Json
          hands: Json
          last_action_id: string | null
          last_action_player_id: string | null
          last_action_signature: string | null
          pending_draw: number
          processed_actions: Json
          room_id: string
          status: string
          turn_version: number
          updated_at: string
        }
        Insert: {
          active_suit?: string | null
          created_at?: string
          current_player_id?: string | null
          deck?: Json
          direction?: number
          discard_pile?: Json
          hands?: Json
          last_action_id?: string | null
          last_action_player_id?: string | null
          last_action_signature?: string | null
          pending_draw?: number
          processed_actions?: Json
          room_id: string
          status?: string
          turn_version?: number
          updated_at?: string
        }
        Update: {
          active_suit?: string | null
          created_at?: string
          current_player_id?: string | null
          deck?: Json
          direction?: number
          discard_pile?: Json
          hands?: Json
          last_action_id?: string | null
          last_action_player_id?: string | null
          last_action_signature?: string | null
          pending_draw?: number
          processed_actions?: Json
          room_id?: string
          status?: string
          turn_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_states_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_secrets: {
        Row: {
          player_id: string
          session_token: string
        }
        Insert: {
          player_id: string
          session_token: string
        }
        Update: {
          player_id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_secrets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar: string | null
          connected: boolean
          id: string
          is_host: boolean
          is_ready: boolean
          joined_at: string
          last_seen_at: string
          nickname: string
          room_id: string
          seat: number
          token: string | null
        }
        Insert: {
          avatar?: string | null
          connected?: boolean
          id?: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          last_seen_at?: string
          nickname: string
          room_id: string
          seat: number
          token?: string | null
        }
        Update: {
          avatar?: string | null
          connected?: boolean
          id?: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          last_seen_at?: string
          nickname?: string
          room_id?: string
          seat?: number
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          message: string | null
          nickname: string
          player_id: string | null
          room_id: string
          text: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id?: string
          message?: string | null
          nickname: string
          player_id?: string | null
          room_id: string
          text: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          message?: string | null
          nickname?: string
          player_id?: string | null
          room_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          finished_at: string | null
          host_player_id: string | null
          id: string
          max_players: number
          started_at: string | null
          status: Database["public"]["Enums"]["room_status"]
        }
        Insert: {
          code: string
          created_at?: string
          finished_at?: string | null
          host_player_id?: string | null
          id?: string
          max_players?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
        }
        Update: {
          code?: string
          created_at?: string
          finished_at?: string | null
          host_player_id?: string | null
          id?: string
          max_players?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      room_status: "waiting" | "playing" | "finished"
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
      room_status: ["waiting", "playing", "finished"],
    },
  },
} as const
