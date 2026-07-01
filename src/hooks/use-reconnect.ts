import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { reconnect } from "@/lib/rooms.functions";
import { clearSession, loadSession, saveSession, type RoomSession } from "@/lib/room-session";

export type ReconnectStatus = "checking" | "ready" | "missing-session" | "expired-session";

type UseReconnectOptions = {
  showMissingError?: boolean;
  showExpiredError?: boolean;
};

function getInitialSession() {
  return loadSession();
}

/**
 * On mount, validate the persisted (playerId, sessionToken) pair against the
 * server. On success, refresh the cached session (nickname/seat/avatar) and
 * route the user to wherever the room currently is. On failure, clear the
 * stale session and expose a route-level error state instead of rendering with
 * an invalid identity.
 */
export function useReconnect(options: UseReconnectOptions = {}) {
  const navigate = useNavigate();
  const reconnectFn = useServerFn(reconnect);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [status, setStatus] = useState<ReconnectStatus>("missing-session");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setSession(null);
      setError(
        options.showMissingError === false
          ? null
          : "No saved room session was found on this device.",
      );
      setStatus("missing-session");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resumed = await reconnectFn({
          data: { playerId: stored.playerId, sessionToken: stored.sessionToken },
        });
        if (cancelled) return;
        if (!resumed) throw new Error("Your saved room session expired.");

        // Persist refreshed canonical fields while preserving the session token.
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
        setError(null);
        setStatus("ready");

        if (resumed.roomStatus === "waiting") {
          navigate({ to: "/waiting", search: { code: resumed.roomCode } });
        } else {
          // Playing and finished rooms both render from the game table so the
          // player's seat, identity, avatar, and final hand stay visible.
          navigate({ to: "/game" });
        }
      } catch (caught) {
        if (cancelled) return;
        clearSession();
        setSession(null);
        setError(
          options.showExpiredError === false
            ? null
            : caught instanceof Error
              ? caught.message
              : "Your saved room session expired.",
        );
        setStatus("expired-session");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount per route — re-running would loop with navigate().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, status, error };
}
