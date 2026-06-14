import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getRoomState, heartbeat } from "@/lib/rooms.functions";
import type {
  ConnectionStatus,
  GameState,
  RoomMessage,
  RoomPlayer,
  RoomSession,
  RoomState,
} from "@/types/room";

export type { ConnectionStatus, GameState, RoomMessage, RoomPlayer, RoomState };

/**
 * Subscribes to room + players + messages for the given room code.
 *
 * Features:
 * - Live joins, leaves, ready/host updates, room status, chat
 * - Auto-resync after tab wake, network reconnect, or channel error
 * - Visibility-aware heartbeat (no wasted pings when tab is hidden)
 * - Stable single channel per room id (StrictMode-safe)
 */
export function useRoomRealtime(code: string | undefined, session: RoomSession | null) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");

  const fetchRoom = useServerFn(getRoomState);
  const ping = useServerFn(heartbeat);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);

  // Full resync — used on initial load and after reconnect
  const resync = useCallback(async () => {
    if (!code) return;
    try {
      const data = await fetchRoom({
        data: session
          ? { code, playerId: session.playerId, sessionToken: session.sessionToken }
          : { code },
      });
      if (!data) {
        setLoading(false);
        return;
      }
      setRoom(data.room as RoomState);
      setPlayers(data.players as RoomPlayer[]);
      setGameState((data.gameState as GameState | null) ?? null);
      roomIdRef.current = data.room.id;

      const { data: msgs } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", data.room.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgs) setMessages(msgs as RoomMessage[]);
    } catch {
      /* swallow — connection state will reflect failure */
    } finally {
      setLoading(false);
    }
  }, [code, fetchRoom, session]);

  // Initial load + when code changes
  useEffect(() => {
    if (!code) return;
    setLoading(true);
    void resync();
  }, [code, resync]);

  // Realtime subscription, rebuilt only when room id changes
  useEffect(() => {
    const roomId = room?.id;
    if (!roomId) return;

    const channel = supabase
      .channel(`room:${roomId}`, { config: { broadcast: { ack: false } } })
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
              const next = [
                ...prev.filter((p) => p.id !== (payload.new as RoomPlayer).id),
                payload.new as RoomPlayer,
              ];
              return next.sort((a, b) => a.seat - b.seat);
            }
            if (payload.eventType === "UPDATE") {
              const nextPlayer = payload.new as RoomPlayer;
              const next = prev.some((p) => p.id === nextPlayer.id)
                ? prev.map((p) => (p.id === nextPlayer.id ? nextPlayer : p))
                : [...prev, nextPlayer];
              return next.sort((a, b) => a.seat - b.seat);
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
        { event: "*", schema: "public", table: "player_stats", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === (payload.old as { player_id: string }).player_id
                  ? { ...p, stats: null }
                  : p,
              ),
            );
            return;
          }

          const stats = payload.new as NonNullable<RoomPlayer["stats"]>;
          setPlayers((prev) => prev.map((p) => (p.id === stats.player_id ? { ...p, stats } : p)));
        },
      )

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_states", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setGameState(null);
          else setGameState(payload.new as GameState);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as RoomMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
          // Resync once the socket recovers
          void resync();
        } else if (status === "CLOSED") {
          setConnection((prev) => (prev === "connected" ? "reconnecting" : prev));
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [room?.id, resync]);

  // Visibility + network reconnect: refresh state when tab/network wakes up
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void resync();
        // Nudge realtime: if socket dropped while hidden, re-subscribing happens
        // automatically via supabase-js, but a state refresh closes any gap.
      }
    };
    const onOnline = () => {
      setConnection("reconnecting");
      void resync();
    };
    const onOffline = () => setConnection("offline");

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setConnection("offline");
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [resync]);

  // Realtime should deliver changes immediately, but keep a light visible-tab
  // refresh as a fallback so lobby/game state never waits for focus changes.
  useEffect(() => {
    if (!code || typeof window === "undefined") return;

    const id = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void resync();
      }
    }, 2_000);

    return () => window.clearInterval(id);
  }, [code, resync]);

  // Heartbeat — only while tab is visible to save battery on mobile
  useEffect(() => {
    if (!session) return;
    let id: number | undefined;

    const tick = () =>
      ping({ data: { playerId: session.playerId, sessionToken: session.sessionToken } }).catch(
        () => {},
      );

    const start = () => {
      if (id !== undefined) return;
      tick();
      id = window.setInterval(tick, 20_000);
    };
    const stop = () => {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session, ping]);

  return { room, players, messages, gameState, loading, connection, resync };
}
