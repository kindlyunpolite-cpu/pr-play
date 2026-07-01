import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CardData } from "@/components/cards";

export type RoomEventType = "system" | "player_action";

const SUIT_NAMES: Record<CardData["suit"], string> = {
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
  spades: "Spades",
};

export function cardEventLabel(card: CardData) {
  return `${card.rank} ${SUIT_NAMES[card.suit]}`;
}

export function drawnCardEventMessage(playerName: string, drawCount: number) {
  return drawCount === 1 ? `${playerName} drew a card` : `${playerName} drew ${drawCount} cards`;
}

export async function recordRoomEvent(input: {
  roomId: string;
  type: RoomEventType;
  playerId?: string | null;
  message: string;
  timestamp?: string;
}) {
  const { error } = await supabaseAdmin.from("room_events").insert({
    room_id: input.roomId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    player_id: input.playerId ?? null,
    message: input.message,
  });
  if (error) throw new Error("Failed to record room event");
}
