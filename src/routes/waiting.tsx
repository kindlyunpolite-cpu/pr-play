import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import {
  Copy,
  Play,
  UserPlus,
  Loader2,
  Crown,
  Check,
  Share2,
  Link as LinkIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/waiting")({
  head: () => ({
    meta: [
      { title: "Waiting room — Prší" },
      {
        name: "description",
        content: "Waiting for players to join the table.",
      },
    ],
  }),
  component: Waiting,
});

type ConnStatus = "online" | "connecting" | "offline";

interface Player {
  id: string;
  name: string;
  avatar: string;
  host: boolean;
  ready: boolean;
  status: ConnStatus;
  ping?: number;
}

const INITIAL_PLAYERS: Player[] = [
  { id: "me", name: "You", avatar: "🐺", host: true, ready: true, status: "online", ping: 24 },
  { id: "p2", name: "Pavla", avatar: "🦊", host: false, ready: true, status: "online", ping: 58 },
  { id: "p3", name: "Tomáš", avatar: "🐻", host: false, ready: false, status: "connecting", ping: 142 },
];

const STATUS_META: Record<ConnStatus, { label: string; dot: string; ring: string }> = {
  online: { label: "Online", dot: "bg-emerald-400", ring: "ring-emerald-400/40" },
  connecting: { label: "Connecting", dot: "bg-amber-400", ring: "ring-amber-400/40" },
  offline: { label: "Offline", dot: "bg-muted-foreground/50", ring: "ring-muted-foreground/30" },
};

function Waiting() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const code = "K7XQ2";
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/waiting?room=${code}`
      : `https://prsi.app/waiting?room=${code}`;

  const me = players.find((p) => p.id === "me")!;
  const readyCount = players.filter((p) => p.ready).length;
  const canStart = me.host && players.length >= 2 && readyCount === players.length;

  const copyValue = async (value: string, key: "code" | "link") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my Prší room",
          text: `Join my Prší room with code ${code}`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* fallthrough to copy */
      }
    }
    copyValue(inviteUrl, "link");
  };

  const toggleReady = () =>
    setPlayers((prev) =>
      prev.map((p) => (p.id === "me" ? { ...p, ready: !p.ready } : p)),
    );

  const slots = useMemo(() => 4 - players.length, [players.length]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav roomCode={code} />

      <div className="flex flex-1 lg:flex-row flex-col">
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 lg:max-w-2xl">
          {/* Status header */}
          <section className="text-center mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Waiting for players…
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold">Lobby</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the code or link to invite friends.
            </p>
          </section>

          {/* Invite section */}
          <section className="mb-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 backdrop-blur-md p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Room code
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                {players.length}/4 joined
              </span>
            </div>

            <button
              onClick={() => copyValue(code, "code")}
              className="group w-full flex items-center justify-between gap-3 rounded-xl bg-background/40 px-4 py-3 transition active:scale-[0.99] hover:bg-background/60"
              aria-label="Copy room code"
            >
              <span className="font-mono text-3xl font-bold gold-text tracking-[0.35em]">
                {code}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {copied === "code" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </span>
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => copyValue(inviteUrl, "link")}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/50 py-2 text-xs font-medium transition active:scale-[0.98] hover:bg-card"
              >
                {copied === "link" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <LinkIcon className="h-3.5 w-3.5" />
                )}
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
              <button
                onClick={share}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/50 py-2 text-xs font-medium transition active:scale-[0.98] hover:bg-card"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </section>

          {/* Players */}
          <section>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Players
              </h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {readyCount}/{players.length} ready
              </span>
            </div>

            <ul className="space-y-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card/60 backdrop-blur p-3 transition",
                    p.ready
                      ? "border-primary/40"
                      : "border-border",
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-2xl shadow-inner">
                      {p.avatar}
                    </div>
                    {p.host && (
                      <Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-primary fill-primary drop-shadow" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{p.name}</span>
                      {p.host && (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider gold-text">
                          Host
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.ready ? "Ready" : "Not ready"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition",
                      p.ready ? "bg-primary shadow shadow-primary/40" : "bg-muted-foreground/40",
                    )}
                  />
                </li>
              ))}

              {Array.from({ length: slots }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-border/50 p-3 text-muted-foreground"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Open seat</span>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <ChatPanel />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 border-t border-border/40 bg-gradient-to-t from-background via-background/95 to-background/70 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pt-3 lg:max-w-2xl">
          <button
            onClick={toggleReady}
            className={cn(
              "flex-1 h-12 rounded-2xl text-sm font-semibold transition active:scale-[0.99] flex items-center justify-center gap-2",
              me.ready
                ? "bg-card border border-primary/40 text-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Check className={cn("h-4 w-4", me.ready ? "text-primary" : "opacity-50")} />
            {me.ready ? "Ready" : "Mark ready"}
          </button>

          {me.host && (
            <button
              onClick={() => navigate({ to: "/game" })}
              disabled={!canStart}
              className="flex-[1.4] h-12 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <Play className="h-4 w-4 fill-current" />
              Start game
            </button>
          )}
        </div>
        {me.host && !canStart && (
          <p className="mt-1.5 px-4 text-center text-[11px] text-muted-foreground">
            All players must be ready (min 2)
          </p>
        )}
      </div>
    </div>
  );
}
