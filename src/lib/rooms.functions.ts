import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { randomBytes } from "crypto";
import type { CardData, Rank, Suit } from "@/components/cards";

// ------------- helpers (server-only) -------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function genCode(len = 5) {
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return out;
}
function genToken() {
  return randomBytes(24).toString("base64url");
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
const DEAL_COUNT = 5;

function createDeck(): CardData[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

function shuffleDeck(deck: CardData[]) {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function toCardArray(value: unknown): CardData[] {
  return Array.isArray(value) ? (value as CardData[]) : [];
}

function toHands(value: unknown): Record<string, CardData[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, CardData[]>;
}

type ProcessedTurnAction = { playerId: string; signature: string };

function toProcessedActions(value: unknown): Record<string, ProcessedTurnAction> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, ProcessedTurnAction>;
}

function isPlayable(card: CardData, topCard: CardData, activeSuit: Suit | null) {
  return card.suit === (activeSuit ?? topCard.suit) || card.rank === topCard.rank;
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

function actionError(kind: "stale" | "invalid" | "finished", detail: string) {
  const prefix =
    kind === "stale" ? "Stale turn" : kind === "finished" ? "Game finished" : "Invalid action";
  return new Error(`${prefix}: ${detail}`);
}

function actionSignature(action: "draw" | "play", payload?: { cardIndex?: number }) {
  return payload ? `${action}:${payload.cardIndex ?? ""}` : action;
}

function resolveDuplicateAction(
  processedActions: Record<string, ProcessedTurnAction>,
  actionId: string,
  playerId: string,
  signature: string,
): { ok: true; duplicate: true } | null {
  const processed = processedActions[actionId];
  if (!processed) return null;
  if (processed.playerId === playerId && processed.signature === signature) {
    return { ok: true, duplicate: true };
  }
  throw actionError("invalid", "action id was already used for a different action");
}

function takeDrawableCard(deck: CardData[], discardPile: CardData[]) {
  const nextDeck = [...deck];
  let nextDiscardPile = [...discardPile];

  if (nextDeck.length === 0 && nextDiscardPile.length > 1) {
    const topCard = nextDiscardPile.at(-1)!;
    nextDeck.push(...shuffleDeck(nextDiscardPile.slice(0, -1)));
    nextDiscardPile = [topCard];
  }

  return {
    card: nextDeck.shift() ?? null,
    deck: nextDeck,
    discardPile: nextDiscardPile,
  };
}

async function loadGameState(roomId: string) {
  const { data: gameState, error } = await supabaseAdmin
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error || !gameState) throw new Error("Game state not found");
  return {
    ...gameState,
    deck: toCardArray(gameState.deck),
    discard_pile: toCardArray(gameState.discard_pile),
    hands: toHands(gameState.hands),
    processed_actions: toProcessedActions(gameState.processed_actions),
    direction: gameState.direction === -1 ? -1 : 1,
    active_suit: gameState.active_suit as Suit | null,
    turn_version: gameState.turn_version ?? 0,
  };
}

async function resolveFailedTurnMutation(
  roomId: string,
  playerId: string,
  actionId: string,
  signature: string,
  expectedTurnVersion: number,
): Promise<{ ok: true; duplicate: true }> {
  const latest = await loadGameState(roomId);

  const duplicate = resolveDuplicateAction(latest.processed_actions, actionId, playerId, signature);
  if (duplicate) return duplicate;

  if (latest.status !== "playing") {
    throw actionError("finished", "no further moves are allowed");
  }
  if (latest.current_player_id !== playerId) {
    throw actionError("stale", "it is no longer your turn");
  }
  if (latest.turn_version !== expectedTurnVersion) {
    throw actionError("stale", "your game state is out of date; refresh before retrying");
  }

  throw actionError("stale", "the move could not be applied because the turn changed");
}

async function loadTurnPlayers(roomId: string) {
  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select("id, seat")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error || !players || players.length < 2) throw new Error("Could not load players");
  return players;
}

const NicknameSchema = z.string().trim().min(1).max(24);
const AvatarSchema = z.string().trim().max(8).optional().nullable();
const CodeSchema = z.string().trim().toUpperCase().length(5);
const TokenSchema = z.string().min(8).max(128);
const PlayerIdSchema = z.string().uuid();
const ActionIdSchema = z.string().uuid();
const TurnVersionSchema = z.number().int().min(0);

async function authenticatePlayer(playerId: string, token: string) {
  const { data, error } = await supabaseAdmin
    .from("player_secrets")
    .select("player_id, session_token")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw new Error("Auth lookup failed");
  if (!data || data.session_token !== token) {
    throw new Error("Unauthorized: invalid player session");
  }
  const { data: player, error: pErr } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();
  if (pErr || !player) throw new Error("Player not found");
  return player;
}

// ------------- createRoom -------------

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ nickname: NicknameSchema, avatar: AvatarSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    // Find a unique code (collisions are rare; cap retries)
    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = genCode();
      const { data: existing } = await supabaseAdmin
        .from("rooms")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate room code");

    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .insert({ code })
      .select("*")
      .single();
    if (roomErr || !room) throw new Error("Failed to create room");

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("players")
      .insert({
        room_id: room.id,
        nickname: data.nickname,
        avatar: data.avatar ?? null,
        is_host: true,
        is_ready: true,
        seat: 0,
      })
      .select("*")
      .single();
    if (playerErr || !player) throw new Error("Failed to create host player");

    const sessionToken = genToken();
    await supabaseAdmin.from("player_secrets").insert({
      player_id: player.id,
      session_token: sessionToken,
    });

    await supabaseAdmin.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);

    return {
      roomCode: room.code,
      roomId: room.id,
      playerId: player.id,
      sessionToken,
      seat: player.seat,
    };
  });

