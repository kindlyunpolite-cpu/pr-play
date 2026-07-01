// AI player logic — kept separate from React components.
//
// Exposes server functions used by the lobby (addAiPlayer, fillWithAiPlayers)
// plus pure helpers (isAiTurn, pickAiAction) and a server-only runner
// (runAiTurn) that mutates game state when it is an AI's turn.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { CardData, Suit } from "@/components/cards";
import { PORTRAITS } from "./portraits";
import type { GameState, RoomEventType } from "@/types/room";
import { createVisibleActionSignature } from "@/lib/game-actions";

// ---------- Pure helpers (safe to import anywhere) ----------

export const AI_NAME_POOL = [
  "AI Karel",
  "AI Jana",
  "AI Bot",
  "AI Petr",
  "AI Eva",
  "AI Tomáš",
  "AI Lenka",
  "AI Honza",
];

export function isAiTurn(
  gameState: Pick<GameState, "current_player_id" | "status"> | null | undefined,
  players: { id: string; is_ai?: boolean | null }[],
): boolean {
  if (!gameState || gameState.status !== "playing" || !gameState.current_player_id) return false;
  const current = players.find((p) => p.id === gameState.current_player_id);
  return !!current?.is_ai;
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

function isPlayable(
  card: CardData,
  topCard: CardData,
  activeSuit: Suit | null,
  pendingDraw: number,
) {
  if (pendingDraw > 0) return card.rank === "7";
  if (card.rank === "Q") return true;
  return card.suit === (activeSuit ?? topCard.suit) || card.rank === topCard.rank;
}

/** Pick a basic action: first playable card (Q picks majority-suit), else draw. */
export function pickAiAction(
  hand: CardData[],
  topCard: CardData,
  activeSuit: Suit | null,
  pendingDraw: number,
): { kind: "play"; cardIndex: number; chosenSuit?: Suit } | { kind: "draw" } {
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (!isPlayable(card, topCard, activeSuit, pendingDraw)) continue;
    if (card.rank === "Q") {
      const counts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
      hand.forEach((c, j) => {
        if (j !== i) counts[c.suit]++;
      });
      const chosenSuit = SUITS.reduce((a, b) => (counts[b] > counts[a] ? b : a), "hearts" as Suit);
      return { kind: "play", cardIndex: i, chosenSuit };
    }
    return { kind: "play", cardIndex: i };
  }
  return { kind: "draw" };
}

// ---------- Server-only helpers ----------

const SUIT_NAMES: Record<Suit, string> = {
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
  spades: "Spades",
};

function cardEventLabel(card: CardData) {
  return `${card.rank} ${SUIT_NAMES[card.suit]}`;
}

function cardPlayedEventMessage(nickname: string, card: CardData, chosenSuit?: Suit | null) {
  return `${nickname} played ${cardEventLabel(card)}${
    chosenSuit ? ` and chose ${SUIT_NAMES[chosenSuit]}` : ""
  }`;
}

function eventActor(player: { id: string; nickname: string; seat: number }) {
  return { playerId: player.id, actorNickname: player.nickname, actorSeat: player.seat };
}

async function writeRoomEvent(input: {
  roomId: string;
  type: RoomEventType;
  playerId?: string | null;
  actorNickname?: string | null;
  actorSeat?: number | null;
  message: string;
  timestamp?: string;
}) {
  try {
    const { error } = await supabaseAdmin.from("room_events").insert({
      room_id: input.roomId,
      timestamp: input.timestamp ?? new Date().toISOString(),
      type: input.type,
      player_id: input.playerId ?? null,
      actor_nickname: input.actorNickname ?? null,
      actor_seat: input.actorSeat ?? null,
      message: input.message,
    });

    if (error) {
      console.debug("[room-events] failed to write AI room event", {
        roomId: input.roomId,
        type: input.type,
        playerId: input.playerId,
        error,
      });
    }
  } catch (error) {
    console.debug("[room-events] failed to write AI room event", {
      roomId: input.roomId,
      type: input.type,
      playerId: input.playerId,
      error,
    });
  }
}

