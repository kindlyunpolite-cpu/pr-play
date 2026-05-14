import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Plus, LogIn, Sparkles, Dice5 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prší — Online multiplayer card game" },
      { name: "description", content: "Play the classic Czech card game Prší with friends online. Create or join a room in seconds." },
      { property: "og:title", content: "Prší — Online multiplayer card game" },
      { property: "og:description", content: "Play the classic Czech card game Prší with friends online." },
    ],
  }),
  component: Lobby,
});

const AVATARS = ["🦊", "🐺", "🐻", "🦁", "🐯", "🐼", "🦉", "🐸", "🐲", "🦄"];

function Lobby() {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const go = () => navigate({ to: "/waiting" });

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <section className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium uppercase tracking-widest gold-text">Online · 2–4 players</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Play <span className="gold-text">Prší</span><br />with friends
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The classic Czech card game. Quick rounds, big laughs.
          </p>
        </section>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-1 mb-4 grid grid-cols-2 gap-1">
          <TabBtn active={tab === "create"} onClick={() => setTab("create")} icon={<Plus className="h-4 w-4" />}>
            Create room
          </TabBtn>
          <TabBtn active={tab === "join"} onClick={() => setTab("join")} icon={<LogIn className="h-4 w-4" />}>
            Join room
          </TabBtn>
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
          <Field label="Your nickname">
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              placeholder="e.g. Karel"
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-base outline-none focus:border-primary"
            />
          </Field>

          <Field label="Pick an avatar">
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-xl border text-2xl transition",
                    avatar === a
                      ? "border-primary bg-primary/15 scale-105"
                      : "border-border bg-background/40 hover:border-primary/50",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>

          {tab === "join" && (
            <Field label="Room code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="ABCDE"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none focus:border-primary"
              />
            </Field>
          )}

          <button
            onClick={go}
            disabled={!nick || (tab === "join" && code.length < 5)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tab === "create" ? <><Dice5 className="h-4 w-4" /> Create new room</> : <><LogIn className="h-4 w-4" /> Join room</>}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Want to see the table?{" "}
          <Link to="/game" className="underline gold-text">Preview a live game</Link>
        </p>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
