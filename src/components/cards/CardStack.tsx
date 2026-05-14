import { cn } from "@/lib/utils";
import { HiddenCard } from "./HiddenCard";
import type { CardSize } from "./types";

export interface CardStackProps {
  count: number;
  /** Visual cap — only this many cards are rendered, the rest is shown as a counter. */
  maxVisible?: number;
  size?: CardSize;
  /** "fan" spreads cards in an arc; "stack" piles them with a small offset. */
  layout?: "fan" | "stack";
  className?: string;
  showCount?: boolean;
}

/**
 * Compact stack of face-down cards. Used for opponent hands and the draw deck.
 */
export function CardStack({
  count,
  maxVisible = 5,
  size = "xs",
  layout = "fan",
  className,
  showCount = false,
}: CardStackProps) {
  const visible = Math.min(count, maxVisible);
  if (count <= 0) return null;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div className="relative">
        {Array.from({ length: visible }).map((_, i) => {
          const offset = i - (visible - 1) / 2;
          const transform =
            layout === "fan"
              ? `translateX(${offset * 9}px) rotate(${offset * 5}deg)`
              : `translate(${i * 1.5}px, ${-i * 1.5}px)`;
          return (
            <HiddenCard
              key={i}
              size={size}
              className={i === 0 ? "" : "absolute top-0 left-0"}
              style={{ transform, zIndex: i }}
            />
          );
        })}
      </div>
      {showCount && (
        <span className="ml-2 text-[10px] font-mono tabular-nums text-muted-foreground">
          ×{count}
        </span>
      )}
    </div>
  );
}
