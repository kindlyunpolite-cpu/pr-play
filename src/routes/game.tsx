import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";

import { Opponent, type OpponentData, type SeatPlacement } from "@/components/Opponent";
import { RoomShell } from "@/components/ui-room/RoomShell";
import { RoomButton } from "@/components/ui-room/RoomButton";
import { HudCountdown } from "@/components/ui-room/HudPanel";
import {
  PlayingCard,
  CardStack,
  DiscardPile,
  SuitBadge,
  type CardData,
  type Suit,
} from "@/components/cards";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Loader2, Trophy } from "lucide-react";
import { SUIT_LABEL, isRedSuit } from "@/components/cards/types";
import { SuitIcon } from "@/components/cards/SuitIcon";
import { cn } from "@/lib/utils";
import { getPortrait, PORTRAITS } from "@/lib/portraits";
import { useReconnect } from "@/hooks/use-reconnect";
import { useRoomRealtime } from "@/hooks/use-room-realtime";
import type { GameActionEvent, RoomPlayer } from "@/types/room";
import {
  acceptRematch,
  declineRematch,
  drawCard,
  playCard,
  applyTurnTimeout,
  updateTurnTimerMode,
  leaveRoom,
} from "@/lib/rooms.functions";
import { clearSession, loadSession } from "@/lib/room-session";
import { toast } from "sonner";
import { createGameActionEvent, isCardPlayable } from "@/lib/game-actions";
import { triggerAiTurn } from "@/lib/ai-player";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [{ title: "Stůl — Prší" }, { name: "description", content: "Živá hra Prší u stolu." }],
  }),
  component: Game,
});

const FALLBACK_CARD: CardData = { suit: "hearts", rank: "10" };
const PLAY_ANIMATION_MS = 320;

function stableCardId(card: CardData) {
  return card.id ?? `${card.rank}-${card.suit}`;
}

function sameCard(a: CardData | null | undefined, b: CardData | null | undefined) {
  if (!a || !b) return false;
  if (a.id || b.id) return a.id === b.id;
  return a.rank === b.rank && a.suit === b.suit;
}
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

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

function rotatePlayersFrom<T extends { id: string }>(players: T[], playerId: string | undefined) {
  if (!playerId || players.length === 0) return players;
  const index = players.findIndex((p) => p.id === playerId);
  if (index === -1) return players;
  return [...players.slice(index), ...players.slice(0, index)];
}

function createActionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();

  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(
    16,
  )}${hex(3)}-${hex(12)}`;
}

function cardLabel(card: CardData | null | undefined) {
  if (!card) return "";
  return `${SUIT_SYMBOL[card.suit]}${card.rank}`;
}

function playerName(players: RoomPlayer[], playerId: string | null | undefined) {
  return players.find((p) => p.id === playerId)?.nickname ?? "Hráč";
}

function actionText(action: GameActionEvent, players: RoomPlayer[]) {
  const name = playerName(players, action.playerId);
  if (action.type === "draw") {
    const count = action.drawCount ?? 1;
    return count > 1 ? `${name} líže ${count} karet` : `${name} líže kartu`;
  }
  if (action.type === "suit-change") {
    const suit = action.chosenSuit ? SUIT_LABEL[action.chosenSuit] : null;
    return `${name} odhodil svrška${suit ? ` a mění barvu na ${suit}` : ""}`;
  }
  if (action.type === "pass") return `${name} stojí`;
  return `${name} odhodil ${cardLabel(action.playedCard)}`;
}

function Game() {
  const navigate = useNavigate();
  const { session, status: reconnectStatus } = useReconnect();
  const code = session?.roomCode;
  const realtimeSession = reconnectStatus === "ready" ? session : null;
  const { room, players, messages, gameState, loading, resync } = useRoomRealtime(
    code,
    realtimeSession,
  );
  const callDrawCard = useServerFn(drawCard);
  const callPlayCard = useServerFn(playCard);
  const callApplyTurnTimeout = useServerFn(applyTurnTimeout);
  const callUpdateTurnTimerMode = useServerFn(updateTurnTimerMode);
  const callLeave = useServerFn(leaveRoom);
  const callAcceptRematch = useServerFn(acceptRematch);
  const callDeclineRematch = useServerFn(declineRematch);
  const callTriggerAiTurn = useServerFn(triggerAiTurn);
  const [leaving, setLeaving] = useState(false);
  const [busyRematch, setBusyRematch] = useState<"accept" | "decline" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timerModeBusy, setTimerModeBusy] = useState<"pause" | "enable" | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const refreshed = await resync();
      if (refreshed) toast.success("Hra obnovena");
      else toast.error("Nepodařilo se obnovit hru");
    } catch {
      toast.error("Nepodařilo se obnovit hru");
    } finally {
      setRefreshing(false);
    }
  };

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
  const [playingCard, setPlayingCard] = useState<{
    card: CardData;
    id: string;
    from: DOMRect;
    to: DOMRect;
  } | null>(null);
  const [pileNonce, setPileNonce] = useState(0);
  const [drawNonce, setDrawNonce] = useState(0);
  const [dealt, setDealt] = useState(false);
  const [busyAction, setBusyAction] = useState<"draw" | "play" | null>(null);
  const [suitPickerIndex, setSuitPickerIndex] = useState<number | null>(null);
  const [visibleActionId, setVisibleActionId] = useState<string | null>(null);
  const [pulsingPlayerId, setPulsingPlayerId] = useState<string | null>(null);

  const busyActionRef = useRef(false);
  const handCardRefs = useRef(new Map<string, HTMLDivElement>());
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const aceSkipToastRef = useRef<string | null>(null);
  const aiTriggerRef = useRef<string | null>(null);
  const timeoutTriggerRef = useRef<string | null>(null);

  const updateTimerMode = async (
    next: { enabled?: boolean; paused?: boolean },
    busy: "pause" | "enable",
  ) => {
    if (!session) return;
    setTimerModeBusy(busy);
    try {
      await callUpdateTurnTimerMode({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          ...next,
        },
      });
      await resync();
    } catch (error) {
      console.debug("[game] timer mode update failed", error);
      toast.error("Časovač se nepodařilo upravit.");
    } finally {
      setTimerModeBusy(null);
    }
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.seat - b.seat), [players]);
  const rotatedPlayers = useMemo(
    () => rotatePlayersFrom(sortedPlayers, session?.playerId),
    [sortedPlayers, session?.playerId],
  );
  const me = useMemo(
    () => sortedPlayers.find((p) => p.id === session?.playerId) ?? null,
    [sortedPlayers, session?.playerId],
  );
  const hand = session ? (gameState?.hands[session.playerId] ?? []) : [];
  const topDiscard = gameState?.discard_pile.at(-1) ?? FALLBACK_CARD;
  const visibleHand = playingCard
    ? hand.filter((card) => stableCardId(card) !== playingCard.id)
    : hand;
  const visibleDiscardCards =
    playingCard &&
    gameState?.discard_pile.length &&
    sameCard(gameState.discard_pile.at(-1), playingCard.card)
      ? gameState.discard_pile.slice(0, -1)
      : (gameState?.discard_pile ?? []);
  const visibleTopDiscard = visibleDiscardCards.at(-1) ?? topDiscard;
  const discardPile: [CardData, ...CardData[]] = visibleDiscardCards.length
    ? [visibleDiscardCards[0] ?? visibleTopDiscard, ...visibleDiscardCards.slice(1)]
    : [topDiscard];
  const activeSuit = gameState?.active_suit ?? topDiscard.suit;
  const pendingDraw = gameState?.pending_draw ?? 0;
  const turnDeadlineMs = gameState?.turn_deadline_at
    ? Date.parse(gameState.turn_deadline_at)
    : Number.NaN;
  const turnStartedMs = gameState?.turn_started_at
    ? Date.parse(gameState.turn_started_at)
    : Number.NaN;
  const turnDurationMs =
    gameState?.turn_timer_duration_ms ??
    (Number.isFinite(turnDeadlineMs) && Number.isFinite(turnStartedMs)
      ? Math.max(0, turnDeadlineMs - turnStartedMs)
      : 30_000);
  const timerEnabled = gameState?.turn_timer_enabled ?? true;
  const timerPaused = gameState?.turn_timer_paused ?? false;
  const turnRemainingMs = timerPaused
    ? (gameState?.turn_remaining_ms ?? turnDurationMs)
    : Number.isFinite(turnDeadlineMs)
      ? turnDeadlineMs - nowMs
      : (gameState?.turn_remaining_ms ?? 0);
  const myTurn =
    gameState?.status === "playing" && gameState?.current_player_id === session?.playerId;
  const activePlayer = players.find((p) => p.id === gameState?.current_player_id) ?? me;
  const latestAction = useMemo(() => {
    if (!gameState?.last_action_id || !gameState.last_action_player_id) return null;
    const action = createGameActionEvent({
      actionId: gameState.last_action_id,
      playerId: gameState.last_action_player_id,
      signature: gameState.last_action_signature,
      at: gameState.updated_at,
    });
    if (!action) return null;
    if (action.type !== "draw" && !action.playedCard) {
      const withCard: GameActionEvent = { ...action, playedCard: topDiscard ?? null };
      return withCard;
    }
    return action;
  }, [
    gameState?.last_action_id,
    gameState?.last_action_player_id,
    gameState?.last_action_signature,
    gameState?.updated_at,
    topDiscard,
  ]);
  const showLatestAction =
    latestAction && latestAction.id === visibleActionId ? latestAction : null;
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
      sortedPlayers,
      gameState.last_action_player_id,
      gameState.direction,
    );
    const skippedPlayer = sortedPlayers.find((p) => p.id === skippedPlayerId);
    const actingPlayer = sortedPlayers.find((p) => p.id === gameState.last_action_player_id);
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
    sortedPlayers,
    topDiscard.rank,
  ]);

  const opponents: OpponentData[] = useMemo(
    () =>
      rotatedPlayers
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
            badge: p.is_ai ? "AI" : undefined,
            actionPulse:
              pulsingPlayerId === p.id
                ? latestAction?.type === "draw"
                  ? "draw"
                  : latestAction?.type === "play" || latestAction?.type === "suit-change"
                    ? "play"
                    : undefined
                : undefined,
          };
        }),
    [
      gameState?.current_player_id,
      gameState?.hands,
      latestAction?.type,
      pulsingPlayerId,
      rotatedPlayers,
      session?.playerId,
    ],
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
    actionPulse:
      pulsingPlayerId === session?.playerId && latestAction?.type === "draw" ? "draw" : undefined,
  };

  useEffect(() => {
    if (room?.status === "waiting") navigate({ to: "/waiting", search: { code: room.code } });
  }, [room?.status, room?.code, navigate]);

  useEffect(() => {
    if (reconnectStatus === "missing-session" || reconnectStatus === "expired-session") {
      // useReconnect starts as "missing-session" before its mount effect can
      // validate localStorage. If a room session exists, wait instead of
      // bouncing a freshly-started game back to the lobby.
      if (typeof window !== "undefined" && loadSession()) return;
      navigate({ to: "/", replace: true });
    }
  }, [navigate, reconnectStatus]);

  useEffect(() => {
    if (!gameState?.current_player_id) return;
    console.debug("[game] active player changed", {
      playerId: gameState.current_player_id,
      nickname: activePlayer?.nickname,
      isAi: activePlayer?.is_ai ?? false,
      turnVersion: gameState.turn_version,
    });
  }, [
    activePlayer?.is_ai,
    activePlayer?.nickname,
    gameState?.current_player_id,
    gameState?.turn_version,
  ]);

  useEffect(() => {
    if (!room?.id || gameState?.status !== "playing" || !gameState.current_player_id) return;
    const current = players.find((p) => p.id === gameState.current_player_id);
    if (!current?.is_ai) return;

    const triggerKey = `${gameState.current_player_id}:${gameState.turn_version}`;
    if (aiTriggerRef.current === triggerKey) return;
    aiTriggerRef.current = triggerKey;

    void callTriggerAiTurn({ data: { roomId: room.id } }).catch((error) => {
      console.debug("[AI] trigger failed", {
        roomId: room.id,
        playerId: gameState.current_player_id,
        turnVersion: gameState.turn_version,
        error,
      });
      aiTriggerRef.current = null;
    });
  }, [
    callTriggerAiTurn,
    gameState?.current_player_id,
    gameState?.status,
    gameState?.turn_version,
    players,
    room?.id,
  ]);

  useEffect(() => {
    if (
      !room?.id ||
      gameState?.status !== "playing" ||
      !gameState.current_player_id ||
      !timerEnabled ||
      timerPaused ||
      !gameState.turn_deadline_at
    ) {
      return;
    }

    const deadlineMs = Date.parse(gameState.turn_deadline_at);
    if (!Number.isFinite(deadlineMs)) return;

    const triggerKey = `${room.id}:${gameState.current_player_id}:${gameState.turn_version}:${gameState.turn_deadline_at}`;
    const delayMs = Math.max(0, deadlineMs - Date.now() + 250);

    const timeoutId = window.setTimeout(() => {
      if (timeoutTriggerRef.current === triggerKey) return;
      timeoutTriggerRef.current = triggerKey;

      void callApplyTurnTimeout({ data: { roomId: room.id } })
        .then((result) => {
          if (
            result &&
            (("notExpired" in result && result.notExpired) ||
              ("timerInactive" in result && result.timerInactive))
          ) {
            timeoutTriggerRef.current = null;
          }
          return resync();
        })
        .catch((error) => {
          console.debug("[game] turn timeout trigger failed", {
            roomId: room.id,
            playerId: gameState.current_player_id,
            turnVersion: gameState.turn_version,
            turnDeadlineAt: gameState.turn_deadline_at,
            error,
          });
          timeoutTriggerRef.current = null;
        });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    callApplyTurnTimeout,
    gameState?.current_player_id,
    gameState?.status,
    gameState?.turn_deadline_at,
    timerEnabled,
    timerPaused,
    gameState?.turn_version,
    resync,
    room?.id,
  ]);

  useEffect(() => {
    if (!latestAction) return;

    console.debug("[game] last action updated", latestAction);
    setVisibleActionId(latestAction.id);
    setPulsingPlayerId(latestAction.playerId);

    if (latestAction.type === "draw") setDrawNonce((n) => n + 1);
    if (latestAction.type === "play" || latestAction.type === "suit-change") {
      setPileNonce((n) => n + 1);
    }

    const hideAction = window.setTimeout(() => setVisibleActionId(null), 4_500);
    const stopPulse = window.setTimeout(() => setPulsingPlayerId(null), 260);
    return () => {
      window.clearTimeout(hideAction);
      window.clearTimeout(stopPulse);
    };
  }, [latestAction?.id]);

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
    !playingCard &&
    !gameFinished &&
    gameState.status === "playing";

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
    const card = hand[cardIndex];
    if (!card) return;
    const id = stableCardId(card);
    const from = handCardRefs.current.get(id)?.getBoundingClientRect();
    const to = discardPileRef.current?.getBoundingClientRect();
    if (!from || !to) return;
    busyActionRef.current = true;
    setBusyAction("play");
    setPlayingCard({ card, id, from, to });
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
      window.setTimeout(() => {
        setPlayingCard(null);
        busyActionRef.current = false;
        setBusyAction(null);
      }, PLAY_ANIMATION_MS);
    }
  };

  const handlePlay = (i: number) => {
    if (!canAct || playingCard) return;
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
      <RoomShell className="items-center justify-center">
        <Loader2 className="m-auto h-6 w-6 animate-spin text-[color:var(--gold)]" />
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
      <TopNav
        roomCode={code}
        onLeave={handleLeave}
        leaving={leaving}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
      />

      <div className="flex flex-1 lg:flex-row flex-col min-h-0">
        <main className="game-stage relative flex-1 flex flex-col min-h-0">
          {/* === Center play area: reserves room for top/side seats === */}
          <div className="relative flex-1 min-h-0 grid place-items-center px-6 sm:px-10 lg:px-14 pt-10 sm:pt-12 pb-0">
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
                  {/* HUD is integrated into player seats and the discard pile —
                      no detached floating panels around the table. */}

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

                  {showLatestAction && (
                    <div className="pointer-events-none absolute inset-x-4 top-[38%] z-20 flex justify-center">
                      <div className="animate-last-action rounded-full border border-[color:var(--gold)]/35 bg-black/72 px-4 py-2 text-center text-sm font-semibold text-foreground shadow-2xl shadow-black/60 backdrop-blur-md">
                        {actionText(showLatestAction, players)}
                      </div>
                    </div>
                  )}

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

                  {me?.is_host && gameState?.status === "playing" && (
                    <div className="absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-2 py-1 shadow-lg shadow-black/35 backdrop-blur-md">
                      <RoomButton
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void updateTimerMode({ paused: !timerPaused, enabled: true }, "pause")
                        }
                        disabled={!timerEnabled || timerModeBusy !== null}
                        loading={timerModeBusy === "pause"}
                        className="px-2 py-1 text-[10px]"
                      >
                        {timerPaused ? "Pokračovat" : "Pozastavit"}
                      </RoomButton>
                      <RoomButton
                        size="sm"
                        variant={timerEnabled ? "secondary" : "primary"}
                        onClick={() =>
                          void updateTimerMode(
                            timerEnabled ? { enabled: false } : { enabled: true, paused: false },
                            "enable",
                          )
                        }
                        disabled={timerModeBusy !== null}
                        loading={timerModeBusy === "enable"}
                        className="px-2 py-1 text-[10px]"
                      >
                        {timerEnabled ? "Vypnout čas" : "Zapnout čas"}
                      </RoomButton>
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
                      <div className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDraw()}
                          disabled={!canAct}
                          className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl p-1 -m-1 transition active:scale-95 disabled:opacity-60"
                          aria-label="Vezmi kartu"
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
                        {/* Draw action attached to the deck */}
                        <RoomButton
                          size="sm"
                          variant={pendingDraw > 0 ? "primary" : "secondary"}
                          onClick={() => void handleDraw()}
                          disabled={!canAct}
                          loading={busyAction === "draw"}
                          className="min-w-[5.5rem] px-3 py-1 text-[11px]"
                        >
                          {pendingDraw > 0 ? `Vezmi ${pendingDraw}` : "Vezmi"}
                        </RoomButton>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <div
                          key={pileNonce}
                          ref={discardPileRef}
                          className={cn(
                            "relative",
                            pileNonce && !playingCard && "animate-pile-bump",
                          )}
                        >
                          <DiscardPile
                            cards={discardPile}
                            size="md"
                            recent={!playingCard && Boolean(pileNonce)}
                          />
                          {/* Current suit marker — placed outside the card, above and to the right. */}
                          <div
                            aria-label={`Aktivní barva: ${SUIT_LABEL[activeSuit]}`}
                            className={cn(
                              "absolute -top-9 -right-9 z-[3] flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--card-face)] ring-[1.5px] ring-[color:var(--gold)]/55 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.7)]",
                              isRedSuit(activeSuit)
                                ? "text-[color:var(--suit-red)]"
                                : "text-[color:var(--suit-dark)]",
                            )}
                          >
                            <SuitIcon suit={activeSuit} className="h-5 w-5" />
                          </div>
                        </div>
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
                      <div
                        key={p.isTurn ? `turn-${gameState?.turn_version ?? 0}` : "idle"}
                        className={cn("rounded-2xl", p.isTurn && "animate-turn-arrive")}
                      >
                        <Opponent
                          player={p}
                          placement={pos}
                          compactMobile
                          turnRemainingMs={p.isTurn && timerEnabled ? turnRemainingMs : undefined}
                          turnDurationMs={p.isTurn ? turnDurationMs : undefined}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Self seat — compact portrait sitting on bottom rail.
                    Kept small so the hand gets the visual priority. */}
                <div className="absolute z-30 left-1/2 bottom-0 -translate-x-1/2 translate-y-[10%] pointer-events-none">
                  <div className="flex flex-col items-center">
                    <div
                      key={you.isTurn ? `me-turn-${gameState?.turn_version ?? 0}` : "me-idle"}
                      className={cn(
                        "relative rounded-full transition-all duration-300",
                        you.isTurn &&
                          "ring-2 ring-[color:var(--gold)]/80 animate-turn animate-turn-arrive",
                        (you.actionPulse === "draw" || you.actionPulse === "play") &&
                          "animate-seat-action-pulse",
                      )}
                    >
                      {you.isTurn && timerEnabled && (
                        <div className="absolute -top-9 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[color:var(--gold)]/55 bg-black/80 pl-1 pr-2 py-0.5 shadow-lg shadow-black/40">
                          <HudCountdown remainingMs={turnRemainingMs} durationMs={turnDurationMs} />
                          <span className="whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.14em] text-[color:var(--gold)]">
                            Na tahu
                          </span>
                        </div>
                      )}
                      <img
                        src={you.avatar}
                        alt={you.name}
                        draggable={false}
                        className="h-14 w-12 object-contain object-bottom drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)] sm:h-16 sm:w-14"
                        style={{
                          filter: you.isTurn
                            ? `drop-shadow(0 0 14px ${you.accent}) drop-shadow(0 8px 14px rgba(0,0,0,0.6))`
                            : `drop-shadow(0 0 6px ${you.accent})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {playingCard && (
            <div
              className="pointer-events-none fixed z-[100]"
              style={
                {
                  left: 0,
                  top: 0,
                  "--play-from-x": `${playingCard.from.left}px`,
                  "--play-from-y": `${playingCard.from.top}px`,
                  "--play-to-x": `${playingCard.to.left + (playingCard.to.width - playingCard.from.width) / 2}px`,
                  "--play-to-y": `${playingCard.to.top + (playingCard.to.height - playingCard.from.height) / 2}px`,
                } as CSSProperties
              }
            >
              <PlayingCard
                card={playingCard.card}
                size="md"
                className="animate-card-play-to-discard shadow-2xl shadow-black/70"
              />
            </div>
          )}

          {/* === Bottom hand area === */}
          <div className="relative z-20 shrink-0 bg-gradient-to-t from-background via-background/85 to-transparent pb-safe pt-6 sm:pt-8">
            <div className="fan-hand hand-scroll relative flex items-end justify-center overflow-x-auto sm:overflow-visible no-scrollbar px-4 pt-8 pb-1 min-h-[5.5rem] sm:min-h-[6.2rem]">
              {visibleHand.map((card, visibleIndex) => {
                const originalIndex = hand.findIndex((handCard) => sameCard(handCard, card));
                const i = originalIndex < 0 ? visibleIndex : originalIndex;
                const cardId = stableCardId(card);
                const n = visibleHand.length;
                const mid = (n - 1) / 2;
                const offset = visibleIndex - mid;
                const spread = Math.min(7, 26 / Math.max(n, 1));
                const rot = offset * spread;
                const arc = offset * offset * 1.6;
                const isSelected = selected === i;
                const playable =
                  myTurn && isCardPlayable(card, topDiscard, activeSuit, pendingDraw);
                const cardState = isSelected
                  ? "selected"
                  : playable
                    ? "playable"
                    : myTurn
                      ? "disabled"
                      : "idle";
                const showPlay = isSelected && playable && canAct;
                return (
                  <div
                    key={cardId}
                    ref={(node) => {
                      if (node) handCardRefs.current.set(cardId, node);
                      else handCardRefs.current.delete(cardId);
                    }}
                    className={cn(
                      "fan-card-wrap group relative shrink-0 transition-transform duration-150 ease-out will-change-transform",
                      playable && "hover:z-40",
                    )}
                    style={{
                      transform: isSelected
                        ? `translateY(-26px) rotate(${rot * 0.3}deg) scale(1.06)`
                        : `translateY(${arc}px) rotate(${rot}deg)`,
                      transformOrigin: "bottom center",
                      zIndex: isSelected ? 50 : 10 + visibleIndex,
                      marginLeft: visibleIndex === 0 ? 0 : "-1.9rem",
                    }}
                  >
                    <PlayingCard
                      card={card}
                      size="md"
                      state={cardState}
                      animation={!dealt ? "deal" : undefined}
                      animationDelay={!dealt ? visibleIndex * 70 : undefined}
                      onClick={() => handlePlay(i)}
                      className="shrink-0 shadow-xl shadow-black/50"
                    />
                    {showPlay && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (card.rank === "Q") {
                            setSuitPickerIndex(i);
                            return;
                          }
                          void submitPlay(i);
                        }}
                        disabled={busyAction === "play"}
                        className="absolute left-1/2 -top-7 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--gold)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary-foreground)] shadow-lg shadow-black/60 animate-scale-in transition active:scale-95 disabled:opacity-60"
                      >
                        Zahraj
                      </button>
                    )}
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
