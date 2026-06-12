import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const sizeCls: Record<Size, string> = {
  xs: "h-12 w-10",
  sm: "h-16 w-14",
  md: "h-20 w-16",
  lg: "h-24 w-20 sm:h-28 sm:w-24",
};

interface SeatPortraitProps {
  src: string;
  name?: string;
  accent?: string;
  size?: Size;
  active?: boolean;
  offline?: boolean;
  className?: string;
}

/**
 * Shared character portrait — same visual language for lobby preview,
 * waiting room seats, and in-game opponents.
 */
export function SeatPortrait({
  src,
  name,
  accent = "oklch(0.82 0.14 85)",
  size = "md",
  active = false,
  offline = false,
  className,
}: SeatPortraitProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 transition-transform duration-500",
        sizeCls[size],
        active && "scale-[1.04]",
        className,
      )}
      style={{ ["--seat-accent" as string]: accent }}
    >
      {/* Rim halo */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-1 bottom-1 top-2 rounded-[40%] blur-2xl transition-opacity duration-500",
          active ? "opacity-90" : "opacity-40",
        )}
        style={{
          background:
            "radial-gradient(ellipse at center, var(--seat-accent) 0%, transparent 70%)",
        }}
      />
      {/* Floor shadow */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 bottom-[-4px] h-2.5 w-[78%] rounded-full bg-black/70 blur-md"
      />
      <img
        src={src}
        alt={name ?? ""}
        loading="lazy"
        draggable={false}
        className={cn(
          "relative z-[1] h-full w-full object-contain object-bottom",
          "drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)]",
          offline && "grayscale opacity-60",
        )}
        style={{
          filter: active
            ? `drop-shadow(0 0 10px ${accent}) drop-shadow(0 10px 16px rgba(0,0,0,0.55))`
            : undefined,
        }}
      />
    </div>
  );
}
