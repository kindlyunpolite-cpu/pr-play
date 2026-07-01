import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { randomBytes } from "crypto";
import type { CardData, Rank, Suit } from "@/components/cards";
import type { RoomEventType } from "@/types/room";
import { createVisibleActionSignature } from "@/lib/game-actions";

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
const DEAL_COUNT = 4;
const TURN_DURATION_MS = 30_000;

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

    // Room events are best-effort audit/UI records. Never fail a completed
    // room/game mutation just because an event insert failed.
    if (error) {
      console.debug("[room-events] failed to write room event", {
        roomId: input.roomId,
        type: input.type,
        playerId: input.playerId,
        error,
      });
    }
  } catch (error) {
    console.debug("[room-events] failed to write room event", {
      roomId: input.roomId,
      type: input.type,
      playerId: input.playerId,
      error,
    });
  }
}

function eventActor(player: { id: string; nickname: string; seat: number }) {
  return { playerId: player.id, actorNickname: player.nickname, actorSeat: player.seat };
}

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
type RematchVotes = Record<string, boolean>;

function toProcessedActions(value: unknown): Record<string, ProcessedTurnAction> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, ProcessedTurnAction>;
}

function toRematchVotes(value: unknown): RematchVotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as RematchVotes;
}

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

function actionSignature(
  action: "draw" | "play",
  payload?: { cardIndex?: number; chosenSuit?: Suit },
) {
  return payload ? `${action}:${payload.cardIndex ?? ""}:${payload.chosenSuit ?? ""}` : action;
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

function takeDrawableCards(deck: CardData[], discardPile: CardData[], count: number) {
  const cards: CardData[] = [];
  let nextDeck = [...deck];
  let nextDiscardPile = [...discardPile];

  for (let i = 0; i < count; i++) {
    const draw = takeDrawableCard(nextDeck, nextDiscardPile);
    if (!draw.card) {
      return { cards, deck: nextDeck, discardPile: nextDiscardPile, complete: false };
    }
    cards.push(draw.card);
    nextDeck = draw.deck;
    nextDiscardPile = draw.discardPile;
  }

  return { cards, deck: nextDeck, discardPile: nextDiscardPile, complete: true };
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
    rematch_votes: toRematchVotes("rematch_votes" in gameState ? gameState.rematch_votes : null),
    direction: gameState.direction === -1 ? -1 : 1,
    active_suit: gameState.active_suit as Suit | null,
    pending_draw: gameState.pending_draw ?? 0,
    turn_version: gameState.turn_version ?? 0,
  };
}

async function resolveFailedTurnMutation(
  roomId: string,
  playerId: string,
  actionId: string,
  signature: string,
  expectedTurnVersion: number,
): Promise<{ ok: true; duplicate?: true; stale?: true; finished?: true }> {
  const latest = await loadGameState(roomId);

  const duplicate = resolveDuplicateAction(latest.processed_actions, actionId, playerId, signature);
  if (duplicate) return duplicate;

  if (latest.status !== "playing") {
    return { ok: true, finished: true };
  }
  if (latest.current_player_id !== playerId) {
    return { ok: true, stale: true };
  }
  if (latest.turn_version !== expectedTurnVersion) {
    return { ok: true, stale: true };
  }

  return { ok: true, stale: true };
}

async function loadTurnPlayers(roomId: string) {
  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select("id, seat, nickname")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error || !players || players.length < 2) throw new Error("Could not load players");
  return players;
}

async function normalizeWaitingRoom(roomId: string) {
  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status, host_player_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr || !room) return false;
  if (room.status !== "waiting") return true;

  const { data: roomPlayers, error: playersErr } = await supabaseAdmin
    .from("players")
    .select("id, is_host, seat")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (playersErr) throw new Error("Failed to normalize waiting room");

  if (!roomPlayers || roomPlayers.length === 0) {
    await supabaseAdmin.from("rooms").delete().eq("id", roomId);
    return false;
  }

  const currentHost = roomPlayers.find((p) => p.id === room.host_player_id && p.is_host);
  if (!currentHost) {
    const nextHostId = roomPlayers[0].id;
    const { error: clearHostErr } = await supabaseAdmin
      .from("players")
      .update({ is_host: false })
      .eq("room_id", roomId);
    if (clearHostErr) throw new Error("Failed to normalize waiting room host");

    const { error: setHostErr } = await supabaseAdmin
      .from("players")
      .update({ is_host: true, is_ready: true })
      .eq("id", nextHostId);
    if (setHostErr) throw new Error("Failed to normalize waiting room host");

    const { error: roomHostErr } = await supabaseAdmin
      .from("rooms")
      .update({ host_player_id: nextHostId })
      .eq("id", roomId);
    if (roomHostErr) throw new Error("Failed to normalize waiting room host");
  }

  return true;
}

