import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Settings, LogOut } from "lucide-react";

export function TopNav({ roomCode }: { roomCode?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
            P
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Prší</span>
        </Link>

        {roomCode ? (
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Room</span>
            <span className="font-mono text-sm font-bold gold-text tracking-[0.2em]">{roomCode}</span>
          </div>
        ) : (
          <nav className="flex items-center gap-1">
            <NavBtn to="/" active={path === "/"} icon={<Home className="h-4 w-4" />} label="Lobby" />
            <NavBtn to="/waiting" active={path === "/waiting"} icon={<Users className="h-4 w-4" />} label="Room" />
          </nav>
        )}

        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
          {roomCode ? <LogOut className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

function NavBtn({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
