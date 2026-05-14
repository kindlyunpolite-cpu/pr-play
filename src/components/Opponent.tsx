import { cn } from "@/lib/utils";
import { PlayingCard } from "./PlayingCard";
import { Crown } from "lucide-react";

export interface OpponentData {
  id: string;
  name: string;
  avatar: string;
  cardCount: number;
  isTurn?: boolean;
}

export function Opponent({
  player,
  position,
}: {
  player: OpponentData;
  position: "top" | "left" | "right";
}) {
  const fanCount = Math.min(player.cardCount, 6);
  const isVertical = position !== "top";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isVertical ? "flex-col" : "flex-col",
        "transition-all duration-300",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-card/70 backdrop-blur-md px-2.5 py-1.5 transition-all duration-300",
          player.isTurn
            ? "ring-turn animate-turn bg-card/90"
            : "ring-1 ring-border/60 opacity-80",
        )}
      >
        <div className="relative">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-primary/90 text-base shadow-inner",
              player.isTurn && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
          >
            {player.avatar}
          </div>
          {player.isTurn && (
            <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-primary fill-primary drop-shadow" />
          )}
        </div>
        <div className="flex flex-col leading-tight pr-1">
          <span className="text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {player.cardCount} <span className="opacity-70">cards</span>
          </span>
        </div>
      </div>

      <div className="relative flex h-9 items-center justify-center">
        {Array.from({ length: fanCount }).map((_, i) => (
          <PlayingCard
            key={i}
            faceDown
            size="xs"
            className="absolute transition-transform duration-300"
            style={{
              transform: `translateX(${(i - (fanCount - 1) / 2) * 9}px) rotate(${
                (i - (fanCount - 1) / 2) * 5
              }deg)`,
              zIndex: i,
            }}
          />
        ))}
      </div>
    </div>
  );
}
