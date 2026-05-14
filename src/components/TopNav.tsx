import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Settings, LogOut } from "lucide-react";

export function TopNav({ roomCode }: { roomCode?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--gold)]/12 bg-gradient-to-b from-black/90 via-background/74 to-background/44 backdrop-blur-xl shadow-[0_12px_30px_-18px_rgba(0,0,0,0.95)]">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 justify-self-start group">
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-extrabold text-[color:var(--primary-foreground)] ring-1 ring-[color:var(--gold)]/60 shadow-[0_4px_18px_-4px_oklch(0.82_0.14_85/0.55),inset_0_1px_0_oklch(1_0_0/0.35)]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, oklch(0.92 0.12 90) 0%, oklch(0.78 0.16 80) 55%, oklch(0.55 0.14 75) 100%)",
            }}
          >
            P
          </div>
          <span className="font-display text-lg font-semibold tracking-[0.2em] uppercase text-foreground/95">
            Prší
          </span>
        </Link>

        {/* Center: room code or nav */}
        <div className="justify-self-center">
          {roomCode ? (
            <div className="control-pill flex items-center gap-2 pl-3 pr-1 py-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
                Room
              </span>
              <span className="rounded-full bg-[color:var(--gold)]/12 border border-[color:var(--gold)]/30 px-2.5 py-0.5 font-mono text-sm font-bold tracking-[0.25em] text-[color:var(--gold)]">
                {roomCode}
              </span>
            </div>
          ) : (
            <nav className="flex items-center gap-1">
              <NavBtn to="/" active={path === "/"} icon={<Home className="h-4 w-4" />} label="Lobby" />
              <NavBtn to="/waiting" active={path === "/waiting"} icon={<Users className="h-4 w-4" />} label="Room" />
            </nav>
          )}
        </div>

        {/* Right action */}
        <div className="justify-self-end">
          {roomCode ? (
            <button
              type="button"
              className="control-pill group inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/90 hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)] transition-all"
            >
              <span className="hidden sm:inline">Leave room</span>
              <span className="sm:hidden">Leave</span>
              <LogOut className="h-3.5 w-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground transition">
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
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
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
