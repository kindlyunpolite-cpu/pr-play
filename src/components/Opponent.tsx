import { cn } from "@/lib/utils";
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
  compact = false,
}: {
  player: OpponentData;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-card/70 backdrop-blur-md transition-all duration-300 shrink-0",
        compact ? "px-2 py-1" : "px-2.5 py-1.5",
        player.isTurn
          ? "ring-turn animate-turn bg-card/95 scale-[1.04]"
          : "ring-1 ring-border/50 opacity-70",
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-primary/90 shadow-inner transition-all",
            compact ? "h-7 w-7 text-sm" : "h-8 w-8 text-base",
            player.isTurn && "ring-2 ring-primary ring-offset-2 ring-offset-card",
          )}
        >
          {player.avatar}
        </div>
        {player.isTurn && (
          <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-3 text-primary fill-primary drop-shadow" />
        )}
      </div>
      <div className="flex flex-col leading-tight pr-1 min-w-0">
        <span
          className={cn(
            "text-[11px] font-semibold truncate max-w-[80px]",
            player.isTurn ? "text-foreground" : "text-foreground/80",
          )}
        >
          {player.name}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground tabular-nums">{player.cardCount}</span>
          <div className="flex gap-[1px]">
            {Array.from({ length: Math.min(player.cardCount, 5) }).map((_, i) => (
              <div
                key={i}
                className="h-2 w-[3px] rounded-sm bg-[color:var(--card-back)] opacity-80"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
