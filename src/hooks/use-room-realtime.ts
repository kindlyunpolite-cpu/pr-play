import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getRoomState, heartbeat } from "@/lib/rooms.functions";
import type { RoomSession } from "@/lib/room-session";

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

export interface RoomState {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  host_player_id: string | null;
  max_players: number;
  created_at: string;
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

/**
 * Subscribes to room + players + messages for the given room code.
 * Also pings the server every 20s so the player's last_seen_at stays fresh.
 */
export function useRoomRealtime(code: string | undefined, session: RoomSession | null) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchRoom = useServerFn(getRoomState);
  const ping = useServerFn(heartbeat);
  const roomIdRef = useRef<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    fetchRoom({ data: { code } })
      .then(async (data) => {
        if (cancelled || !data) {
          if (!cancelled) setLoading(false);
          return;
        }
        setRoom(data.room as RoomState);
        setPlayers(data.players as RoomPlayer[]);
        roomIdRef.current = data.room.id;
        const { data: msgs } = await supabase
          .from("room_messages")
          .select("*")
          .eq("room_id", data.room.id)
          .order("created_at", { ascending: true })
          .limit(200);
        if (!cancelled && msgs) setMessages(msgs as RoomMessage[]);
        if (!cancelled) setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [code, fetchRoom]);

  // Realtime subscriptions
  useEffect(() => {
    const roomId = room?.id;
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setRoom(null);
          else setRoom(payload.new as RoomState);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") {
              const next = [...prev, payload.new as RoomPlayer];
              return next.sort((a, b) => a.seat - b.seat);
            }
            if (payload.eventType === "UPDATE") {
              return prev
                .map((p) => (p.id === (payload.new as RoomPlayer).id ? (payload.new as RoomPlayer) : p))
                .sort((a, b) => a.seat - b.seat);
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((p) => p.id !== (payload.old as RoomPlayer).id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RoomMessage]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // Heartbeat
  useEffect(() => {
    if (!session) return;
    const tick = () =>
      ping({ data: { playerId: session.playerId, sessionToken: session.sessionToken } }).catch(
        () => {},
      );
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [session, ping]);

  return { room, players, messages, loading };
}
