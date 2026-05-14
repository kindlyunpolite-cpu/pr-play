import { cn } from "@/lib/utils";
import { Crown, Wifi, WifiOff, Trophy, Star } from "lucide-react";
import { useState } from "react";

export interface OpponentData {
  id: string;
  name: string;
  /** URL to the character portrait (semi-realistic, transparent PNG). */
  avatar: string;
  cardCount: number;
  isTurn?: boolean;
  online?: boolean;
  rank?: number;
  wins?: number;
  badge?: string;
  /** Stack of chips / score, shown on the panel. */
  chips?: number;
  /** Rim-light accent color for this seat (hex / css color). */
  accent?: string;
}

export type SeatPlacement = "top" | "left" | "right" | "bottom";

interface SeatProps {
  player: OpponentData;
  placement?: SeatPlacement;
  /** Smaller portrait + tighter panel, for cramped layouts. */
  compact?: boolean;
  /** Auto-shrink on small viewports (sm and below). */
  compactMobile?: boolean;
  /** Self/own player styling — slightly less dominant. */
  self?: boolean;
}

/**
 * Seat: large character portrait that extends above an attached info panel.
 * Designed to sit on the edge of the felt with the portrait overflowing outward.
 */
export function Opponent({
  player,
  placement = "top",
  compact = false,
  compactMobile = false,
  self = false,
}: SeatProps) {
  const [expanded, setExpanded] = useState(false);
  const online = player.online ?? true;
  const accent = player.accent ?? "oklch(0.82 0.14 85)";

  const portraitSize = compact
    ? "h-20 w-16"
    : compactMobile
      ? (self ? "h-22 w-18 sm:h-30 sm:w-26" : "h-24 w-20 sm:h-32 sm:w-28")
      : "h-28 w-24 sm:h-32 sm:w-28";
  const panelWidth = compact
    ? "min-w-[140px] max-w-[160px]"
    : compactMobile
      ? (self ? "min-w-[150px] max-w-[170px] sm:min-w-[170px] sm:max-w-[200px]" : "min-w-[150px] max-w-[170px] sm:min-w-[180px] sm:max-w-[210px]")
      : "min-w-[180px] max-w-[210px]";

  return (
    <div
      className={cn("seat group/seat relative flex flex-col items-center select-none")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{ ["--seat-accent" as string]: accent }}
    >
      {/* Portrait — extends upward, overflows the felt edge */}
      <div
        className={cn(
          "relative shrink-0 transition-all duration-500 ease-out",
          portraitSize,
          player.isTurn ? "scale-[1.04]" : "scale-100",
        )}
      >
        {/* Rim/back glow — sits behind the portrait */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-2 bottom-1 top-2 rounded-[40%] blur-2xl transition-opacity duration-500",
            player.isTurn ? "opacity-90" : "opacity-40 group-hover/seat:opacity-70",
          )}
          style={{
            background:
              "radial-gradient(ellipse at center, var(--seat-accent) 0%, transparent 70%)",
          }}
        />
        {/* Floor disc / shadow under the character */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] h-3 w-[78%] rounded-full bg-black/70 blur-md"
        />
        {/* Portrait image */}
        <img
          src={player.avatar}
          alt={player.name}
          loading="lazy"
          width={256}
          height={352}
          draggable={false}
          className={cn(
            "relative z-[1] h-full w-full object-contain object-bottom",
            "drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)]",
            !online && "grayscale opacity-60",
          )}
          style={{
            filter: player.isTurn
              ? `drop-shadow(0 0 12px ${accent}) drop-shadow(0 12px 18px rgba(0,0,0,0.55))`
              : undefined,
          }}
        />
        {player.isTurn && (
          <Crown
            className="absolute -top-1 left-1/2 -translate-x-1/2 z-[2] h-5 w-5 fill-[color:var(--gold)] text-[color:var(--gold)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>

      {/* Info panel — attached below the portrait */}
      <button
        type="button"
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "seat-panel relative z-[2] -mt-3 flex flex-col items-stretch overflow-hidden rounded-lg text-left outline-none",
          "border backdrop-blur-xl transition-all duration-300",
          panelWidth,
          player.isTurn
            ? "border-[color:var(--gold)]/70 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.78),0_0_28px_-4px_var(--seat-accent)]"
            : "border-white/12 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.78)] hover:border-[color:var(--gold)]/35",
        )}
        style={{
          background:
            "linear-gradient(180deg, oklch(0.18 0.025 160 / 0.92) 0%, oklch(0.105 0.02 160 / 0.96) 100%)",
        }}
      >
        {/* Active scan line on the active player's panel */}
        {player.isTurn && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            }}
          />
        )}

        {/* Header row: name + badge */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full ring-2 ring-black/40",
                online ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]" : "bg-zinc-500",
              )}
              aria-label={online ? "Online" : "Offline"}
            />
            <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">
              {player.name}
            </span>
          </div>
          {player.badge && (
            <span
              className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-px rounded-sm border"
              style={{
                color: accent,
                borderColor: `color-mix(in oklab, ${accent} 50%, transparent)`,
                background: `color-mix(in oklab, ${accent} 12%, transparent)`,
              }}
            >
              {player.badge}
            </span>
          )}
        </div>

        {/* Stats row: cards + chips */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-1">
            <div className="flex gap-[2px]">
              {Array.from({ length: Math.min(player.cardCount, 6) }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 w-[4px] rounded-[1px] bg-gradient-to-b from-[color:var(--card-back)] to-[color:var(--card-back)]/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                />
              ))}
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground ml-1">
              ×{player.cardCount}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shadow-[0_0_6px_var(--gold)]" />
            <span className="text-[color:var(--gold)]/90">
              {(player.chips ?? 1200).toLocaleString()}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded mini profile — position based on placement */}
      <div
        className={cn(
          "absolute z-50 origin-center transition-all duration-200 pointer-events-none",
          placement === "top" || placement === "bottom"
            ? "left-1/2 -translate-x-1/2 top-full mt-2"
            : placement === "left"
              ? "left-full ml-2 top-1/2 -translate-y-1/2"
              : "right-full mr-2 top-1/2 -translate-y-1/2",
          expanded ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
        role="tooltip"
      >
        <div className="min-w-[200px] rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/60 p-3 ring-1 ring-[color:var(--gold)]/15">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
            {online ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span>Online · Active</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Disconnected</span>
              </>
            )}
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