async function initializeGame(roomId: string, players: { id: string }[], firstPlayerId: string) {
  const deck = shuffleDeck(createDeck());
  const hands: Record<string, CardData[]> = {};
  for (const roomPlayer of players) {
    hands[roomPlayer.id] = deck.splice(0, DEAL_COUNT);
  }

  const firstDiscard = deck.shift();
  if (!firstDiscard) throw new Error("Could not initialize deck");

  const { error: stateError } = await supabaseAdmin.from("game_states").upsert({
    room_id: roomId,
    deck: deck as unknown as Json,
    discard_pile: [firstDiscard] as unknown as Json,
    hands: hands as unknown as Json,
    current_player_id: firstPlayerId,
    active_suit: firstDiscard.suit,
    direction: 1,
    status: "playing",
    pending_draw: 0,
    turn_version: 0,

    last_action_id: null,
    last_action_player_id: null,
    last_action_signature: null,
    processed_actions: {},
    rematch_votes: {},
    updated_at: new Date().toISOString(),
  });
  if (stateError) throw new Error("Failed to initialize game state");
}

async function incrementPlayerStats(
  playerId: string,
  roomId: string,
  increments: {
    gamesPlayed?: number;
    wins?: number;
    cardsDrawn?: number;
    cardsPlayed?: number;
    turnsTaken?: number;
  },
) {
  const { error } = await supabaseAdmin.rpc("increment_player_stats", {
    p_player_id: playerId,
    p_room_id: roomId,
    p_games_played: increments.gamesPlayed ?? 0,
    p_wins: increments.wins ?? 0,
    p_cards_drawn: increments.cardsDrawn ?? 0,
    p_cards_played: increments.cardsPlayed ?? 0,
    p_turns_taken: increments.turnsTaken ?? 0,
  });
  if (error) throw new Error("Failed to update player statistics");
}