function toCardArray(value: unknown): CardData[] {
  return Array.isArray(value) ? (value as CardData[]) : [];
}
function toHands(value: unknown): Record<string, CardData[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, CardData[]>;
}
function secureRandomIndex(maxInclusive: number) {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % (maxInclusive + 1);
}

function createServerActionId() {
  return globalThis.crypto.randomUUID();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aiThinkDelayMs() {
  return 1500 + secureRandomIndex(1000);
}

function shuffleDeck(deck: CardData[]) {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
function takeDrawableCards(deck: CardData[], discardPile: CardData[], count: number) {
  const cards: CardData[] = [];
  let nextDeck = [...deck];
  let nextDiscardPile = [...discardPile];
  for (let i = 0; i < count; i++) {
    if (nextDeck.length === 0 && nextDiscardPile.length > 1) {
      const topCard = nextDiscardPile.at(-1)!;
      nextDeck = shuffleDeck(nextDiscardPile.slice(0, -1));
      nextDiscardPile = [topCard];
    }
    const card = nextDeck.shift();
    if (!card) return { cards, deck: nextDeck, discardPile: nextDiscardPile, complete: false };
    cards.push(card);
  }
  return { cards, deck: nextDeck, discardPile: nextDiscardPile, complete: true };
}
function nextPlayerId(
  players: { id: string }[],
  currentPlayerId: string,
  direction: number,
  steps = 1,
) {
  const index = players.findIndex((p) => p.id === currentPlayerId);
  if (index === -1) throw new Error("Current player is no longer in the game");
  const step = direction === -1 ? -1 : 1;
  return players[(index + step * steps + players.length * steps) % players.length].id;
}

async function authenticateHost(playerId: string, sessionToken: string) {
  const { data: secret } = await supabaseAdmin
    .from("player_secrets")
    .select("player_id, session_token")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!secret || secret.session_token !== sessionToken) {
    throw new Error("Unauthorized");
  }
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) throw new Error("Player not found");
  if (!player.is_host) throw new Error("Only the host can manage AI players");
  return player;
}

async function pickAiIdentity(roomId: string) {
  const { data: existing } = await supabaseAdmin
    .from("players")
    .select("nickname, avatar")
    .eq("room_id", roomId);
  const takenNames = new Set((existing ?? []).map((p) => p.nickname.toLowerCase()));
  const takenAvatars = new Set((existing ?? []).map((p) => p.avatar).filter(Boolean) as string[]);
  let nickname = AI_NAME_POOL.find((n) => !takenNames.has(n.toLowerCase()));
  if (!nickname) {
    let i = 2;
    while (takenNames.has(`ai bot ${i}`)) i++;
    nickname = `AI Bot ${i}`;
  }
  const avatar =
    PORTRAITS.map((p) => p.id).find((id) => !takenAvatars.has(id)) ??
    PORTRAITS[Math.floor(Math.random() * PORTRAITS.length)].id;
  return { nickname, avatar };
}

async function insertAiPlayer(roomId: string) {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id, status, max_players")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Místnost neexistuje");
  if (room.status !== "waiting") throw new Error("AI lze přidat jen v čekárně");

  const { data: players } = await supabaseAdmin
    .from("players")
    .select("seat")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if ((players?.length ?? 0) >= room.max_players) throw new Error("Místnost je plná");

  const taken = new Set((players ?? []).map((p) => p.seat));
  let seat = 0;
  while (taken.has(seat) && seat < room.max_players) seat++;

  const { nickname, avatar } = await pickAiIdentity(roomId);

  const { data: player, error } = await supabaseAdmin
    .from("players")
    .insert({
      room_id: roomId,
      nickname,
      avatar,
      seat,
      is_ready: true,
      is_ai: true,
      connected: true,
    })
    .select("id, nickname, seat")
    .single();
  if (error || !player) throw new Error("Nepodařilo se přidat AI hráče");

  await writeRoomEvent({
    roomId,
    type: "player-joined",
    ...eventActor(player),
    message: `${player.nickname} joined room`,
  });
}

