export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface CardData {
  suit: Suit;
  rank: Rank;
}

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

export type CardState =
  | "idle"
  | "playable"
  | "disabled"
  | "selected"
  | "active"
  | "recent";

export const SUIT_LABEL: Record<Suit, string> = {
  hearts: "Srdce",
  diamonds: "Káry",
  clubs: "Kříže",
  spades: "Piky",
};

export const isRedSuit = (s: Suit) => s === "hearts" || s === "diamonds";
