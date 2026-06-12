import { cn } from "@/lib/utils";

/**
 * Shared dark felt-and-gold backdrop used across lobby, waiting, and game.
 * Keeps the whole product feeling like the same card room.
 */
export function RoomShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[100dvh] flex flex-col text-foreground",
        className,
      )}
    >
      {/* Ambient felt glow — sits behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, oklch(0.32 0.08 160 / 0.55) 0%, transparent 60%),\
             radial-gradient(ellipse 60% 40% at 12% 60%, oklch(0.45 0.16 25 / 0.10) 0%, transparent 65%),\
             radial-gradient(ellipse 60% 40% at 88% 55%, oklch(0.50 0.18 300 / 0.10) 0%, transparent 65%),\
             radial-gradient(ellipse at bottom, oklch(0.06 0.02 160) 0%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
