// Shared types for multiplayer rooms.
// Co-located here so hooks, server-fn callers, and route components agree
// on a single source of truth for room/player/message/session shapes.

import type { CardData, Suit } from "@/components/cards";

export interface RoomState {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  host_player_id: string | null;
  max_players: number;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  nickname: string;
  avatar: string | null;
  is_host: boolean;
  is_ready: boolean;
  seat: number;
  joined_at: string;
  last_seen_at: string;
  connected?: boolean;
  is_ai?: boolean;
  stats?: PlayerStats | null;
}

export interface PlayerStats {
  player_id: string;
  room_id: string | null;
  games_played: number;
  wins: number;
  cards_drawn: number;
  cards_played: number;
  turns_taken: number;
  updated_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  player_id: string | null;
  nickname: string;
  avatar: string | null;
  text: string;
  created_at: string;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

/** Persisted in localStorage so the player can resume after refresh. */
export interface RoomSession {
  roomCode: string;
  roomId: string;
  playerId: string;
  sessionToken: string;
  seat: number;
  nickname: string;
  avatar?: string | null;
}

export interface GameState {
  room_id: string;
  deck: CardData[];
  discard_pile: CardData[];
  hands: Record<string, CardData[]>;
  current_player_id: string | null;
  active_suit: Suit | null;
  direction: 1 | -1;
  status: "playing" | "finished";
  pending_draw: number;
  turn_version: number;
  last_action_id: string | null;
  last_action_player_id: string | null;
  last_action_signature: string | null;
  processed_actions: Record<string, { playerId: string; signature: string }>;
  rematch_votes?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}
