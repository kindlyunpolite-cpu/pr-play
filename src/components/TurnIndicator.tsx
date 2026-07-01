import { cn } from "@/lib/utils";

interface TurnIndicatorProps {
  player: {
    id: string;
    name: string;
    avatar: string;
    accent?: string;
  };
  remainingMs: number;
  durationMs: number;
  className?: string;
}

const RADIUS = 20;
const STROKE = 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular active-turn countdown with the player's avatar in the center.
 *
 * Mobile-first sizing: 48px on small screens, 56px on desktop.
 * Warning state below 10s, critical state below 5s.
 */
export function TurnIndicator({
  player,
  remainingMs,
  durationMs,
  className,
}: TurnIndicatorProps) {
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const totalSeconds = Math.max(1, Math.ceil(durationMs / 1000));
  const fraction = Math.min(1, Math.max(0, secondsLeft / totalSeconds));
  const offset = CIRCUMFERENCE * (1 - fraction);

  const state =
    secondsLeft < 5 ? "critical" : secondsLeft < 10 ? "warning" : "normal";
  const color =
    state === "critical"
      ? "var(--turn-critical)"
      : state === "warning"
        ? "var(--turn-warning)"
        : "var(--gold)";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative h-12 w-12 shrink-0 sm:h-14 sm:w-14",
          state === "critical" && "animate-pulse",
        )}
        aria-label={`Na tahu ${player.name}, zbývá ${secondsLeft} sekund`}
      >
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r={RADIUS}
            stroke="white"
            strokeOpacity={0.12}
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition:
                "stroke-dashoffset 250ms linear, stroke 250ms ease-in-out",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center p-1.5">
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-full border bg-black/25",
              "border-white/10",
            )}
          >
            <img
              src={player.avatar}
              alt={player.name}
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0)_70%)]" />
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-base"
              style={{ color }}
            >
              {secondsLeft}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          Na tahu
        </span>
        <span className="max-w-[5rem] truncate text-xs font-semibold text-foreground sm:max-w-[8rem]">
          {player.name}
        </span>
      </div>
    </div>
  );
}