async function recordFinishedGame(roomId: string, winnerPlayerId: string, finishedAt: string) {
  const players = await loadTurnPlayers(roomId);

  const { data: result, error: resultError } = await supabaseAdmin
    .from("game_results")
    .upsert(
      {
        room_id: roomId,
        winner_player_id: winnerPlayerId,
        finished_at: finishedAt,
        player_count: players.length,
      },
      { onConflict: "room_id,finished_at", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (resultError) throw new Error("Failed to record game result");
  if (!result) return;

  await Promise.all(
    players.map((roomPlayer) =>
      incrementPlayerStats(roomPlayer.id, roomId, {
        gamesPlayed: 1,
        wins: roomPlayer.id === winnerPlayerId ? 1 : 0,
      }),
    ),
  );
}

const NicknameSchema = z.string().trim().min(1).max(24);
const AvatarSchema = z.string().trim().max(8).optional().nullable();
const CodeSchema = z.string().trim().toUpperCase().length(5);
const TokenSchema = z.string().min(8).max(128);
const PlayerIdSchema = z.string().uuid();
const RoomIdSchema = z.string().uuid();
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

    await writeRoomEvent({
      roomId: room.id,
      type: "player-joined",
      ...eventActor(player),
      message: `${player.nickname} joined room`,
    });

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
    if (room.status === "waiting" && !(await normalizeWaitingRoom(room.id)))
      throw new Error("Místnost nenalezena");

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

    await writeRoomEvent({
      roomId: room.id,
      type: "player-joined",
      ...eventActor(player),
      message: `${player.nickname} joined room`,
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
  .inputValidator((input: unknown) =>
    z
      .object({
        code: CodeSchema,
        playerId: PlayerIdSchema.optional(),
        sessionToken: TokenSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, code, status, host_player_id, max_players, created_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) return null;
    if (room.status === "waiting" && !(await normalizeWaitingRoom(room.id))) return null;
    const { data: players } = await supabaseAdmin
      .from("players")
      .select(
        "id, nickname, avatar, is_host, is_ready, seat, joined_at, last_seen_at, connected, is_ai",
      )
      .eq("room_id", room.id)
      .order("seat", { ascending: true });
    const { data: playerStats } = await supabaseAdmin
      .from("player_stats")
      .select("*")
      .eq("room_id", room.id);
    const { data: gameState } = await supabaseAdmin
      .from("game_states")
      .select("*")
      .eq("room_id", room.id)
      .maybeSingle();
    const statsByPlayerId = new Map((playerStats ?? []).map((stats) => [stats.player_id, stats]));

    // Authorize viewer (if creds provided) so we can return their own hand.
    let viewerId: string | null = null;
    if (data.playerId && data.sessionToken) {
      const viewer = await authenticatePlayer(data.playerId, data.sessionToken).catch(() => null);
      if (viewer && viewer.room_id === room.id) viewerId = viewer.id;
    }

    // Redact deck + other players' hands so the client cannot see future draws
    // or opponents' cards. Client UI only needs the length of each opponent's
    // hand and of the deck, so placeholder cards preserve shape.
    let safeGameState: typeof gameState = gameState;
    if (gameState) {
      const PLACEHOLDER = { suit: "spades", rank: "7" } as const;
      const rawHands = toHands(gameState.hands);
      const redactedHands: Record<string, CardData[]> = {};
      for (const [pid, cards] of Object.entries(rawHands)) {
        redactedHands[pid] =
          pid === viewerId ? cards : (cards.map(() => PLACEHOLDER) as CardData[]);
      }
      const deckLen = toCardArray(gameState.deck).length;
      safeGameState = {
        ...gameState,
        deck: Array.from({ length: deckLen }, () => PLACEHOLDER) as unknown as Json,
        hands: redactedHands as unknown as Json,
      };
    }

    return {
      room,
      players: (players ?? []).map((roomPlayer) => ({
        ...roomPlayer,
        stats: statsByPlayerId.get(roomPlayer.id) ?? null,
      })),
      gameState: safeGameState ?? null,
    };
  });

// ------------- reconnect -------------
// Validates a stored (playerId, sessionToken) pair and returns the full
// session so the client can resume right where it left off, preserving seat.

export const reconnect = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken).catch((error) => {
      if (error instanceof Error && error.message === "Unauthorized: invalid player session") {
        return null;
      }
      throw error;
    });
    if (!player) return null;

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
//
// Waiting-room leave removes the player from the room, freeing their seat.
// In-flight games keep the row disconnected so game state stays valid.

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);

    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("id, status")
      .eq("id", player.room_id)
      .maybeSingle();
    if (roomErr || !room) throw new Error("Room no longer exists");

    if (room.status === "waiting") {
      await writeRoomEvent({
        roomId: player.room_id,
        type: "player-left",
        ...eventActor(player),
        message: `${player.nickname} left room`,
      });

      const { error: deleteErr } = await supabaseAdmin.from("players").delete().eq("id", player.id);
      if (deleteErr) throw new Error("Failed to leave room");

      await normalizeWaitingRoom(player.room_id);
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("players")
      .update({ connected: false, is_ready: false })
      .eq("id", data.playerId);
    if (error) throw new Error("Failed to leave room");

    await writeRoomEvent({
      roomId: player.room_id,
      type: "player-left",
      ...eventActor(player),
      message: `${player.nickname} left room`,
    });

    return { ok: true };
  });

// ------------- kickPlayer (host only, waiting room) -------------

export const kickPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        playerId: PlayerIdSchema,
        sessionToken: TokenSchema,
        targetPlayerId: PlayerIdSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const host = await authenticatePlayer(data.playerId, data.sessionToken);
    if (!host.is_host) throw new Error("Only the host can remove players");
    if (host.id === data.targetPlayerId) throw new Error("Host cannot remove themselves");

    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("id, status")
      .eq("id", host.room_id)
      .maybeSingle();
    if (roomErr || !room) throw new Error("Room no longer exists");
    if (room.status !== "waiting") throw new Error("Players can only be removed in the lobby");

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("players")
      .select("id, room_id, nickname, seat")
      .eq("id", data.targetPlayerId)
      .maybeSingle();
    if (targetErr || !target || target.room_id !== host.room_id) {
      throw new Error("Player is not in this room");
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("players")
      .delete()
      .eq("id", data.targetPlayerId);
    if (deleteErr) throw new Error("Failed to remove player");

    await writeRoomEvent({
      roomId: host.room_id,
      type: "player-kicked",
      ...eventActor(target),
      message: `${target.nickname} was kicked from room`,
    });

    await normalizeWaitingRoom(host.room_id);
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
      .eq("connected", true)
      .order("seat", { ascending: true });
    if (!players || players.length < 2) throw new Error("Need at least 2 players");
    if (!players.every((p) => p.is_ready || p.id === player.id))
      throw new Error("All players must be ready");

    await initializeGame(player.room_id, players, players[0].id);

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", player.room_id);
    if (error) throw new Error("Failed to start game");

    await writeRoomEvent({
      roomId: player.room_id,
      type: "game-started",
      message: "Game started",
    });
    return { ok: true };
  });

