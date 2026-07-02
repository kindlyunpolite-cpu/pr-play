import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type Tone = "default" | "active" | "warning" | "danger";

const toneRing: Record<Tone, string> = {
  default:
    "ring-1 ring-[color:var(--gold)]/25 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9),0_0_0_1px_oklch(0.82_0.14_85/0.15)_inset]",
  active:
    "ring-1 ring-[color:var(--gold)]/55 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.9),0_0_18px_-4px_oklch(0.82_0.14_85/0.55)]",
  warning:
    "ring-1 ring-amber-400/55 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.9),0_0_18px_-4px_oklch(0.78_0.16_70/0.6)]",
  danger:
    "ring-1 ring-red-400/60 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.9),0_0_18px_-4px_oklch(0.62_0.22_25/0.7)]",
};

/**
 * Compact heads-up-display panel used along the table rim.
 * Board-game style: glassy dark plate, gold rim, micro-label + value.
 */
export const HudPanel = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }
>(({ className, tone = "default", style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    className={cn(
      "relative rounded-2xl border border-white/10 backdrop-blur-xl px-2.5 py-1.5",
      toneRing[tone],
      className,
    )}
    style={{
      background:
        "linear-gradient(180deg, oklch(0.20 0.028 160 / 0.88) 0%, oklch(0.08 0.02 160 / 0.94) 100%)",
      ...style,
    }}
  />
));
HudPanel.displayName = "HudPanel";

export function HudLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[color:var(--gold)]/80">
      {children}
    </span>
  );
}

const RADIUS = 16;
const STROKE = 3.5;
const C = 2 * Math.PI * RADIUS;

export function HudCountdown({
  remainingMs,
  durationMs,
}: {
  remainingMs: number;
  durationMs: number;
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const total = Math.max(1, Math.ceil(durationMs / 1000));
  const frac = Math.min(1, Math.max(0, seconds / total));
  const offset = C * (1 - frac);
  const state = seconds < 5 ? "critical" : seconds < 10 ? "warn" : "ok";
  const color =
    state === "critical"
      ? "oklch(0.65 0.22 25)"
      : state === "warn"
        ? "oklch(0.82 0.16 70)"
        : "var(--gold)";
  return (
    <div
      className={cn(
        "relative h-10 w-10 shrink-0",
        state === "critical" && "animate-pulse",
      )}
      aria-label={`Zbývá ${seconds} sekund`}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          stroke="white"
          strokeOpacity={0.1}
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{
            transition:
              "stroke-dashoffset 250ms linear, stroke 250ms ease-in-out",
          }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums"
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  );
}
