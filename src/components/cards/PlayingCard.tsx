import { cn } from "@/lib/utils";
import { SuitIcon } from "./SuitIcon";
import { isRedSuit, type CardData, type CardSize, type CardState } from "./types";

const SIZE_CLASSES: Record<CardSize, string> = {
  xs: "w-7 h-10 rounded-[5px] text-[9px]",
  sm: "w-12 h-[4.5rem] rounded-[10px] text-[11px]",
  md: "w-[4.25rem] h-[6.2rem] rounded-2xl text-sm",
  lg: "w-[5.25rem] h-[7.7rem] rounded-2xl text-base",
  xl: "w-[6.5rem] h-[9.5rem] rounded-[22px] text-lg",
};

const CORNER_GLYPH: Record<CardSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
};

const CENTER_GLYPH: Record<CardSize, string> = {
  xs: "h-3 w-3",
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
  xl: "h-12 w-12",
};

export type CardAnimation = "deal" | "draw" | "play" | "tap" | "winner";

export interface PlayingCardProps {
  card: CardData;
  size?: CardSize;
  state?: CardState;
  /** One-shot animation triggered by the parent (key changes re-trigger). */
  animation?: CardAnimation;
  /** Stagger delay (ms) — used by deal animations across a hand. */
  animationDelay?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}

const ANIMATION_CLASSES: Record<CardAnimation, string> = {
  deal: "animate-card-deal",
  draw: "animate-card-draw",
  play: "animate-card-play",
  tap: "animate-card-tap",
  winner: "animate-winner",
};

/**
 * Full face-up playing card. Pure CSS + inline SVG suit.
 * `state` controls persistent visuals; `animation` triggers one-shots.
 */
export function PlayingCard({
  card,
  size = "md",
  state = "idle",
  animation,
  animationDelay,
  className,
  style,
  onClick,
  ariaLabel,
}: PlayingCardProps) {
  const red = isRedSuit(card.suit);
  const interactive = state === "playable" || state === "selected";

  const stateClasses: Record<CardState, string> = {
    idle: "",
    playable:
      "card-playable cursor-pointer hover:-translate-y-2.5 hover:scale-[1.04] hover:shadow-xl active:scale-[0.97] active:-translate-y-1",
    disabled: "opacity-60 saturate-75 cursor-not-allowed",
    selected: "-translate-y-4 ring-2 ring-[color:var(--color-gold)] glow-primary",
    active: "ring-2 ring-[color:var(--color-gold)] animate-card-active",
    recent: "animate-card-played",
  };

  const composedStyle: React.CSSProperties = {
    ...style,
    ...(animationDelay != null
      ? ({ "--deal-delay": `${animationDelay}ms` } as React.CSSProperties)
      : null),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "disabled"}
      aria-label={ariaLabel ?? `${card.rank} of ${card.suit}`}
      style={composedStyle}
      className={cn(
        "card-face shrink-0 relative flex flex-col justify-between p-1.5 transition-[transform,box-shadow] duration-150 ease-out will-change-transform select-none",
        SIZE_CLASSES[size],
        red ? "text-[color:var(--suit-red)]" : "text-[color:var(--suit-dark)]",
        stateClasses[state],
        animation && ANIMATION_CLASSES[animation],
        !interactive && state !== "disabled" && "cursor-default",
        className,
      )}
    >
      {/* Top-left index */}
      <div className="flex items-center gap-0.5 leading-none font-bold">
        <span>{card.rank}</span>
        <SuitIcon suit={card.suit} className={CORNER_GLYPH[size]} />
      </div>

      {/* Center pip */}
      <SuitIcon
        suit={card.suit}
        className={cn("self-center opacity-95", CENTER_GLYPH[size])}
      />

      {/* Bottom-right index */}
      <div className="flex items-center gap-0.5 leading-none font-bold rotate-180 self-end">
        <span>{card.rank}</span>
        <SuitIcon suit={card.suit} className={CORNER_GLYPH[size]} />
      </div>
    </button>
  );
}

