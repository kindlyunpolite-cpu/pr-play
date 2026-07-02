import { cn } from "@/lib/utils";
import { PlayingCard } from "./PlayingCard";
import type { CardData, CardSize } from "./types";

function cardKey(card: CardData) {
  return card.id ?? `${card.rank}-${card.suit}`;
}

export interface DiscardPileProps {
  /** Top card is rendered last (on top). Pass at least one. */
  cards: [CardData, ...CardData[]];
  size?: CardSize;
  /** Highlight the most recently played card with the "recent" animation. */
  recent?: boolean;
  className?: string;
}

/**
 * Discard pile: shows up to 3 stacked cards with slight rotations
 * to imply depth. The top card animates in when `recent` is true.
 */
export function DiscardPile({ cards, size = "md", recent = false, className }: DiscardPileProps) {
  const stack = cards.slice(-3);
  const top = stack.length - 1;

  return (
    <div
      className={cn("relative", className)}
      style={{
        width:
          size === "xl"
            ? "6.5rem"
            : size === "lg"
              ? "5.25rem"
              : size === "md"
                ? "4.25rem"
                : size === "sm"
                  ? "3rem"
                  : "1.75rem",
        height:
          size === "xl"
            ? "9.5rem"
            : size === "lg"
              ? "7.7rem"
              : size === "md"
                ? "6.2rem"
                : size === "sm"
                  ? "4.5rem"
                  : "2.5rem",
      }}
    >
      {stack.map((card, i) => {
        const isTop = i === top;
        const rotate = isTop ? 3 : i === top - 1 ? -6 : 8;
        const opacity = isTop ? 1 : 0.55 - (top - i - 1) * 0.15;
        return (
          <PlayingCard
            key={cardKey(card)}
            card={card}
            size={size}
            state={isTop && recent ? "recent" : "idle"}
            className="absolute top-0 left-0"
            style={{ transform: `rotate(${rotate}deg)`, opacity, zIndex: i }}
          />
        );
      })}
    </div>
  );
}
