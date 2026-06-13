import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { Opponent, type OpponentData, type SeatPlacement } from "@/components/Opponent";
import { RoomShell } from "@/components/ui-room/RoomShell";
import { RoomButton } from "@/components/ui-room/RoomButton";
import {
  PlayingCard,
  CardStack,
  DiscardPile,
  SuitBadge,
  type CardData,
  type Suit,
} from "@/components/cards";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Timer, Sparkles, Trophy } from "lucide-react";
import { SUIT_LABEL, isRedSuit } from "@/components/cards/types";
import { SuitIcon } from "@/components/cards/SuitIcon";
import { cn } from "@/lib/utils";
import { getPortrait, PORTRAITS } from "@/lib/portraits";
import { useReconnect } from "@/hooks/use-reconnect";
import { useRoomRealtime } from "@/hooks/use-room-realtime";
import {
  acceptRematch,
  declineRematch,
  drawCard,
  playCard,
  leaveRoom,
} from "@/lib/rooms.functions";
import { clearSession } from "@/lib/room-session";
import { toast } from "sonner";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [{ title: "Stůl — Prší" }, { name: "description", content: "Živá hra Prší u stolu." }],
  }),
  component: Game,
});

const FALLBACK_CARD: CardData = { suit: "hearts", rank: "10" };
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

function adjacentPlayerId(
  players: { id: string }[],
  currentPlayerId: string | null,
  direction: 1 | -1,
) {
  if (!currentPlayerId || players.length === 0) return null;
  const index = players.findIndex((p) => p.id === currentPlayerId);
  if (index === -1) return null;
  const step = direction === -1 ? -1 : 1;
  return players[(index + step + players.length) % players.length]?.id ?? null;
}

function createActionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();

  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(
    16,
  )}${hex(3)}-${hex(12)}`;
}

function Game() {
  const navigate = useNavigate();
  const { session, status: reconnectStatus, error: reconnectError } = useReconnect();
  const code = session?.roomCode;
  const realtimeSession = reconnectStatus === "ready" ? session : null;
  const { room, players, messages, gameState, loading } = useRoomRealtime(code, realtimeSession);
  const callDrawCard = useServerFn(drawCard);
  const callPlayCard = useServerFn(playCard);
  const callLeave = useServerFn(leaveRoom);
  const callAcceptRematch = useServerFn(acceptRematch);
  const callDeclineRematch = useServerFn(declineRematch);
  const [leaving, setLeaving] = useState(false);
  const [busyRematch, setBusyRematch] = useState<"accept" | "decline" | null>(null);

  const handleLeave = async () => {
    if (!session) {
      clearSession();
      navigate({ to: "/" });
      return;
    }
    setLeaving(true);
    try {
      await callLeave({
        data: { playerId: session.playerId, sessionToken: session.sessionToken },
      });
    } catch {
      /* ignore — still clear and exit */
    } finally {
      clearSession();
      navigate({ to: "/" });
    }
  };

  const [selected, setSelected] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [pileNonce, setPileNonce] = useState(0);
  const [drawNonce, setDrawNonce] = useState(0);
  const [dealt, setDealt] = useState(false);
  const [busyAction, setBusyAction] = useState<"draw" | "play" | null>(null);
  const [suitPickerIndex, setSuitPickerIndex] = useState<number | null>(null);
  const busyActionRef = useRef(false);
  const aceSkipToastRef = useRef<string | null>(null);

  const me = useMemo(
    () => players.find((p) => p.id === session?.playerId) ?? null,
    [players, session?.playerId],
  );
  const hand = session ? (gameState?.hands[session.playerId] ?? []) : [];
  const topDiscard = gameState?.discard_pile.at(-1) ?? FALLBACK_CARD;
  const discardPile: [CardData, ...CardData[]] = gameState?.discard_pile.length
    ? [gameState.discard_pile[0] ?? topDiscard, ...gameState.discard_pile.slice(1)]
    : [topDiscard];
  const activeSuit = gameState?.active_suit ?? topDiscard.suit;
  const pendingDraw = gameState?.pending_draw ?? 0;
  const myTurn =
    gameState?.status === "playing" && gameState?.current_player_id === session?.playerId;
  const activePlayer = players.find((p) => p.id === gameState?.current_player_id) ?? me;
  const gameFinished = room?.status === "finished" || gameState?.status === "finished";
  const winner = gameFinished ? players.find((p) => p.id === gameState?.current_player_id) : null;
  const connectedPlayers = players.filter((p) => p.connected !== false);
  const rematchVotes = gameState?.rematch_votes ?? {};
  const acceptedRematchCount = connectedPlayers.filter((p) => rematchVotes[p.id] === true).length;
  const rematchVoteTotal = connectedPlayers.length;
  const myRematchVote = session ? rematchVotes[session.playerId] : undefined;
  const aceSkip = useMemo(() => {
    if (gameFinished || gameState?.status !== "playing" || topDiscard.rank !== "A") return null;
    if (!gameState.last_action_id || !gameState.last_action_player_id) return null;
    if (!gameState.last_action_signature?.startsWith("play:")) return null;

    const skippedPlayerId = adjacentPlayerId(
      players,
      gameState.last_action_player_id,
      gameState.direction,
    );
    const skippedPlayer = players.find((p) => p.id === skippedPlayerId);
    const actingPlayer = players.find((p) => p.id === gameState.last_action_player_id);
    if (!skippedPlayer || !actingPlayer) return null;

    return {
      actionId: gameState.last_action_id,
      skippedPlayer,
      actingPlayer,
    };
  }, [
    gameFinished,
    gameState?.direction,
    gameState?.last_action_id,
    gameState?.last_action_player_id,
    gameState?.last_action_signature,
    gameState?.status,
    players,
    topDiscard.rank,
  ]);

  const opponents: OpponentData[] = useMemo(
    () =>
      players
        .filter((p) => p.id !== session?.playerId)
        .map((p, index) => {
          const portrait = getPortrait(p.avatar);
          return {
            id: p.id,
            name: p.nickname,
            avatar: portrait.src,
            cardCount: gameState?.hands[p.id]?.length ?? 0,
            isTurn: p.id === gameState?.current_player_id,
            rank: p.seat + 1,
            wins: p.stats?.wins ?? 0,
            gamesPlayed: p.stats?.games_played ?? 0,
            cardsPlayed: p.stats?.cards_played ?? 0,
            cardsDrawn: p.stats?.cards_drawn ?? 0,
            chips: 0,
            accent: portrait.accent ?? PORTRAITS[index % PORTRAITS.length].accent,
          };
        }),
    [gameState?.current_player_id, gameState?.hands, players, session?.playerId],
  );

  const mePortrait = getPortrait(me?.avatar ?? session?.avatar);
  const you: OpponentData = {
    id: session?.playerId ?? "me",
    name: me?.nickname ?? session?.nickname ?? "Ty",
    avatar: mePortrait.src,
    cardCount: hand.length,
    isTurn: myTurn,
    rank: (me?.seat ?? session?.seat ?? 0) + 1,
    wins: me?.stats?.wins ?? 0,
    gamesPlayed: me?.stats?.games_played ?? 0,
    cardsPlayed: me?.stats?.cards_played ?? 0,
    cardsDrawn: me?.stats?.cards_drawn ?? 0,
    chips: 0,
    accent: mePortrait.accent,
  };

  useEffect(() => {
    if (room?.status === "waiting") navigate({ to: "/waiting", search: { code: room.code } });
  }, [room?.status, room?.code, navigate]);

  useEffect(() => {
    setDealt(false);
    const t = setTimeout(() => setDealt(true), hand.length * 70 + 600);
    return () => clearTimeout(t);
  }, [hand.length]);

  useEffect(() => {
    if (!aceSkip || aceSkipToastRef.current === aceSkip.actionId) return;
    aceSkipToastRef.current = aceSkip.actionId;
    toast.info(
      `${aceSkip.actingPlayer.nickname} zahrál/a eso. ${aceSkip.skippedPlayer.nickname} stojí.`,
    );
  }, [aceSkip]);

  const canAct =
    !!session &&
    !!gameState &&
    myTurn &&
    !busyAction &&
    !gameFinished &&
    gameState.status === "playing";
  const selectedCard = selected === null ? null : (hand[selected] ?? null);
  const selectedPlayable =
    !!selectedCard &&
    (pendingDraw > 0
      ? selectedCard.rank === "7"
      : selectedCard.rank === "Q" ||
        selectedCard.suit === activeSuit ||
        selectedCard.rank === topDiscard.rank);

  const submitRematchVote = async (accepted: boolean) => {
    if (!session || !gameFinished || busyRematch) return;
    setBusyRematch(accepted ? "accept" : "decline");
    try {
      const result = accepted
        ? await callAcceptRematch({
            data: { playerId: session.playerId, sessionToken: session.sessionToken },
          })
        : await callDeclineRematch({
            data: { playerId: session.playerId, sessionToken: session.sessionToken },
          });
      if (result.started) {
        toast.success("Odveta začíná.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodařilo se uložit volbu odvety");
    } finally {
      setBusyRematch(null);
    }
  };

  const handleDraw = async () => {
    if (!session || !gameState || !canAct || busyActionRef.current) return;
    busyActionRef.current = true;
    setBusyAction("draw");
    try {
      await callDrawCard({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          actionId: createActionId(),
          expectedTurnVersion: gameState.turn_version,
        },
      });
      setSelected(null);
      setDrawNonce((n) => n + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Nepodařilo se líznout kartu";
      if (!/stale|not your turn/i.test(msg)) toast.error(msg);
    } finally {
      busyActionRef.current = false;
      setBusyAction(null);
    }
  };

  const submitPlay = async (cardIndex: number, chosenSuit?: Suit) => {
    if (!session || !gameState || !canAct || busyActionRef.current) return;
    busyActionRef.current = true;
    setBusyAction("play");
    setPlayingIdx(cardIndex);
    try {
      await callPlayCard({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          actionId: createActionId(),
          expectedTurnVersion: gameState.turn_version,
          cardIndex,
          chosenSuit,
        },
      });
      setSelected(null);
      setSuitPickerIndex(null);
      setPileNonce((n) => n + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Nepodařilo se zahrát kartu";
      if (!/stale|není.*tah|not your turn/i.test(msg)) toast.error(msg);
    } finally {
      window.setTimeout(() => setPlayingIdx(null), 320);
      busyActionRef.current = false;
      setBusyAction(null);
    }
  };

  const handlePlay = (i: number) => {
    if (!canAct) return;
    if (selected !== i) {
      setSelected(i);
      return;
    }
    const card = hand[i];
    if (
      !card ||
      (pendingDraw > 0
        ? card.rank !== "7"
        : card.rank !== "Q" && card.suit !== activeSuit && card.rank !== topDiscard.rank)
    ) {
      toast.error(
        pendingDraw > 0 ? "Musíš zahrát sedmu nebo líznout trest" : "Tuto kartu nelze zahrát",
      );
      return;
    }
    if (card.rank === "Q") {
      setSuitPickerIndex(i);
      return;
    }
    void submitPlay(i);
  };

  // Position helpers — seats sit ON the table rim, half of the portrait
  // above/beside the rail. Using percentage translate of the portrait itself
  // means they never get clipped regardless of viewport size.
  const seatPos: SeatPlacement[] =
    opponents.length === 1
      ? ["top"]
      : opponents.length === 2
        ? ["left", "right"]
        : ["left", "top", "right"];

  if (reconnectStatus === "missing-session" || reconnectStatus === "expired-session") {
    return (
      <RoomShell className="items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/40">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-[color:var(--gold)]" />
          <h1 className="text-lg font-bold text-foreground">
            {reconnectStatus === "missing-session" ? "Chybí uložená session" : "Session vypršela"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reconnectError ?? "Vrať se do lobby a připoj se ke hře znovu."}
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

  if (loading && !room) {
    return (
      <RoomShell className="items-center justify-center">
        <Loader2 className="m-auto h-6 w-6 animate-spin text-[color:var(--gold)]" />
      </RoomShell>
    );
  }

  return (
    <RoomShell className="overflow-hidden">
      <TopNav onLeave={handleLeave} leaving={leaving} />

      <div className="flex flex-1 lg:flex-row flex-col min-h-0">
        <main className="game-stage relative flex-1 flex flex-col min-h-0">
          {/* === Center play area: reserves room for top/side seats === */}
          <div className="relative flex-1 min-h-0 grid place-items-center px-6 sm:px-10 lg:px-14 pt-10 sm:pt-12 pb-2">
            <div className="relative w-full h-full max-w-[58rem] xl:max-w-[64rem] max-h-full">
              {/* Sized box: aspect ratio constrained to available space */}
              <div
                className="relative mx-auto h-full"
                style={{ aspectRatio: "16 / 10", maxWidth: "100%" }}
              >
                {/* Outer rail */}
                <div
                  aria-hidden
                  className="absolute -inset-5 sm:-inset-7 rounded-[44px] sm:rounded-[60px] pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, oklch(0.29 0.035 70) 0%, oklch(0.16 0.025 70) 36%, oklch(0.075 0.015 80) 72%, oklch(0.045 0.012 120) 100%)",
                    boxShadow:
                      "inset 0 4px 0 oklch(1 0 0 / 0.10), inset 0 -7px 0 oklch(0 0 0 / 0.82), inset 0 0 0 1px oklch(0.82 0.14 85 / 0.24), inset 0 0 0 8px oklch(0 0 0 / 0.22), inset 0 0 46px oklch(0 0 0 / 0.70), 0 30px 80px -22px oklch(0 0 0 / 0.95)",
                  }}
                />
                {/* Inner gold piping */}
                <div
                  aria-hidden
                  className="absolute -inset-1.5 rounded-[32px] sm:rounded-[44px] pointer-events-none"
                  style={{
                    boxShadow:
                      "inset 0 0 0 1px oklch(0.82 0.14 85 / 0.38), inset 0 0 0 4px oklch(0 0 0 / 0.28)",
                  }}
                />
                {/* Felt */}
                <div
                  className="felt-table relative h-full w-full rounded-[24px] sm:rounded-[36px]"
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at center, color-mix(in oklab, var(--primary) 10%, transparent) 0%, transparent 62%)",
                  }}
                >
                  {/* HUD: turn + suit */}
                  <div className="absolute top-2 left-2 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-2 py-0.5 ring-1 ring-white/8">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--gold)] opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
                    </span>
                    <span className="text-[10px] font-semibold truncate max-w-[5rem]">
                      {activePlayer?.nickname ?? you.name}
                    </span>
                    <span className="h-3 w-px bg-white/10" />
                    <Timer className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                      0:18
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-2 py-0.5 ring-1 ring-white/8">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      Barva
                    </span>
                    <div className="rounded-full bg-[color:var(--gold)]/10 ring-1 ring-[color:var(--gold)]/35 px-1 py-0.5">
                      <SuitBadge suit={activeSuit} size="sm" />
                    </div>
                  </div>

                  {pendingDraw > 0 && (
                    <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-red-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-100 ring-1 ring-red-400/40 shadow-lg shadow-red-950/50 backdrop-blur-md">
                      Trest: lízni {pendingDraw} nebo zahraj 7
                    </div>
                  )}

                  {suitPickerIndex !== null && (
                    <div className="absolute inset-x-6 top-1/2 z-30 -translate-y-1/2 rounded-3xl border border-[color:var(--gold)]/35 bg-black/75 p-4 text-center shadow-2xl shadow-black/60 backdrop-blur-md sm:inset-x-16">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">
                        Vyber barvu
                      </div>
                      <div className="mt-3 flex justify-center gap-2">
                        {SUITS.map((suit) => (
                          <button
                            key={suit}
                            type="button"
                            className="rounded-full bg-[color:var(--gold)]/10 px-3 py-2 ring-1 ring-[color:var(--gold)]/35 transition hover:bg-[color:var(--gold)]/20"
                            onClick={() => void submitPlay(suitPickerIndex, suit)}
                            disabled={!canAct}
                          >
                            <SuitBadge suit={suit} size="sm" />
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() => setSuitPickerIndex(null)}
                      >
                        Zrušit
                      </button>
                    </div>
                  )}

                  <div className="table-spotlight" aria-hidden="true" />

                  {aceSkip && (
                    <div className="absolute inset-x-6 top-12 z-20 rounded-3xl border border-[color:var(--gold)]/35 bg-black/70 px-4 py-3 text-center shadow-2xl shadow-black/50 backdrop-blur-md sm:inset-x-16">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">
                        Eso — stojí
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {aceSkip.skippedPlayer.nickname} je přeskočen/a.
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {aceSkip.actingPlayer.nickname} zahrál/a A, tah pokračuje dál.
                      </div>
                    </div>
                  )}

                  {gameFinished && (
                    <div className="absolute inset-x-6 top-1/2 z-20 -translate-y-1/2 rounded-3xl border border-[color:var(--gold)]/30 bg-black/70 p-4 text-center shadow-2xl shadow-black/60 backdrop-blur-md sm:inset-x-16">
                      <Trophy className="mx-auto mb-2 h-6 w-6 text-[color:var(--gold)]" />
                      <div className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--gold)]">
                        Hra dohrána
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {winner ? `${winner.nickname} vyhrál/a partii.` : "Partie byla ukončena."}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Odveta: {acceptedRematchCount}/{rematchVoteTotal} připojených hráčů
                        souhlasí.
                      </div>
                      <div className="mt-3 flex justify-center gap-2">
                        <RoomButton
                          size="sm"
                          variant="primary"
                          onClick={() => void submitRematchVote(true)}
                          disabled={busyRematch !== null || myRematchVote === true}
                          loading={busyRematch === "accept"}
                        >
                          {myRematchVote === true ? "Souhlas odeslán" : "Chci odvetu"}
                        </RoomButton>
                        <RoomButton
                          size="sm"
                          variant="secondary"
                          onClick={() => void submitRematchVote(false)}
                          disabled={busyRematch !== null || myRematchVote === false}
                          loading={busyRematch === "decline"}
                        >
                          Ne teď
                        </RoomButton>
                      </div>
                    </div>
                  )}

                  {/* Center: deck + pile */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="center-stage relative z-[1] flex items-center gap-6 sm:gap-10">
                      <button
                        type="button"
                        onClick={() => void handleDraw()}
                        disabled={!canAct}
                        className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl p-1 -m-1 transition active:scale-95 disabled:opacity-60"
                        aria-label="Lízni"
                      >
                        <CardStack
                          key={drawNonce}
                          count={gameState?.deck.length ?? 0}
                          maxVisible={3}
                          size="md"
                          layout="stack"
                          className={drawNonce ? "animate-card-draw" : ""}
                        />
                        <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80 tabular-nums">
                          {pendingDraw > 0
                            ? `Trest · ${pendingDraw}`
                            : `Balíček · ${gameState?.deck.length ?? 0}`}
                        </span>
                      </button>

                      <div className="flex flex-col items-center gap-2">
                        <div key={pileNonce} className={pileNonce ? "animate-pile-bump" : ""}>
                          <DiscardPile cards={discardPile} size="md" recent />
                        </div>
                        <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                          Odhoz
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* === Seats anchored to the table rim ===
                    Each portrait translates by 50% of its own size so it sits
                    half on the rail, half outside — guaranteed visible.
                */}
                {opponents.map((p, i) => {
                  const pos = seatPos[i] ?? "top";
                  const cls =
                    pos === "top"
                      ? "top-0 left-1/2 -translate-x-1/2 -translate-y-[50%]"
                      : pos === "left"
                        ? "left-0 top-1/2 -translate-x-[18%] sm:-translate-x-[30%] -translate-y-1/2"
                        : "right-0 top-1/2 translate-x-[18%] sm:translate-x-[30%] -translate-y-1/2";
                  return (
                    <div key={p.id} className={cn("absolute z-30 pointer-events-auto", cls)}>
                      <Opponent player={p} placement={pos} compactMobile />
                    </div>
                  );
                })}

                {/* Self seat — just the portrait sitting on bottom rail. The
                    user's hand + nickname is at the bottom; a duplicate info
                    panel would steal space from the action buttons. */}
                <div className="absolute z-30 left-1/2 bottom-0 -translate-x-1/2 translate-y-[40%] pointer-events-none">
                  <div className="flex flex-col items-center">
                    <img
                      src={you.avatar}
                      alt={you.name}
                      draggable={false}
                      className="h-20 w-16 object-contain object-bottom drop-shadow-[0_10px_16px_rgba(0,0,0,0.6)] sm:h-24 sm:w-20"
                      style={{
                        filter: `drop-shadow(0 0 8px ${you.accent})`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === Bottom hand area === */}
          <div className="relative z-20 shrink-0 bg-gradient-to-t from-background via-background/85 to-transparent pb-safe pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
                  myTurn
                    ? "bg-gradient-to-r from-[color:var(--gold)]/25 to-transparent text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/40"
                    : "bg-white/5 text-muted-foreground ring-1 ring-white/8",
                )}
              >
                <Sparkles className="h-3 w-3" />
                {gameFinished ? "Dohráno" : myTurn ? "Tvůj tah" : "Čekej"}
              </span>

              <div className="flex items-center gap-2">
                <RoomButton
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleDraw()}
                  disabled={!canAct}
                  loading={busyAction === "draw"}
                >
                  {pendingDraw > 0 ? `Lízni ${pendingDraw}` : "Lízni"}
                </RoomButton>
                <RoomButton
                  size="sm"
                  variant="primary"
                  disabled={!canAct || selected === null || !selectedPlayable}
                  loading={busyAction === "play"}
                  onClick={() => {
                    if (selected === null) return;
                    if (hand[selected]?.rank === "Q") {
                      setSuitPickerIndex(selected);
                      return;
                    }
                    void submitPlay(selected);
                  }}
                >
                  Zahraj
                </RoomButton>
              </div>
            </div>

            <div className="fan-hand hand-scroll relative flex items-end justify-center overflow-x-auto sm:overflow-visible no-scrollbar px-4 pt-1 pb-1 min-h-[4.5rem] sm:min-h-[5.2rem]">
              {hand.map((card, i) => {
                const n = hand.length;
                const mid = (n - 1) / 2;
                const offset = i - mid;
                const spread = Math.min(7, 26 / Math.max(n, 1));
                const rot = offset * spread;
                const arc = offset * offset * 1.6;
                const isSelected = selected === i;
                return (
                  <div
                    key={i}
                    className="fan-card-wrap group relative shrink-0 transition-transform duration-300 ease-out will-change-transform"
                    style={{
                      transform: isSelected
                        ? `translateY(-22px) rotate(${rot * 0.3}deg) scale(1.06)`
                        : `translateY(${arc}px) rotate(${rot}deg)`,
                      transformOrigin: "bottom center",
                      zIndex: isSelected ? 50 : 10 + i,
                      marginLeft: i === 0 ? 0 : "-1.9rem",
                    }}
                  >
                    <div className="transition-transform duration-300 ease-out group-hover:-translate-y-5 group-hover:scale-[1.05] group-focus-within:-translate-y-5 group-active:translate-y-0 group-active:scale-95">
                      <PlayingCard
                        card={card}
                        size="md"
                        state={
                          myTurn && (pendingDraw === 0 || card.rank === "7") ? "idle" : "disabled"
                        }
                        animation={playingIdx === i ? "play" : !dealt ? "deal" : undefined}
                        animationDelay={!dealt ? i * 70 : undefined}
                        onClick={() => handlePlay(i)}
                        className={cn(
                          "shrink-0 shadow-xl shadow-black/50 cursor-pointer",
                          isSelected && "ring-2 ring-[color:var(--gold)] glow-primary",
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <ChatPanel messages={messages} session={session} />
      </div>
    </RoomShell>
  );
}
