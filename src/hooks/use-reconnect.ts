import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { reconnect } from "@/lib/rooms.functions";
import {
  clearSession,
  loadSession,
  saveSession,
  type RoomSession,
} from "@/lib/room-session";

type Status = "checking" | "ready" | "no-session";

/**
 * On mount, validate the persisted (playerId, sessionToken) pair against the
 * server. On success, refresh the cached session (nickname/seat/avatar) and
 * route the user to wherever the room currently is. On failure, clear the
 * stale session and bounce to the lobby.
 */
export function useReconnect() {
  const navigate = useNavigate();
  const reconnectFn = useServerFn(reconnect);
  const [session, setSession] = useState<RoomSession | null>(() => loadSession());
  const [status, setStatus] = useState<Status>(() => (loadSession() ? "checking" : "no-session"));

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setStatus("no-session");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resumed = await reconnectFn({
          data: { playerId: stored.playerId, sessionToken: stored.sessionToken },
        });
        if (cancelled) return;

        // Persist refreshed canonical fields (seat preserved by server).
        const next: RoomSession = {
          roomCode: resumed.roomCode,
          roomId: resumed.roomId,
          playerId: resumed.playerId,
          sessionToken: stored.sessionToken,
          seat: resumed.seat,
          nickname: resumed.nickname,
          avatar: resumed.avatar,
        };
        saveSession(next);
        setSession(next);
        setStatus("ready");

        // Route to the right place based on current room status.
        if (resumed.roomStatus === "playing") {
          navigate({ to: "/game" });
        }
      } catch {
        if (cancelled) return;
        clearSession();
        setSession(null);
        setStatus("no-session");
        navigate({ to: "/" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount per route — re-running would loop with navigate().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, status };
}
