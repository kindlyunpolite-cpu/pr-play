import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes } from "crypto";

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

const NicknameSchema = z.string().trim().min(1).max(24);
const AvatarSchema = z.string().trim().max(8).optional().nullable();
const CodeSchema = z.string().trim().toUpperCase().length(5);
const TokenSchema = z.string().min(8).max(128);
const PlayerIdSchema = z.string().uuid();

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

    await supabaseAdmin
      .from("rooms")
      .update({ host_player_id: player.id })
      .eq("id", room.id);

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
    z
      .object({ code: CodeSchema, nickname: NicknameSchema, avatar: AvatarSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (roomErr || !room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Room is not accepting players");

    const { data: existingPlayers, error: pErr } = await supabaseAdmin
      .from("players")
      .select("seat, nickname")
      .eq("room_id", room.id)
      .order("seat", { ascending: true });
    if (pErr) throw new Error("Could not load players");

    if (existingPlayers.length >= room.max_players) {
      throw new Error("Room is full");
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
    if (insErr || !player) throw new Error("Failed to join room");

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
    return { room, players: players ?? [] };
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
        await supabaseAdmin
          .from("players")
          .update({ is_host: true })
          .eq("id", remaining[0].id);
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
      .select("id, is_ready")
      .eq("room_id", player.room_id);
    if (!players || players.length < 2) throw new Error("Need at least 2 players");
    if (!players.every((p) => p.is_ready)) throw new Error("All players must be ready");

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", player.room_id);
    if (error) throw new Error("Failed to start game");
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
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.playerId);
    return { ok: true };
  });
