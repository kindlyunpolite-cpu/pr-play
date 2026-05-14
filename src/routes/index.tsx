import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import {
  Plus,
  LogIn,
  Sparkles,
  Dice5,
  Shuffle,
  ArrowRight,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createRoom, joinRoom } from "@/lib/rooms.functions";
import { saveSession } from "@/lib/room-session";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prší — Online multiplayer card game" },
      {
        name: "description",
        content:
          "Play the classic Czech card game Prší with friends online. Create or join a room in seconds.",
      },
      { property: "og:title", content: "Prší — Online multiplayer card game" },
      {
        property: "og:description",
        content: "Play the classic Czech card game Prší with friends online.",
      },
    ],
  }),
  component: Lobby,
});

const AVATARS = ["🦊", "🐺", "🐻", "🦁", "🐯", "🐼", "🦉", "🐸", "🐲", "🦄"];
const NAME_POOL = [
  "Karel",
  "Pavla",
  "Tomáš",
  "Eva",
  "Honza",
  "Lenka",
  "Mára",
  "Bára",
];

function Lobby() {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const callCreate = useServerFn(createRoom);
  const callJoin = useServerFn(joinRoom);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      nick.trim().length >= 2 &&
      (tab === "create" || code.length === 5),
    [nick, code, tab, submitting],
  );

  const go = async () => {
    if (!canSubmit) return;
    const nickname = nick.trim();
    setSubmitting(true);
    try {
      const result =
        tab === "create"
          ? await callCreate({ data: { nickname, avatar } })
          : await callJoin({ data: { code, nickname, avatar } });
      saveSession({
        roomCode: result.roomCode,
        roomId: result.roomId,
        playerId: result.playerId,
        sessionToken: result.sessionToken,
        seat: result.seat,
        nickname,
        avatar,
      });
      navigate({ to: "/waiting", search: { code: result.roomCode } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message.replace(/^Error:\s*/i, ""));
    } finally {
      setSubmitting(false);
    }
  };

  const randomize = () =>
    setNick(NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {/* Hero */}
        <section className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium uppercase tracking-widest gold-text">
              Online · 2–4 players
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Play <span className="gold-text">Prší</span>
            <br />
            with friends
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quick rounds, big laughs. No signup.
          </p>
        </section>

        {/* Identity preview */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-3">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-3xl shadow-inner shrink-0",
              "ring-2 ring-offset-2 ring-offset-card transition-all",
              nick ? "ring-primary" : "ring-border",
            )}
          >
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Playing as
            </div>
            <div className="truncate font-display text-lg font-semibold">
              {nick.trim() || "Choose a name"}
            </div>
          </div>
          <button
            type="button"
            onClick={randomize}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:text-foreground active:scale-95"
            aria-label="Random name"
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-1 mb-4 grid grid-cols-2 gap-1">
          <TabBtn
            active={tab === "create"}
            onClick={() => setTab("create")}
            icon={<Plus className="h-4 w-4" />}
          >
            Create
          </TabBtn>
          <TabBtn
            active={tab === "join"}
            onClick={() => setTab("join")}
            icon={<LogIn className="h-4 w-4" />}
          >
            Join
          </TabBtn>
        </div>

        {/* Form card */}
        <div className="space-y-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5">
          <Field label="Your nickname">
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              placeholder="e.g. Karel"
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-base outline-none transition focus:border-primary"
            />
          </Field>

          <Field label="Pick an avatar">
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-xl border text-2xl transition active:scale-95",
                    avatar === a
                      ? "border-primary bg-primary/15 scale-105 shadow-md shadow-primary/20"
                      : "border-border bg-background/40 hover:border-primary/50",
                  )}
                  aria-label={`Avatar ${a}`}
                  aria-pressed={avatar === a}
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
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                inputMode="text"
                autoCapitalize="characters"
                placeholder="ABCDE"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none transition focus:border-primary"
              />
            </Field>
          )}

          <button
            type="button"
            onClick={go}
            disabled={!canSubmit}
            className="group w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tab === "create" ? (
              <>
                <Dice5 className="h-4 w-4" />
                Create new room
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Join room
              </>
            )}
            <ArrowRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Footer hint */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Up to 4 players ·</span>
          <Link to="/game" className="underline gold-text">
            preview a live table
          </Link>
        </div>
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition active:scale-[0.98]",
        active
          ? "bg-primary text-primary-foreground shadow shadow-primary/20"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
