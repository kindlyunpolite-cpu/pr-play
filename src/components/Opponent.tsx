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
  const positionClasses = {
    top: "flex-col items-center",
    left: "flex-col items-center",
    right: "flex-col items-center",
  };

  return (
    <div className={cn("flex gap-2", positionClasses[position])}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card/80 backdrop-blur px-2.5 py-1.5 transition-all",
          player.isTurn
            ? "border-primary glow-primary"
            : "border-border",
        )}
      >
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-base">
            {player.avatar}
          </div>
          {player.isTurn && (
            <Crown className="absolute -top-2 -right-2 h-3.5 w-3.5 text-primary fill-primary" />
          )}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
          <span className="text-[10px] text-muted-foreground">{player.cardCount} cards</span>
        </div>
      </div>

      <div className="relative flex h-10 items-center justify-center">
        {Array.from({ length: Math.min(player.cardCount, 7) }).map((_, i) => (
          <PlayingCard
            key={i}
            faceDown
            size="xs"
            className="absolute"
            style={{
              transform: `translateX(${(i - Math.min(player.cardCount, 7) / 2) * 10}px) rotate(${
                (i - Math.min(player.cardCount, 7) / 2) * 4
              }deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