// ------------- joinRoom -------------

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: CodeSchema, nickname: NicknameSchema, avatar: AvatarSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (roomErr || !room) throw new Error("Místnost nenalezena");

    const { data: existingPlayers, error: pErr } = await supabaseAdmin
      .from("players")
      .select("id, seat, nickname")
      .eq("room_id", room.id)
      .order("seat", { ascending: true });
    if (pErr) throw new Error("Nelze načíst hráče");

    // Allow rejoin: if a player with the same nickname already sits in this
    // room, issue a fresh session token for them instead of inserting again.
    const existing = existingPlayers.find(
      (p) => p.nickname.toLowerCase() === data.nickname.toLowerCase(),
    );
    if (existing) {
      const sessionToken = genToken();
      await supabaseAdmin.from("player_secrets").insert({
        player_id: existing.id,
        session_token: sessionToken,
      });
      return {
        roomCode: room.code,
        roomId: room.id,
        playerId: existing.id,
        sessionToken,
        seat: existing.seat,
      };
    }

    if (room.status !== "waiting")
      throw new Error("Hra už začala — připoj se pod původní přezdívkou");

    if (existingPlayers.length >= room.max_players) {
      throw new Error("Místnost je plná");
    }

    // Find first free seat
    const taken = new Set(existingPlayers.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat) && seat < room.max_players) seat++;

    const { data: player, error: insErr } = await supabaseAdmin
      .from("players")
      .insert({
        room_id: room.id,
        nickname: data.nickname,
        avatar: data.avatar ?? null,
        seat,
      })
      .select("*")
      .single();
    if (insErr || !player) throw new Error("Nepodařilo se připojit do místnosti");

    const sessionToken = genToken();
    await supabaseAdmin.from("player_secrets").insert({
      player_id: player.id,
      session_token: sessionToken,
    });

    return {
      roomCode: room.code,
      roomId: room.id,
      playerId: player.id,
      sessionToken,
      seat: player.seat,
    };
  });

// ------------- getRoomState (public read helper) -------------

export const getRoomState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: CodeSchema }).parse(input))
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, code, status, host_player_id, max_players, created_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) return null;
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, nickname, avatar, is_host, is_ready, seat, joined_at, last_seen_at")
      .eq("room_id", room.id)
      .order("seat", { ascending: true });
    const { data: gameState } = await supabaseAdmin
      .from("game_states")
      .select("*")
      .eq("room_id", room.id)
      .maybeSingle();
    return { room, players: players ?? [], gameState: gameState ?? null };
  });

// ------------- reconnect -------------
// Validates a stored (playerId, sessionToken) pair and returns the full
// session so the client can resume right where it left off, preserving seat.

export const reconnect = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);

    const { data: room, error: rErr } = await supabaseAdmin
      .from("rooms")
      .select("id, code, status, host_player_id, max_players")
      .eq("id", player.room_id)
      .maybeSingle();
    if (rErr || !room) throw new Error("Room no longer exists");

    await supabaseAdmin
      .from("players")
      .update({ connected: true, last_seen_at: new Date().toISOString() })
      .eq("id", player.id);

    return {
      roomCode: room.code,
      roomId: room.id,
      roomStatus: room.status as "waiting" | "playing" | "finished",
      playerId: player.id,
      seat: player.seat,
      nickname: player.nickname,
      avatar: player.avatar,
      isHost: player.is_host,
    };
  });

