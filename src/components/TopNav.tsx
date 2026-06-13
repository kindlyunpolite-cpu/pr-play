import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Settings, LogOut, Loader2 } from "lucide-react";

export function TopNav({
  roomCode,
  onLeave,
  leaving = false,
}: {
  roomCode?: string;
  onLeave?: () => void;
  leaving?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
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
            <div className="control-pill flex items-center gap-2 pl-2.5 pr-1 py-0.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 hidden sm:inline">
                Místnost
              </span>
              <span className="rounded-full bg-[color:var(--gold)]/12 border border-[color:var(--gold)]/30 px-2 py-0.5 font-mono text-[12px] font-bold tracking-[0.24em] text-[color:var(--gold)]">
                {roomCode}
              </span>
            </div>
          )}
        </div>

        {/* Right action */}
        <div className="justify-self-end">
          {roomCode ? (
            <button
              type="button"
              onClick={onLeave}
              disabled={leaving || !onLeave}
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

function NavBtn({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-[color:var(--gold)]/12 text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/30"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
