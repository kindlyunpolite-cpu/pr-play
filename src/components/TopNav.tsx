import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Settings, LogOut, Loader2, RefreshCw } from "lucide-react";

export function TopNav({
  roomCode,
  onLeave,
  leaving = false,
  onRefresh,
  refreshing = false,
}: {
  roomCode?: string;
  onLeave?: () => void;
  leaving?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--gold)]/12 bg-gradient-to-b from-black/90 via-background/74 to-background/44 backdrop-blur-xl shadow-[0_10px_24px_-18px_rgba(0,0,0,0.95)]">
      <div className="mx-auto grid h-12 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 justify-self-start group">
          <div
            className="relative flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-extrabold text-[color:var(--primary-foreground)] ring-1 ring-[color:var(--gold)]/60 shadow-[0_4px_14px_-4px_oklch(0.82_0.14_85/0.55),inset_0_1px_0_oklch(1_0_0/0.35)]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, oklch(0.92 0.12 90) 0%, oklch(0.78 0.16 80) 55%, oklch(0.55 0.14 75) 100%)",
            }}
          >
            P
          </div>
          <span className="font-display text-[13px] font-semibold tracking-[0.22em] uppercase text-foreground/95">
            Prší
          </span>
        </Link>

        {/* Center: room code */}
        <div className="justify-self-center">
          {roomCode && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="uppercase tracking-[0.18em]">Kód</span>
              <span className="font-mono text-[13px] font-bold tracking-[0.22em] text-[color:var(--gold)]">
                {roomCode}
              </span>
            </div>
          )}
        </div>

        {/* Right action */}
        <div className="flex items-center gap-2 justify-self-end">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || leaving}
              className="control-pill group inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/90 transition-all hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)] disabled:opacity-60"
              aria-label="Obnovit stav místnosti"
              title="Obnovit stav místnosti"
            >
              <span className="hidden sm:inline">Obnovit</span>
              <RefreshCw className={cn("h-3 w-3 opacity-80", refreshing && "animate-spin")} />
            </button>
          )}
          {onLeave ? (
            <button
              type="button"
              onClick={onLeave}
              disabled={leaving}
              className="control-pill group inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/90 hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)] transition-all disabled:opacity-60"
            >
              <span className="hidden sm:inline">Opustit</span>
              {leaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LogOut className="h-3 w-3 opacity-80" />
              )}
            </button>
          ) : (
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground transition">
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
