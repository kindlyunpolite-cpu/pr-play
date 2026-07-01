import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { RoomShell } from "@/components/ui-room/RoomShell";
import { RoomPanel } from "@/components/ui-room/RoomPanel";
import { RoomButton } from "@/components/ui-room/RoomButton";
import { SectionTitle } from "@/components/ui-room/SectionTitle";
import { SeatPortrait } from "@/components/ui-room/SeatPortrait";
import { getPortrait } from "@/lib/portraits";
import {
  Copy,
  Play,
  UserPlus,
  Loader2,
  Crown,
  Check,
  Share2,
  Link as LinkIcon,
  UserX,
  AlertCircle,
  Bot,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { clearSession, loadSession } from "@/lib/room-session";
import { useRoomRealtime, type RoomPlayer } from "@/hooks/use-room-realtime";
import { useReconnect } from "@/hooks/use-reconnect";
import { setReady, leaveRoom, kickPlayer, startGame } from "@/lib/rooms.functions";
import { addAiPlayer, fillWithAiPlayers } from "@/lib/ai-player";
import { toast } from "sonner";

const searchSchema = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/waiting")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Čekárna — Prší" },
      { name: "description", content: "Čekáme na hráče u stolu." },
    ],
  }),
  component: Waiting,
});

const STATUS_META = {
  online: { label: "Online", dot: "bg-emerald-400" },
  away: { label: "Mimo", dot: "bg-amber-400" },
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
  const { session, status: reconnectStatus, error: reconnectError } = useReconnect();
  const code = search.code ?? session?.roomCode;

  // Only attach realtime/heartbeat after the session is validated by reconnect.
  // Otherwise a stale localStorage session triggers an unauthorized heartbeat
  // before reconnect can clear it.
  const realtimeSession = reconnectStatus === "ready" ? session : null;
  const { room, players, messages, loading, connection, resync } = useRoomRealtime(
    code,
    realtimeSession,
  );
  const callSetReady = useServerFn(setReady);
  const callLeave = useServerFn(leaveRoom);
  const callKick = useServerFn(kickPlayer);
  const callStart = useServerFn(startGame);
  const callAddAi = useServerFn(addAiPlayer);
  const callFillAi = useServerFn(fillWithAiPlayers);

  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState<
    "ready" | "start" | "leave" | "add-ai" | "fill-ai" | `kick:${string}` | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);

  const me = useMemo(
    () => players.find((p) => p.id === session?.playerId) ?? null,
    [players, session?.playerId],
  );

  useEffect(() => {
    if (room?.status === "playing" || room?.status === "finished") navigate({ to: "/game" });
  }, [room?.status, navigate]);

  useEffect(() => {
    if (!code || session) return;
    if (reconnectStatus !== "missing-session" && reconnectStatus !== "expired-session") return;
    // useReconnect starts as "missing-session" before its effect runs. If a
    // session is actually persisted, wait for the hook to validate it instead
    // of ping-ponging back to the lobby.
    if (typeof window !== "undefined" && loadSession()) return;
    navigate({ to: "/", search: { code }, replace: true });
  }, [code, navigate, reconnectStatus, session]);

  useEffect(() => {
    if (reconnectStatus !== "ready" || !session || loading || !room || me) return;
    if (room.status !== "waiting") return;
    clearSession();
    toast.info(`Správce odpojil hráče ${session.nickname} z místnosti`);
    navigate({ to: "/", replace: true });
  }, [loading, me, navigate, reconnectStatus, room, session]);

  const inviteUrl =
    typeof window !== "undefined" && code ? `${window.location.origin}/waiting?code=${code}` : "";

  const connectedPlayers = players.filter((p) => p.connected !== false);
  const nonHostPlayers = connectedPlayers.filter((p) => !p.is_host);
  const nonHostReadyCount = nonHostPlayers.filter((p) => p.is_ready).length;
  const readyCount = connectedPlayers.filter((p) => p.is_ready).length;
  const canStart =
    !!me?.is_host &&
    connectedPlayers.length >= 2 &&
    (nonHostPlayers.length === 0 || nonHostReadyCount === nonHostPlayers.length);

  const copyValue = async (value: string, key: "code" | "link") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      toast.success(key === "code" ? "Kód zkopírován" : "Odkaz zkopírován");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const refreshed = await resync();
      if (refreshed) toast.success("Místnost obnovena");
      else toast.error("Nepodařilo se obnovit místnost");
    } catch {
      toast.error("Nepodařilo se obnovit místnost");
    } finally {
      setRefreshing(false);
    }
  };

  const share = async () => {
    if (!inviteUrl || !code) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Pojď si zahrát Prší",
          text: `Připoj se do mojí místnosti kódem ${code}`,
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
      await resync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepodařilo se");
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
      toast.error(e instanceof Error ? e.message : "Nelze spustit hru");
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

  const handleKick = async (targetPlayer: RoomPlayer) => {
    if (!session || !me?.is_host || targetPlayer.id === session.playerId) return;
    setBusy(`kick:${targetPlayer.id}`);
    try {
      await callKick({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          targetPlayerId: targetPlayer.id,
        },
      });
      toast.success(`Správce odpojil hráče ${targetPlayer.nickname} z místnosti`);
      await resync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepodařilo se odebrat hráče");
    } finally {
      setBusy(null);
    }
  };

  const handleAddAi = async () => {
    if (!session || !me?.is_host) return;
    setBusy("add-ai");
    try {
      await callAddAi({
        data: { playerId: session.playerId, sessionToken: session.sessionToken },
      });
      await resync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepodařilo se přidat AI hráče");
    } finally {
      setBusy(null);
    }
  };

  const handleFillAi = async () => {
    if (!session || !me?.is_host) return;
    setBusy("fill-ai");
    try {
      const res = await callFillAi({
        data: { playerId: session.playerId, sessionToken: session.sessionToken },
      });
      if (res.added === 0) toast.info("Stůl je už plný");
      await resync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepodařilo se doplnit AI");
    } finally {
      setBusy(null);
    }
  };

  if (reconnectStatus === "missing-session" || reconnectStatus === "expired-session") {
    return (
      <RoomShell className="items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/40">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-[color:var(--gold)]" />
          <h1 className="text-lg font-bold text-foreground">
            {reconnectStatus === "missing-session" ? "Chybí uložená session" : "Session vypršela"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reconnectError ?? "Vrať se do lobby a připoj se k místnosti znovu."}
          </p>
          <RoomButton className="mt-5" variant="primary" onClick={() => navigate({ to: "/" })}>
            Zpět do lobby
          </RoomButton>
        </div>
      </RoomShell>
    );
  }

  if (reconnectStatus === "checking" && !session) {
    return (
      <RoomShell className="items-center justify-center">
        <Loader2 className="m-auto h-6 w-6 animate-spin text-[color:var(--gold)]" />
      </RoomShell>
    );
  }

  const maxPlayers = room?.max_players ?? 4;
  const slots = Math.max(0, maxPlayers - players.length);

  if (!session || !code) {
    return (
      <RoomShell className="items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)] m-auto" />
      </RoomShell>
    );
  }

  if (loading && !room) {
    return (
      <RoomShell>
        <TopNav
          roomCode={code}
          onLeave={handleLeave}
          leaving={busy === "leave"}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--gold)]" />
            Načítám místnost…
          </div>
        </div>
      </RoomShell>
    );
  }

  if (!room) {
    return (
      <RoomShell>
        <TopNav
          roomCode={code}
          onLeave={handleLeave}
          leaving={busy === "leave"}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-base font-semibold">Místnost nenalezena</p>
          <p className="text-sm text-muted-foreground">
            Tato místnost už neexistuje. Vytvoř nebo se připoj jinam.
          </p>
          <RoomButton variant="primary" onClick={handleLeave} className="mt-2">
            Zpět do lobby
          </RoomButton>
        </div>
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <TopNav
        roomCode={code}
        onLeave={handleLeave}
        leaving={busy === "leave"}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
      />

      <div className="flex flex-1 lg:flex-row flex-col min-h-0">
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 lg:max-w-2xl">
          {/* Status */}
          <section className="text-center mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-60",
                    connection === "connected" && "bg-emerald-400 animate-ping",
                    (connection === "reconnecting" || connection === "connecting") &&
                      "bg-amber-400 animate-ping",
                    connection === "offline" && "bg-muted-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    connection === "connected" && "bg-emerald-400",
                    (connection === "reconnecting" || connection === "connecting") &&
                      "bg-amber-400",
                    connection === "offline" && "bg-muted-foreground/60",
                  )}
                />
              </span>
              <span className="text-muted-foreground">
                {connection === "connected" && "Připojeno"}
                {connection === "connecting" && "Připojuji…"}
                {connection === "reconnecting" && "Obnovuji…"}
                {connection === "offline" && "Offline"}
              </span>
              <span className="h-3 w-px bg-white/15" />
              <Loader2 className="h-3 w-3 animate-spin text-[color:var(--gold)]" />
              <span className="text-muted-foreground">Čekáme na hráče…</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold">Čekárna</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sdílej kód nebo odkaz a pozvi přátele.
            </p>
          </section>

          {/* Invite */}
          <RoomPanel tone="active" className="mb-5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Kód místnosti
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground tabular-nums">
                {players.length}/{maxPlayers} hráčů
              </span>
            </div>

            <button
              onClick={() => copyValue(code, "code")}
              className="group w-full flex items-center justify-between gap-3 rounded-xl bg-black/40 px-4 py-3 transition active:scale-[0.99] hover:bg-black/60 border border-white/8"
              aria-label="Zkopírovat kód"
            >
              <span className="font-mono text-3xl font-bold gold-text tracking-[0.32em]">
                {code}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {copied === "code" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                    Hotovo
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Kopírovat
                  </>
                )}
              </span>
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <RoomButton
                size="sm"
                variant="secondary"
                onClick={() => copyValue(inviteUrl, "link")}
                disabled={!inviteUrl}
                icon={
                  copied === "link" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )
                }
              >
                {copied === "link" ? "Zkopírováno" : "Kopírovat odkaz"}
              </RoomButton>
              <RoomButton
                size="sm"
                variant="secondary"
                onClick={share}
                icon={<Share2 className="h-3.5 w-3.5" />}
              >
                Sdílet
              </RoomButton>
            </div>
          </RoomPanel>

          {/* Players */}
          <section>
            <SectionTitle
              right={
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {readyCount}/{connectedPlayers.length} připraveno
                </span>
              }
            >
              Hráči
            </SectionTitle>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {players.map((p) => {
                const status = deriveStatus(p);
                const meta = STATUS_META[status];
                const isMe = p.id === session.playerId;
                const canKick = !!me?.is_host && !isMe;
                const portrait = getPortrait(p.avatar);
                return (
                  <li key={p.id} className="animate-fade-in">
                    <RoomPanel
                      tone={p.is_ready ? "active" : "default"}
                      className="relative flex flex-col items-center gap-2 p-3"
                    >
                      {canKick && (
                        <button
                          type="button"
                          onClick={() => handleKick(p)}
                          disabled={busy === `kick:${p.id}`}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/35 text-muted-foreground transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:pointer-events-none disabled:opacity-50"
                          aria-label={`Odebrat hráče ${p.nickname}`}
                          title={`Odebrat ${p.nickname}`}
                        >
                          {busy === `kick:${p.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <div className="relative flex h-20 w-16 items-end justify-center">
                        <SeatPortrait
                          src={portrait.src}
                          name={portrait.name}
                          accent={portrait.accent}
                          size="md"
                          active={p.is_ready}
                          offline={status === "offline"}
                        />
                        {p.is_ai && (
                          <span className="absolute -top-1 left-0 z-10 rounded-md border border-[color:var(--gold)]/50 bg-black/70 px-1 text-[8px] font-bold uppercase tracking-[0.18em] text-[color:var(--gold)]">
                            AI
                          </span>
                        )}
                        {p.is_host && (
                          <Crown className="absolute -top-1 right-0 h-4 w-4 fill-[color:var(--gold)] text-[color:var(--gold)] drop-shadow" />
                        )}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-black/60",
                            meta.dot,
                            status === "away" && "animate-pulse",
                          )}
                          aria-label={meta.label}
                        />
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <div className="truncate text-[13px] font-semibold">
                          {p.nickname}
                          {isMe && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              (ty)
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "text-[10px] uppercase tracking-[0.18em] font-semibold",
                            p.is_ready ? "text-[color:var(--gold)]" : "text-muted-foreground",
                          )}
                        >
                          {p.is_ready ? "Připraven" : "Čeká"}
                        </div>
                      </div>
                    </RoomPanel>
                  </li>
                );
              })}

              {Array.from({ length: slots }).map((_, i) => (
                <li key={`empty-${i}`}>
                  <div className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/8 bg-black/15 px-2 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                    <UserPlus className="h-3 w-3" />
                    Volné
                  </div>
                </li>
              ))}
            </ul>

            {me?.is_host && players.length < maxPlayers && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <RoomButton
                  size="sm"
                  variant="secondary"
                  onClick={handleAddAi}
                  loading={busy === "add-ai"}
                  disabled={busy === "fill-ai"}
                  icon={<Bot className="h-3.5 w-3.5" />}
                >
                  Přidat AI hráče
                </RoomButton>
                <RoomButton
                  size="sm"
                  variant="secondary"
                  onClick={handleFillAi}
                  loading={busy === "fill-ai"}
                  disabled={busy === "add-ai" || players.length >= Math.min(4, maxPlayers)}
                  icon={<Users className="h-3.5 w-3.5" />}
                >
                  Doplnit AI do 4 hráčů
                </RoomButton>
              </div>
            )}
          </section>
        </main>

        <ChatPanel messages={messages} session={session} />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 border-t border-white/8 bg-gradient-to-t from-background via-background/95 to-background/70 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pt-3 lg:max-w-2xl">
          {me?.is_host ? (
            <RoomButton
              size="lg"
              block
              variant="primary"
              onClick={handleStart}
              disabled={!canStart}
              loading={busy === "start"}
              icon={<Play className="h-4 w-4 fill-current" />}
            >
              Spustit hru
            </RoomButton>
          ) : (
            <RoomButton
              size="lg"
              block
              variant="secondary"
              onClick={toggleReady}
              disabled={!me}
              loading={busy === "ready"}
              icon={
                <Check
                  className={cn(
                    "h-4 w-4",
                    me?.is_ready ? "text-[color:var(--gold)]" : "opacity-50",
                  )}
                />
              }
              className={
                me?.is_ready ? "border-[color:var(--gold)]/45 text-[color:var(--gold)]" : ""
              }
            >
              {me?.is_ready ? "Připraven" : "Připravit se"}
            </RoomButton>
          )}
        </div>
        {me?.is_host && !canStart && (
          <p className="mt-1.5 px-4 pb-1 text-center text-[11px] text-muted-foreground">
            Všichni hráči musí být připraveni (min. 2)
          </p>
        )}
      </div>
    </RoomShell>
  );
}
