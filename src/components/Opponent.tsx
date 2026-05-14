import { cn } from "@/lib/utils";
import { Crown, Wifi, WifiOff, Trophy, Star } from "lucide-react";
import { useState } from "react";

export interface OpponentData {
  id: string;
  name: string;
  avatar: string;
  cardCount: number;
  isTurn?: boolean;
  online?: boolean;
  rank?: number;
  wins?: number;
  badge?: string;
}

export function Opponent({
  player,
  compact = false,
}: {
  player: OpponentData;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const online = player.online ?? true;

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "group flex items-center gap-2 rounded-full backdrop-blur-md transition-all duration-300 outline-none",
          "bg-gradient-to-b from-card/85 to-card/60",
          compact ? "px-2 py-1" : "px-2.5 py-1.5",
          player.isTurn
            ? "ring-turn animate-turn scale-[1.04] from-card/95 to-card/80"
            : "ring-1 ring-border/50 hover:ring-[color:var(--gold)]/40 opacity-90 hover:opacity-100",
        )}
        aria-expanded={expanded}
      >
        {/* Avatar with online dot + crown */}
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
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card",
              online ? "bg-emerald-400" : "bg-muted-foreground/60",
            )}
            aria-label={online ? "Online" : "Offline"}
          />
        </div>

        {/* Identity */}
        <div className="flex flex-col leading-tight pr-1 min-w-0 items-start">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "text-[11px] font-semibold truncate max-w-[80px]",
                player.isTurn ? "text-foreground" : "text-foreground/85",
              )}
            >
              {player.name}
            </span>
            {player.badge && (
              <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded-sm bg-[color:var(--gold)]/15 text-[color:var(--gold)] border border-[color:var(--gold)]/30">
                {player.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {player.cardCount}
            </span>
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
      </button>

      {/* Expanded mini profile */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 origin-top",
          "transition-all duration-200 pointer-events-none",
          expanded
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1",
        )}
        role="tooltip"
      >
        <div className="min-w-[170px] rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/40 p-3 ring-1 ring-[color:var(--gold)]/10">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-lg shadow-inner">
              {player.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate">{player.name}</span>
                {player.isTurn && (
                  <Crown className="h-3 w-3 text-[color:var(--gold)] fill-[color:var(--gold)]" />
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {online ? (
                  <>
                    <Wifi className="h-2.5 w-2.5 text-emerald-400" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-2.5 w-2.5" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Stat icon={<Star className="h-3 w-3" />} label="Rank" value={player.rank ?? "—"} />
            <Stat icon={<Trophy className="h-3 w-3" />} label="Wins" value={player.wins ?? 0} />
            <Stat label="Cards" value={player.cardCount} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted/40 border border-border/40 px-1.5 py-1">
      <div className="flex items-center justify-center gap-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xs font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