async function writeSystemEvent(roomId: string, text: string) {
  try {
    const { error } = await supabaseAdmin.from("room_messages").insert({
      room_id: roomId,
      player_id: null,
      nickname: "System",
      avatar: null,
      text,
    });
    if (error) {
      console.debug("[room-events] failed to write legacy system chat event", { roomId, error });
    }
  } catch (error) {
    console.debug("[room-events] failed to write legacy system chat event", { roomId, error });
  }
}

// ------------- applyTurnTimeout -------------

export const applyTurnTimeout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ roomId: RoomIdSchema }).parse(input))
  .handler(async ({ data }) => {
    const gameState = await loadGameState(data.roomId);
    if (gameState.status !== "playing") return { ok: true, finished: true };
    if (!gameState.current_player_id) return { ok: true, stale: true };

    const now = new Date();
    const deadline = new Date(gameState.turn_deadline_at);
    if (Number.isNaN(deadline.getTime())) {
      throw actionError("invalid", "turn deadline is invalid");
    }
    if (deadline > now) return { ok: true, notExpired: true };

    const timeoutActionId = `timeout:${gameState.turn_version}:${gameState.current_player_id}`;
    const signature = "timeout";
    const duplicate = resolveDuplicateAction(
      gameState.processed_actions,
      timeoutActionId,
      gameState.current_player_id,
      signature,
    );
    if (duplicate) return duplicate;

    const players = await loadTurnPlayers(data.roomId);
    const hands = { ...gameState.hands };
    const activePlayerId = gameState.current_player_id;
    const activePlayer = players.find((p) => p.id === activePlayerId);
    const activeHand = [...(hands[activePlayerId] ?? [])];
    const draw = takeDrawableCards(gameState.deck, gameState.discard_pile, 1);
    activeHand.push(...draw.cards);
    hands[activePlayerId] = activeHand;

    const processedActions = {
      ...gameState.processed_actions,
      [timeoutActionId]: { playerId: activePlayerId, signature },
    };
    const nextTurnPlayerId = nextPlayerId(players, activePlayerId, gameState.direction);
    const updatedAt = now.toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("game_states")
      .update({
        deck: draw.deck as unknown as Json,
        discard_pile: draw.discardPile as unknown as Json,
        hands: hands as unknown as Json,
        current_player_id: nextTurnPlayerId,
        active_suit: gameState.active_suit,
        pending_draw: gameState.pending_draw,
        turn_version: gameState.turn_version + 1,
        last_action_id: timeoutActionId,
        last_action_player_id: activePlayerId,
        last_action_signature: signature,
        processed_actions: processedActions as unknown as Json,
        updated_at: updatedAt,
      })
      .eq("room_id", data.roomId)
      .eq("current_player_id", activePlayerId)
      .eq("status", "playing")
      .eq("turn_version", gameState.turn_version)
      .lte("turn_deadline_at", updatedAt)
      .select("room_id")
      .maybeSingle();
    if (error) throw new Error("Failed to apply turn timeout");
    if (!updated) return { ok: true, stale: true };

    await Promise.all([
      incrementPlayerStats(activePlayerId, data.roomId, {
        cardsDrawn: draw.cards.length,
        turnsTaken: 1,
      }),
      writeSystemEvent(data.roomId, `Player timed out and drew ${draw.cards.length} card.`),
      writeRoomEvent({
        roomId: data.roomId,
        type: "turn-timeout",
        playerId: activePlayerId,
        actorNickname: activePlayer?.nickname ?? null,
        actorSeat: activePlayer?.seat ?? null,
        message: `${activePlayer?.nickname ?? "Player"} timed out`,
        timestamp: updatedAt,
      }),
    ]);

    return { ok: true, timedOut: true, drawn: draw.cards.length };
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
    if (gameState.status !== "playing") return { ok: true, finished: true };
    if (gameState.current_player_id !== player.id) {
      return { ok: true, stale: true };
    }
    if (gameState.turn_version !== data.expectedTurnVersion) {
      return { ok: true, stale: true };
    }

    const players = await loadTurnPlayers(player.room_id);
    const hands = { ...gameState.hands };
    const hand = [...(hands[player.id] ?? [])];
    const pendingDraw = gameState.pending_draw ?? 0;
    const drawCount = pendingDraw > 0 ? pendingDraw : 1;
    const draw = takeDrawableCards(gameState.deck, gameState.discard_pile, drawCount);
    if (pendingDraw === 0 && !draw.complete) throw actionError("invalid", "no cards left to draw");

    hand.push(...draw.cards);
    hands[player.id] = hand;
    const processedActions = {
      ...gameState.processed_actions,
      [data.actionId]: { playerId: player.id, signature },
    };
    const visibleSignature = createVisibleActionSignature({
      type: "draw",
      drawCount: draw.cards.length,
    });

    const { data: updated, error } = await supabaseAdmin
      .from("game_states")
      .update({
        deck: draw.deck as unknown as Json,
        discard_pile: draw.discardPile as unknown as Json,
        hands: hands as unknown as Json,
        current_player_id: nextPlayerId(players, player.id, gameState.direction),
        active_suit: gameState.active_suit,
        pending_draw: 0,
        turn_version: gameState.turn_version + 1,
        last_action_id: data.actionId,
        last_action_player_id: player.id,
        last_action_signature: visibleSignature,
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
    await Promise.all([
      incrementPlayerStats(player.id, player.room_id, {
        cardsDrawn: draw.cards.length,
        turnsTaken: 1,
      }),
      writeRoomEvent({
        roomId: player.room_id,
        type: "card-drawn",
        ...eventActor(player),
        message: `${player.nickname} drew ${
          draw.cards.length === 1 ? "a card" : `${draw.cards.length} cards`
        }`,
      }),
    ]);
    console.debug("[game] last action updated", {
      roomId: player.room_id,
      playerId: player.id,
      type: "draw",
      drawCount: draw.cards.length,
      actionId: data.actionId,
    });
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
        chosenSuit: z.enum(SUITS as [Suit, ...Suit[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const player = await authenticatePlayer(data.playerId, data.sessionToken);
    const signature = actionSignature("play", {
      cardIndex: data.cardIndex,
      chosenSuit: data.chosenSuit,
    });
    const gameState = await loadGameState(player.room_id);

    const duplicate = resolveDuplicateAction(
      gameState.processed_actions,
      data.actionId,
      player.id,
      signature,
    );
    if (duplicate) return duplicate;
    if (gameState.status !== "playing") return { ok: true, finished: true };
    if (gameState.current_player_id !== player.id) {
      return { ok: true, stale: true };
    }
    if (gameState.turn_version !== data.expectedTurnVersion) {
      return { ok: true, stale: true };
    }

    const topCard = gameState.discard_pile.at(-1);
    if (!topCard) throw actionError("invalid", "discard pile is empty");

    const hands = { ...gameState.hands };
    const hand = [...(hands[player.id] ?? [])];
    const [card] = hand.splice(data.cardIndex, 1);
    if (!card) throw actionError("invalid", "card is not in your hand");
    if (!isPlayable(card, topCard, gameState.active_suit, gameState.pending_draw)) {
      throw actionError(
        "invalid",
        gameState.pending_draw > 0
          ? "you must play another 7 or draw the pending penalty"
          : "card is not playable on the current discard",
      );
    }
    if (card.rank === "Q" && !data.chosenSuit) {
      throw actionError("invalid", "queen requires choosing a suit");
    }
    if (card.rank !== "Q" && data.chosenSuit) {
      throw actionError("invalid", "chosen suit is only allowed for queens");
    }

    hands[player.id] = hand;
    const discardPile = [...gameState.discard_pile, card];
    const pendingDraw = card.rank === "7" ? gameState.pending_draw + 2 : 0;
    const finished = hand.length === 0;
    const players = finished ? [] : await loadTurnPlayers(player.room_id);
    const processedActions = {
      ...gameState.processed_actions,
      [data.actionId]: { playerId: player.id, signature },
    };
    const finishedAt = new Date().toISOString();
    const visibleSignature = createVisibleActionSignature({
      type: data.chosenSuit ? "suit-change" : "play",
      card,
      cardIndex: data.cardIndex,
      chosenSuit: data.chosenSuit ?? null,
    });

    const { data: updated, error } = await supabaseAdmin
      .from("game_states")
      .update({
        deck: gameState.deck as unknown as Json,
        discard_pile: discardPile as unknown as Json,
        hands: hands as unknown as Json,
        current_player_id: finished
          ? player.id
          : nextPlayerId(players, player.id, gameState.direction, card.rank === "A" ? 2 : 1),
        active_suit: data.chosenSuit ?? card.suit,
        pending_draw: finished ? 0 : pendingDraw,
        status: finished ? "finished" : "playing",
        turn_version: gameState.turn_version + 1,
        last_action_id: data.actionId,
        last_action_player_id: player.id,
        last_action_signature: visibleSignature,
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
      await recordFinishedGame(player.room_id, player.id, finishedAt);
    }

    await Promise.all([
      incrementPlayerStats(player.id, player.room_id, {
        cardsPlayed: 1,
        turnsTaken: 1,
      }),
      writeRoomEvent({
        roomId: player.room_id,
        type: "card-played",
        ...eventActor(player),
        message: cardPlayedEventMessage(player.nickname, card, data.chosenSuit ?? null),
      }),
    ]);
    console.debug("[game] last action updated", {
      roomId: player.room_id,
      playerId: player.id,
      type: data.chosenSuit ? "suit-change" : "play",
      playedCard: card,
      chosenSuit: data.chosenSuit,
      actionId: data.actionId,
    });

    return { ok: true };
  });

// ------------- rematch -------------

async function updateRematchVote(playerId: string, sessionToken: string, accepted: boolean) {
  const player = await authenticatePlayer(playerId, sessionToken);
  const gameState = await loadGameState(player.room_id);
  if (gameState.status !== "finished") {
    throw actionError("invalid", "rematch voting is only available after the game finishes");
  }

  const votes = { ...gameState.rematch_votes, [player.id]: accepted };
  const { error } = await supabaseAdmin
    .from("game_states")
    .update({ rematch_votes: votes as unknown as Json, updated_at: new Date().toISOString() })
    .eq("room_id", player.room_id)
    .eq("status", "finished");
  if (error) throw new Error("Failed to update rematch vote");

  if (!accepted) return { ok: true, started: false };

  const { data: connectedPlayers, error: playersError } = await supabaseAdmin
    .from("players")
    .select("id, seat")
    .eq("room_id", player.room_id)
    .eq("connected", true)
    .order("seat", { ascending: true });
  if (playersError || !connectedPlayers || connectedPlayers.length < 2) {
    return { ok: true, started: false };
  }

  if (!connectedPlayers.every((roomPlayer) => votes[roomPlayer.id] === true)) {
    return { ok: true, started: false };
  }

  const previousStarterId =
    gameState.current_player_id &&
    connectedPlayers.some((roomPlayer) => roomPlayer.id === gameState.current_player_id)
      ? gameState.current_player_id
      : connectedPlayers[0].id;
  const firstPlayerId = nextPlayerId(connectedPlayers, previousStarterId, 1);

  const { data: claimedRoom, error: roomError } = await supabaseAdmin
    .from("rooms")
    .update({ status: "playing", started_at: new Date().toISOString(), finished_at: null })
    .eq("id", player.room_id)
    .eq("status", "finished")
    .select("id")
    .maybeSingle();
  if (roomError) throw new Error("Failed to start rematch");
  if (!claimedRoom) return { ok: true, started: false };

  await initializeGame(player.room_id, connectedPlayers, firstPlayerId);

  return { ok: true, started: true };
}

export const acceptRematch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => updateRematchVote(data.playerId, data.sessionToken, true));

export const declineRematch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId: PlayerIdSchema, sessionToken: TokenSchema }).parse(input),
  )
  .handler(async ({ data }) => updateRematchVote(data.playerId, data.sessionToken, false));

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
