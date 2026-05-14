// Shared types for multiplayer rooms.
// Co-located here so hooks, server-fn callers, and route components agree
// on a single source of truth for room/player/message/session shapes.

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

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

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
