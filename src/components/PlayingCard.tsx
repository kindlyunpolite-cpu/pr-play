import { cn } from "@/lib/utils";

export type Suit = "hearts" | "leaves" | "bells" | "acorns";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface CardData { suit: Suit; rank: Rank; }

const SUIT_GLYPH: Record<Suit, string> = {
  hearts: "♥",
  leaves: "♣",
  bells: "♦",
  acorns: "♠",
};

const SUIT_LABEL: Record<Suit, string> = {
  hearts: "Srdce",
  leaves: "Listy",
  bells: "Kule",
  acorns: "Žaludy",
};

const isRed = (s: Suit) => s === "hearts" || s === "bells";

export function PlayingCard({
  card,
  size = "md",
  faceDown = false,
  selected = false,
  playable = false,
  className,
  onClick,
  style,
}: {
  card?: CardData;
  size?: "xs" | "sm" | "md" | "lg";
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const sizes = {
    xs: "w-8 h-12 text-[10px] rounded-[6px]",
    sm: "w-12 h-[4.5rem] text-xs rounded-[10px]",
    md: "w-[4.5rem] h-[6.6rem] text-sm rounded-2xl",
    lg: "w-20 h-30 text-base rounded-2xl",
  };

  if (faceDown || !card) {
    return (
      <div
        className={cn("card-back shrink-0 transition-transform", sizes[size], className)}
        style={style}
      />
    );
  }

  const red = isRed(card.suit);
  return (
    <button
      onClick={onClick}
      style={style}
      className={cn(
        "card-face shrink-0 relative flex flex-col items-center justify-between p-1.5 transition-all duration-300 ease-out will-change-transform",
        sizes[size],
        red ? "text-[color:var(--suit-red)]" : "text-[color:var(--suit-dark)]",
        selected && "-translate-y-5 glow-primary",
        playable && !selected && "hover:-translate-y-3 active:-translate-y-1 cursor-pointer",
        !playable && !onClick && "cursor-default",
        className,
      )}
    >
      <div className="self-start leading-none font-bold">
        <div>{card.rank}</div>
        <div className="text-[1em] leading-none">{SUIT_GLYPH[card.suit]}</div>
      </div>
      <div className="text-[2em] leading-none font-bold">{SUIT_GLYPH[card.suit]}</div>
      <div className="self-end leading-none font-bold rotate-180">
        <div>{card.rank}</div>
        <div className="text-[1em] leading-none">{SUIT_GLYPH[card.suit]}</div>
      </div>
    </button>
  );
}

export function SuitBadge({ suit, size = "md" }: { suit: Suit; size?: "sm" | "md" }) {
  const red = isRed(suit);
  const dim = size === "sm" ? "h-8 w-8 text-base" : "h-12 w-12 text-2xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-card-face font-bold shadow-lg",
          dim,
          red ? "text-[color:var(--suit-red)]" : "text-[color:var(--suit-dark)]",
        )}
      >
        {SUIT_GLYPH[suit]}
      </div>
      {size === "md" && (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {SUIT_LABEL[suit]}
        </span>
      )}
    </div>
  );
}