// ---------- Server functions ----------

const PlayerIdSchema = z.string().uuid();
const TokenSchema = z.string().min(8).max(128);

export const addAiPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const host = await authenticateHost(data.playerId, data.sessionToken);
    await insertAiPlayer(host.room_id);
    return { ok: true };
  });

export const fillWithAiPlayers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const host = await authenticateHost(data.playerId, data.sessionToken);
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, status, max_players")
      .eq("id", host.room_id)
      .maybeSingle();
    if (!room) throw new Error("Místnost neexistuje");
    if (room.status !== "waiting") throw new Error("AI lze přidat jen v čekárně");
    const { count } = await supabaseAdmin
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", host.room_id);
    const target = Math.min(4, room.max_players);
    const toAdd = Math.max(0, target - (count ?? 0));
    for (let i = 0; i < toAdd; i++) {
      await insertAiPlayer(host.room_id);
    }
    return { ok: true, added: toAdd };
  });

// ---------- AI turn runner (server-only) ----------

async function loadAiContext(roomId: string) {
  const { data: gameState } = await supabaseAdmin
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (!gameState || gameState.status !== "playing") return null;
  const { data: players } = await supabaseAdmin
    .from("players")
    .select("id, seat, nickname, is_ai")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (!players || players.length < 2) return null;
  const current = players.find((p) => p.id === gameState.current_player_id);
  if (!current?.is_ai) return null;
  return {
    gameState: {
      ...gameState,
      deck: toCardArray(gameState.deck),
      discard_pile: toCardArray(gameState.discard_pile),
      hands: toHands(gameState.hands),
      active_suit: gameState.active_suit as Suit | null,
      direction: gameState.direction === -1 ? -1 : 1,
      pending_draw: gameState.pending_draw ?? 0,
      turn_version: gameState.turn_version ?? 0,
    },
    players,
    current,
  };
}

/**
 * If the current player is an AI, perform one action (play or draw) and
 * advance the turn. Loops while subsequent players are also AI. Safe to call
 * after any successful human move; no-op when it isn't an AI's turn.
 */