// ------------- setReady -------------

export const setReady = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ playerId: PlayerIdSchema, sessionToken: TokenSchema, ready: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await authenticatePlayer(data.playerId, data.sessionToken);
    const { error } = await supabaseAdmin
      .from("players")
      .update({ is_ready: data.ready, last_seen_at: new Date().toISOString() })
      .eq("id", data.playerId);
    if (error) throw new Error("Failed to update ready state");
    return { ok: true };
  });

// ------------- leaveRoom -------------

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);

    // Remove the player
    await supabaseAdmin.from("players").delete().eq("id", data.playerId);

    // If they were host, promote the next remaining player by seat
    if (player.is_host) {
      const { data: remaining } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("room_id", player.room_id)
        .order("seat", { ascending: true })
        .limit(1);
      if (remaining && remaining.length > 0) {
        await supabaseAdmin.from("players").update({ is_host: true }).eq("id", remaining[0].id);
        await supabaseAdmin
          .from("rooms")
          .update({ host_player_id: remaining[0].id })
          .eq("id", player.room_id);
      } else {
        // empty room — clean up
        await supabaseAdmin.from("rooms").delete().eq("id", player.room_id);
      }
    }
    return { ok: true };
  });

// ------------- startGame (host only) -------------

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);
    if (!player.is_host) throw new Error("Only the host can start the game");

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, is_ready, seat")
      .eq("room_id", player.room_id)
      .order("seat", { ascending: true });
    if (!players || players.length < 2) throw new Error("Need at least 2 players");
    if (!players.every((p) => p.is_ready)) throw new Error("All players must be ready");

    const deck = shuffleDeck(createDeck());
    const hands: Record<string, CardData[]> = {};
    for (const roomPlayer of players) {
      hands[roomPlayer.id] = deck.splice(0, DEAL_COUNT);
    }

    const firstDiscard = deck.shift();
    if (!firstDiscard) throw new Error("Could not initialize deck");

    const { error: stateError } = await supabaseAdmin.from("game_states").upsert({
      room_id: player.room_id,
      deck: deck as unknown as Json,
      discard_pile: [firstDiscard] as unknown as Json,
      hands: hands as unknown as Json,
      current_player_id: players[0].id,
      active_suit: firstDiscard.suit,
      direction: 1,
      status: "playing",
      turn_version: 0,
      last_action_id: null,
      last_action_player_id: null,
      last_action_signature: null,
      processed_actions: {},
      updated_at: new Date().toISOString(),
    });
    if (stateError) throw new Error("Failed to initialize game state");

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", player.room_id);
    if (error) throw new Error("Failed to start game");
    return { ok: true };
  });

// ------------- drawCard -------------

export const drawCard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        playerId: PlayerIdSchema,
        sessionToken: TokenSchema,
        actionId: ActionIdSchema,
        expectedTurnVersion: TurnVersionSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);
    const signature = actionSignature("draw");
    const gameState = await loadGameState(player.room_id);

    const duplicate = resolveDuplicateAction(
      gameState.processed_actions,
      data.actionId,
      player.id,
      signature,
    );
    if (duplicate) return duplicate;
    if (gameState.status !== "playing")
      throw actionError("finished", "no further moves are allowed");
    if (gameState.current_player_id !== player.id) {
      throw actionError("stale", "it is not your turn anymore");
    }
    if (gameState.turn_version !== data.expectedTurnVersion) {
      throw actionError("stale", "your game state is out of date; refresh before retrying");
    }

    const players = await loadTurnPlayers(player.room_id);
    const hands = { ...gameState.hands };
    const hand = [...(hands[player.id] ?? [])];
    const draw = takeDrawableCard(gameState.deck, gameState.discard_pile);
    if (!draw.card) throw actionError("invalid", "no cards left to draw");

    hand.push(draw.card);
    hands[player.id] = hand;
    const processedActions = {
      ...gameState.processed_actions,
      [data.actionId]: { playerId: player.id, signature },
    };

    const { data: updated, error } = await supabaseAdmin
      .from("game_states")
      .update({
        deck: draw.deck as unknown as Json,
        discard_pile: draw.discardPile as unknown as Json,
        hands: hands as unknown as Json,
        current_player_id: nextPlayerId(players, player.id, gameState.direction),
        active_suit: draw.discardPile.at(-1)?.suit ?? gameState.active_suit,
        turn_version: gameState.turn_version + 1,
        last_action_id: data.actionId,
        last_action_player_id: player.id,
        last_action_signature: signature,
        processed_actions: processedActions as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", player.room_id)
      .eq("current_player_id", player.id)
      .eq("status", "playing")
      .eq("turn_version", data.expectedTurnVersion)
      .select("room_id")
      .maybeSingle();
    if (error) throw new Error("Failed to draw card");
    if (!updated) {
      return resolveFailedTurnMutation(
        player.room_id,
        player.id,
        data.actionId,
        signature,
        data.expectedTurnVersion,
      );
    }
    return { ok: true };
  });

