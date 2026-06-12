import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/**
 * The signature "card room panel" surface — gradient + gold rim + backdrop blur.
 * Used for lobby form, waiting-room seats, dialogs.
 */
export const RoomPanel = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { tone?: "default" | "active" | "muted" }
>(({ className, tone = "default", style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        "relative rounded-2xl border backdrop-blur-xl",
        tone === "active" &&
          "border-[color:var(--gold)]/55 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85),0_0_28px_-6px_oklch(0.82_0.14_85/0.35)]",
        tone === "default" &&
          "border-white/10 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)]",
        tone === "muted" && "border-dashed border-white/10 opacity-80",
        className,
      )}
      style={{
        background:
          tone === "muted"
            ? "linear-gradient(180deg, oklch(0.16 0.02 160 / 0.6), oklch(0.08 0.015 160 / 0.6))"
            : "linear-gradient(180deg, oklch(0.20 0.028 160 / 0.92) 0%, oklch(0.11 0.022 160 / 0.96) 100%)",
        ...style,
      }}
    />
  );
});
RoomPanel.displayName = "RoomPanel";