export async function runAiTurn(roomId: string): Promise<void> {
  // Cap loop iterations to avoid runaway in pathological cases.
  for (let i = 0; i < 16; i++) {
    const ctx = await loadAiContext(roomId);
    if (!ctx) return;
    const { gameState, players, current } = ctx;
    const topCard = gameState.discard_pile.at(-1);
    if (!topCard) return;

    console.debug("[AI] active player changed", {
      roomId,
      playerId: current.id,
      turnVersion: gameState.turn_version,
    });
    const delayMs = aiThinkDelayMs();
    console.debug("[AI] turn delay started", {
      roomId,
      playerId: current.id,
      delayMs,
      turnVersion: gameState.turn_version,
    });
    await wait(delayMs);

    const freshCtx = await loadAiContext(roomId);
    if (!freshCtx || freshCtx.current.id !== current.id) return;
    const freshTopCard = freshCtx.gameState.discard_pile.at(-1);
    if (!freshTopCard) return;

    const freshGameState = freshCtx.gameState;
    const freshPlayers = freshCtx.players;
    const freshCurrent = freshCtx.current;
    const hand = [...(freshGameState.hands[freshCurrent.id] ?? [])];
    const decision = pickAiAction(
      hand,
      freshTopCard,
      freshGameState.active_suit,
      freshGameState.pending_draw,
    );
    const actionId = createServerActionId();
    const expectedTurnVersion = freshGameState.turn_version;
    const processedActions = {
      ...(freshGameState.processed_actions as Record<string, unknown>),
      [actionId]: { playerId: freshCurrent.id, signature: decision.kind },
    };

    if (decision.kind === "draw") {
      const drawCount = freshGameState.pending_draw > 0 ? freshGameState.pending_draw : 1;
      const draw = takeDrawableCards(freshGameState.deck, freshGameState.discard_pile, drawCount);
      const nextHands = { ...freshGameState.hands, [freshCurrent.id]: [...hand, ...draw.cards] };
      const visibleSignature = createVisibleActionSignature({
        type: "draw",
        drawCount: draw.cards.length,
      });
      const { data: updated } = await supabaseAdmin
        .from("game_states")
        .update({
          deck: draw.deck as unknown as Json,
          discard_pile: draw.discardPile as unknown as Json,
          hands: nextHands as unknown as Json,
          current_player_id: nextPlayerId(freshPlayers, freshCurrent.id, freshGameState.direction),
          pending_draw: 0,
          turn_version: expectedTurnVersion + 1,
          last_action_id: actionId,
          last_action_player_id: freshCurrent.id,
          last_action_signature: visibleSignature,
          processed_actions: processedActions as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId)
        .eq("turn_version", expectedTurnVersion)
        .select("room_id")
        .maybeSingle();
      if (!updated) return;
      await writeRoomEvent({
        roomId,
        type: "card-drawn",
        ...eventActor(freshCurrent),
        message: `${freshCurrent.nickname} drew ${
          draw.cards.length === 1 ? "a card" : `${draw.cards.length} cards`
        }`,
      });
      console.debug("[AI] action executed", {
        roomId,
        playerId: freshCurrent.id,
        action: "draw",
        drawCount: draw.cards.length,
        actionId,
      });
      console.debug("[game] last action updated", {
        roomId,
        playerId: freshCurrent.id,
        type: "draw",
        actionId,
      });
      await wait(1000);
      continue;
    }

    const [card] = hand.splice(decision.cardIndex, 1);
    if (!card) return;
    const discardPile = [...freshGameState.discard_pile, card];
    const pendingDraw = card.rank === "7" ? freshGameState.pending_draw + 2 : 0;
    const nextHands = { ...freshGameState.hands, [freshCurrent.id]: hand };
    const finished = hand.length === 0;
    const finishedAt = new Date().toISOString();
    const visibleSignature = createVisibleActionSignature({
      type: decision.chosenSuit ? "suit-change" : "play",
      card,
      cardIndex: decision.cardIndex,
      chosenSuit: decision.chosenSuit ?? card.suit,
    });
    const { data: updated } = await supabaseAdmin
      .from("game_states")
      .update({
        discard_pile: discardPile as unknown as Json,
        hands: nextHands as unknown as Json,
        current_player_id: finished
          ? freshCurrent.id
          : nextPlayerId(
              freshPlayers,
              freshCurrent.id,
              freshGameState.direction,
              card.rank === "A" ? 2 : 1,
            ),
        active_suit: decision.chosenSuit ?? card.suit,
        pending_draw: finished ? 0 : pendingDraw,
        status: finished ? "finished" : "playing",
        turn_version: expectedTurnVersion + 1,
        last_action_id: actionId,
        last_action_player_id: freshCurrent.id,
        last_action_signature: visibleSignature,
        processed_actions: processedActions as unknown as Json,
        updated_at: finishedAt,
      })
      .eq("room_id", roomId)
      .eq("turn_version", expectedTurnVersion)
      .select("room_id")
      .maybeSingle();
    if (!updated) return;

    await writeRoomEvent({
      roomId,
      type: "card-played",
      ...eventActor(freshCurrent),
      message: cardPlayedEventMessage(freshCurrent.nickname, card, decision.chosenSuit ?? null),
      timestamp: finishedAt,
    });

    console.debug("[AI] action executed", {
      roomId,
      playerId: freshCurrent.id,
      action: "play",
      card,
      chosenSuit: decision.chosenSuit,
      actionId,
    });
    console.debug("[game] last action updated", {
      roomId,
      playerId: freshCurrent.id,
      type: decision.chosenSuit ? "suit-change" : "play",
      actionId,
    });

    if (finished) {
      await supabaseAdmin
        .from("rooms")
        .update({ status: "finished", finished_at: finishedAt })
        .eq("id", roomId);
      return;
    }
    await wait(1000);
  }
}

/** Client-callable trigger; safely no-ops when it isn't an AI's turn. */
export const triggerAiTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await runAiTurn(data.roomId);
    return { ok: true };
  });