// ------------- playCard -------------

export const playCard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        playerId: PlayerIdSchema,
        sessionToken: TokenSchema,
        actionId: ActionIdSchema,
        expectedTurnVersion: TurnVersionSchema,
        cardIndex: z.number().int().min(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);
    const signature = actionSignature("play", { cardIndex: data.cardIndex });
    const gameState = await loadGameState(player.room_id);

    const duplicate = resolveDuplicateAction(
      gameState.processed_actions,
      data.actionId,
      player.id,
      signature,
    );
    if (duplicate) return duplicate;
    if (gameState.status !== "playing")
      throw actionError("finished", "no further moves are allowed");
    if (gameState.current_player_id !== player.id) {
      throw actionError("stale", "it is not your turn anymore");
    }
    if (gameState.turn_version !== data.expectedTurnVersion) {
      throw actionError("stale", "your game state is out of date; refresh before retrying");
    }

    const topCard = gameState.discard_pile.at(-1);
    if (!topCard) throw actionError("invalid", "discard pile is empty");

    const hands = { ...gameState.hands };
    const hand = [...(hands[player.id] ?? [])];
    const [card] = hand.splice(data.cardIndex, 1);
    if (!card) throw actionError("invalid", "card is not in your hand");
    if (!isPlayable(card, topCard, gameState.active_suit)) {
      throw actionError("invalid", "card is not playable on the current discard");
    }

    hands[player.id] = hand;
    const discardPile = [...gameState.discard_pile, card];
    const finished = hand.length === 0;
    const players = finished ? [] : await loadTurnPlayers(player.room_id);
    const processedActions = {
      ...gameState.processed_actions,
      [data.actionId]: { playerId: player.id, signature },
    };
    const finishedAt = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("game_states")
      .update({
        deck: gameState.deck as unknown as Json,
        discard_pile: discardPile as unknown as Json,
        hands: hands as unknown as Json,
        current_player_id: finished
          ? player.id
          : nextPlayerId(players, player.id, gameState.direction, card.rank === "A" ? 2 : 1),
        active_suit: card.suit,
        status: finished ? "finished" : "playing",
        turn_version: gameState.turn_version + 1,
        last_action_id: data.actionId,
        last_action_player_id: player.id,
        last_action_signature: signature,
        processed_actions: processedActions as unknown as Json,
        updated_at: finishedAt,
      })
      .eq("room_id", player.room_id)
      .eq("current_player_id", player.id)
      .eq("status", "playing")
      .eq("turn_version", data.expectedTurnVersion)
      .select("room_id")
      .maybeSingle();
    if (error) throw new Error("Failed to play card");
    if (!updated) {
      return resolveFailedTurnMutation(
        player.room_id,
        player.id,
        data.actionId,
        signature,
        data.expectedTurnVersion,
      );
    }

    if (finished) {
      await supabaseAdmin
        .from("rooms")
        .update({ status: "finished", finished_at: finishedAt })
        .eq("id", player.room_id);
    }

    return { ok: true };
  });

// ------------- sendMessage -------------

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        playerId: PlayerIdSchema,
        sessionToken: TokenSchema,
        text: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);
    const { error } = await supabaseAdmin.from("room_messages").insert({
      room_id: player.room_id,
      player_id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      text: data.text,
    });
    if (error) throw new Error("Failed to send message");
    return { ok: true };
  });

// ------------- heartbeat (presence) -------------

export const heartbeat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await authenticatePlayer(data.playerId, data.sessionToken);
    await supabaseAdmin
      .from("players")
      .update({ connected: true, last_seen_at: new Date().toISOString() })
      .eq("id", data.playerId);
    return { ok: true };
  });
