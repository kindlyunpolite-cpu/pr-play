import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { Copy, Play, UserPlus, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/waiting")({
  head: () => ({
    meta: [
      { title: "Waiting room — Prší" },
      { name: "description", content: "Waiting for players to join the table." },
    ],
  }),
  component: Waiting,
});

const PLAYERS = [
  { name: "You", avatar: "🐺", host: true, ready: true },
  { name: "Pavla", avatar: "🦊", host: false, ready: true },
  { name: "Tomáš", avatar: "🐻", host: false, ready: false },
];

function Waiting() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const code = "K7XQ2";

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav roomCode={code} />

      <div className="flex flex-1 lg:flex-row flex-col">
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 lg:max-w-2xl">
          <section className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Waiting for players…
            </div>
            <h1 className="font-display text-2xl font-bold">Share the code</h1>
            <button
              onClick={copy}
              className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-3 transition hover:bg-primary/20"
            >
              <span className="font-mono text-3xl font-bold gold-text tracking-[0.3em]">{code}</span>
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
            {copied && <p className="mt-2 text-xs gold-text">Copied to clipboard</p>}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Players · {PLAYERS.length}/4
              </h2>
            </div>

            <ul className="space-y-2">
              {PLAYERS.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 backdrop-blur p-3"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary text-2xl">
                    {p.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {p.host && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider gold-text">Host</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.ready ? "Ready" : "Not ready"}</span>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${p.ready ? "bg-primary" : "bg-muted-foreground/40"}`} />
                </li>
              ))}

              {Array.from({ length: 4 - PLAYERS.length }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-border/60 p-3 text-muted-foreground"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Waiting for player…</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate({ to: "/game" })}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" /> Start game
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              You can start with at least 2 players
            </p>
          </section>
        </main>

        <ChatPanel />
      </div>
    </div>
  );
}
