import type { CardData, Suit } from "@/components/cards";
import type { GameActionEvent, GameActionType } from "@/types/room";

export function createVisibleActionSignature(input:
  | { type: "draw"; drawCount: number }
  | { type: "play" | "suit-change"; card: CardData; cardIndex: number; chosenSuit?: Suit | null }) {
  if (input.type === "draw") return `draw:${input.drawCount}`;
  return [
    input.type,
    input.cardIndex,
    input.chosenSuit ?? "",
    input.card.suit,
    input.card.rank,
  ].join(":");
}

export function parseVisibleActionSignature(signature: string | null | undefined): {
  type: GameActionType;
  playedCard?: CardData | null;
  drawCount?: number | null;
  chosenSuit?: Suit | null;
} | null {
  if (!signature) return null;
  const [type, a, b, c, d] = signature.split(":");
  if (type === "draw") {
    return { type: "draw", drawCount: Math.max(1, Number(a) || 1) };
  }
  if ((type === "play" || type === "suit-change") && c && d) {
    return {
      type,
      playedCard: { suit: c as Suit, rank: d as CardData["rank"] },
      chosenSuit: b ? (b as Suit) : null,
    };
  }
  if (type === "play") return { type: "play" };
  return null;
}

export function createGameActionEvent(input: {
  actionId: string;
  playerId: string;
  signature: string | null | undefined;
  at?: string;
}): GameActionEvent | null {
  const parsed = parseVisibleActionSignature(input.signature);
  if (!parsed) return null;
  return {
    id: input.actionId,
    playerId: input.playerId,
    type: parsed.type,
    playedCard: parsed.playedCard ?? null,
    drawCount: parsed.drawCount ?? null,
    chosenSuit: parsed.chosenSuit ?? null,
    at: input.at ?? new Date().toISOString(),
  };
}
