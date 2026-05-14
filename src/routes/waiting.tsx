import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import {
  Copy,
  Play,
  UserPlus,
  Loader2,
  Crown,
  Check,
  Share2,
  Link as LinkIcon,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { clearSession } from "@/lib/room-session";
import { useRoomRealtime, type RoomPlayer } from "@/hooks/use-room-realtime";
import { useReconnect } from "@/hooks/use-reconnect";
import { setReady, leaveRoom, startGame } from "@/lib/rooms.functions";
import { toast } from "sonner";

const searchSchema = z.object({
  code: z.string().optional(),
});

export const Route = createFileRoute("/waiting")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Waiting room — Prší" },
      { name: "description", content: "Waiting for players to join the table." },
    ],
  }),
  component: Waiting,
});

const STATUS_META = {
  online: { label: "Online", dot: "bg-emerald-400" },
  away: { label: "Away", dot: "bg-amber-400" },
  offline: { label: "Offline", dot: "bg-muted-foreground/50" },
};

function deriveStatus(p: RoomPlayer): keyof typeof STATUS_META {
  const ageMs = Date.now() - new Date(p.last_seen_at).getTime();
  if (ageMs < 30_000) return "online";
  if (ageMs < 90_000) return "away";
  return "offline";
}

function Waiting() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { session } = useReconnect();
  const code = search.code ?? session?.roomCode;

  const { room, players, loading, connection } = useRoomRealtime(code, session);
  const callSetReady = useServerFn(setReady);
  const callLeave = useServerFn(leaveRoom);
  const callStart = useServerFn(startGame);

  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState<"ready" | "start" | "leave" | null>(null);

  const me = useMemo(
    () => players.find((p) => p.id === session?.playerId) ?? null,
    [players, session?.playerId],
  );

  // Auto-navigate when host starts the game
  useEffect(() => {
    if (room?.status === "playing") {
      navigate({ to: "/game" });
    }
  }, [room?.status, navigate]);

  // No session or not in this room → bounce to lobby
  useEffect(() => {
    if (!session) {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  const inviteUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/waiting?code=${code}`
      : "";

  const readyCount = players.filter((p) => p.is_ready).length;
  const canStart =
    !!me?.is_host &&
    players.length >= 2 &&
    readyCount === players.length;

  const copyValue = async (value: string, key: "code" | "link") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    if (!inviteUrl || !code) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my Prší room",
          text: `Join my Prší room with code ${code}`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* fallthrough */
      }
    }
    copyValue(inviteUrl, "link");
  };

  const toggleReady = async () => {
    if (!session || !me) return;
    setBusy("ready");
    try {
      await callSetReady({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          ready: !me.is_ready,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const handleStart = async () => {
    if (!session) return;
    setBusy("start");
    try {
      await callStart({
        data: { playerId: session.playerId, sessionToken: session.sessionToken },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start game");
    } finally {
      setBusy(null);
    }
  };

  const handleLeave = async () => {
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    setBusy("leave");
    try {
      await callLeave({
        data: { playerId: session.playerId, sessionToken: session.sessionToken },
      });
    } catch {
      /* ignore */
    } finally {
      clearSession();
      navigate({ to: "/" });
    }
  };

  const maxPlayers = room?.max_players ?? 4;
  const slots = Math.max(0, maxPlayers - players.length);

  if (!session || !code) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loading && !room) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <TopNav roomCode={code} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading room…
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <TopNav roomCode={code} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-base font-semibold">Room not found</p>
          <p className="text-sm text-muted-foreground">
            This room no longer exists. Create or join another.
          </p>
          <button
            onClick={handleLeave}
            className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav roomCode={code} />

      <div className="flex flex-1 lg:flex-row flex-col">
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 lg:max-w-2xl">
          {/* Status header */}
          <section className="text-center mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-60",
                    connection === "connected" && "bg-emerald-400 animate-ping",
                    connection === "reconnecting" && "bg-amber-400 animate-ping",
                    connection === "connecting" && "bg-amber-400 animate-ping",
                    connection === "offline" && "bg-muted-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    connection === "connected" && "bg-emerald-400",
                    connection === "reconnecting" && "bg-amber-400",
                    connection === "connecting" && "bg-amber-400",
                    connection === "offline" && "bg-muted-foreground/60",
                  )}
                />
              </span>
              <span className="text-muted-foreground">
                {connection === "connected" && "Connected"}
                {connection === "connecting" && "Connecting…"}
                {connection === "reconnecting" && "Reconnecting…"}
                {connection === "offline" && "Offline"}
              </span>
              <span className="h-3 w-px bg-border/70" />
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-muted-foreground">Waiting for players…</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold">Lobby</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the code or link to invite friends.
            </p>
          </section>

          {/* Invite section */}
          <section className="mb-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 backdrop-blur-md p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Room code
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                {players.length}/{maxPlayers} joined
              </span>
            </div>

            <button
              onClick={() => copyValue(code, "code")}
              className="group w-full flex items-center justify-between gap-3 rounded-xl bg-background/40 px-4 py-3 transition active:scale-[0.99] hover:bg-background/60"
              aria-label="Copy room code"
            >
              <span className="font-mono text-3xl font-bold gold-text tracking-[0.35em]">
                {code}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {copied === "code" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </span>
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => copyValue(inviteUrl, "link")}
                disabled={!inviteUrl}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/50 py-2 text-xs font-medium transition active:scale-[0.98] hover:bg-card disabled:opacity-50"
              >
                {copied === "link" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <LinkIcon className="h-3.5 w-3.5" />
                )}
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
              <button
                onClick={share}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/50 py-2 text-xs font-medium transition active:scale-[0.98] hover:bg-card"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </section>

          {/* Players */}
          <section>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Players
              </h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {readyCount}/{players.length} ready
              </span>
            </div>

            <ul className="space-y-2">
              {players.map((p) => {
                const status = deriveStatus(p);
                const meta = STATUS_META[status];
                const isMe = p.id === session.playerId;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card/60 backdrop-blur p-3 transition animate-fade-in",
                      p.is_ready ? "border-primary/40" : "border-border",
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-2xl shadow-inner">
                        {p.avatar ?? "🎴"}
                      </div>
                      {p.is_host && (
                        <Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-primary fill-primary drop-shadow" />
                      )}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
                          meta.dot,
                          status === "away" && "animate-pulse",
                        )}
                        aria-label={meta.label}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">
                          {p.nickname}
                          {isMe && (
                            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </span>
                        {p.is_host && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider gold-text">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{meta.label}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className={p.is_ready ? "text-primary" : ""}>
                          {p.is_ready ? "Ready" : "Not ready"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full transition",
                        p.is_ready
                          ? "bg-primary shadow shadow-primary/40"
                          : "bg-muted-foreground/30",
                      )}
                    />
                  </li>
                );
              })}

              {Array.from({ length: slots }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border/50 p-3 text-muted-foreground"
                >
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[seat-scan_2.4s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 400}ms` }}
                  />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                    <UserPlus className="h-5 w-5" />
                    <span className="absolute inset-0 rounded-2xl ring-1 ring-primary/20 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">Open seat</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for player…
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <button
              onClick={handleLeave}
              disabled={busy === "leave"}
              className="mt-4 mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave room
            </button>
          </section>
        </main>

        <ChatPanel />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 border-t border-border/40 bg-gradient-to-t from-background via-background/95 to-background/70 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pt-3 lg:max-w-2xl">
          <button
            onClick={toggleReady}
            disabled={busy === "ready" || !me}
            className={cn(
              "flex-1 h-12 rounded-2xl text-sm font-semibold transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60",
              me?.is_ready
                ? "bg-card border border-primary/40 text-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {busy === "ready" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className={cn("h-4 w-4", me?.is_ready ? "text-primary" : "opacity-50")} />
            )}
            {me?.is_ready ? "Ready" : "Mark ready"}
          </button>

          {me?.is_host && (
            <button
              onClick={handleStart}
              disabled={!canStart || busy === "start"}
              className="flex-[1.4] h-12 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {busy === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Start game
            </button>
          )}
        </div>
        {me?.is_host && !canStart && (
          <p className="mt-1.5 px-4 text-center text-[11px] text-muted-foreground">
            All players must be ready (min 2)
          </p>
        )}
      </div>
    </div>
  );
}
