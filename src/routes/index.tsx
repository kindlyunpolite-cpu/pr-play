import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { RoomShell } from "@/components/ui-room/RoomShell";
import { RoomPanel } from "@/components/ui-room/RoomPanel";
import { RoomButton } from "@/components/ui-room/RoomButton";
import { SectionTitle } from "@/components/ui-room/SectionTitle";
import { SeatPortrait } from "@/components/ui-room/SeatPortrait";
import { PortraitPicker } from "@/components/ui-room/PortraitPicker";
import { PORTRAITS, getPortrait } from "@/lib/portraits";
import { Plus, LogIn, Sparkles, Dice5, Shuffle, ArrowRight, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRoom, joinRoom } from "@/lib/rooms.functions";
import {
  saveSession,
  saveProfile,
  loadProfile,
  clearProfile,
  clearSession,
} from "@/lib/room-session";
import { useReconnect } from "@/hooks/use-reconnect";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prší — Online karetní hra s přáteli" },
      {
        name: "description",
        content:
          "Hraj klasické Prší online se svými přáteli. Vytvoř nebo se připoj do místnosti během pár vteřin.",
      },
      { property: "og:title", content: "Prší — Online karetní hra s přáteli" },
      {
        property: "og:description",
        content: "Hraj klasické české Prší online se svými přáteli.",
      },
    ],
  }),
  component: Lobby,
});

const NAME_POOL = ["Karel", "Pavla", "Tomáš", "Eva", "Honza", "Lenka", "Mára", "Bára"];

function Lobby() {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [nick, setNick] = useState("");
  const [portraitId, setPortraitId] = useState(PORTRAITS[0].id);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const callCreate = useServerFn(createRoom);
  const callJoin = useServerFn(joinRoom);
  const { status: reconnectStatus } = useReconnect({
    showMissingError: false,
    showExpiredError: false,
  });

  const portrait = getPortrait(portraitId);

  const canSubmit = useMemo(
    () => !submitting && nick.trim().length >= 2 && (tab === "create" || code.length === 5),
    [nick, code, tab, submitting],
  );

  const go = async () => {
    if (!canSubmit) return;
    const nickname = nick.trim();
    setSubmitting(true);
    try {
      const result =
        tab === "create"
          ? await callCreate({ data: { nickname, avatar: portraitId } })
          : await callJoin({ data: { code, nickname, avatar: portraitId } });
      saveSession({
        roomCode: result.roomCode,
        roomId: result.roomId,
        playerId: result.playerId,
        sessionToken: result.sessionToken,
        seat: result.seat,
        nickname,
        avatar: portraitId,
      });
      navigate({ to: "/waiting", search: { code: result.roomCode } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Něco se nepovedlo";
      toast.error(message.replace(/^Error:\s*/i, ""));
    } finally {
      setSubmitting(false);
    }
  };

  const randomize = () => setNick(NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]);

  if (reconnectStatus === "checking") {
    return (
      <RoomShell className="items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--gold)]" />
          Obnovuji uloženou session…
        </div>
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <TopNav />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {/* Hero */}
        <section className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-3 py-1 mb-3">
            <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] gold-text">
              Online · 2–4 hráči
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            Hraj <span className="gold-text">Prší</span>
            <br />s přáteli
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Rychlé partie, žádná registrace.</p>
        </section>

        {/* Identity preview */}
        <RoomPanel className="mb-4 flex items-center gap-3 p-3" tone={nick ? "active" : "default"}>
          <div className="flex h-16 w-14 shrink-0 items-end justify-center">
            <SeatPortrait
              src={portrait.src}
              name={portrait.name}
              accent={portrait.accent}
              size="sm"
              active={!!nick}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Hraješ jako
            </div>
            <div className="truncate font-display text-lg font-semibold">
              {nick.trim() || "Zadej přezdívku"}
            </div>
          </div>
          <button
            type="button"
            onClick={randomize}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition hover:text-foreground hover:border-[color:var(--gold)]/40 active:scale-95"
            aria-label="Náhodné jméno"
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </RoomPanel>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-white/8 bg-black/30 backdrop-blur-md p-1">
          <TabBtn
            active={tab === "create"}
            onClick={() => setTab("create")}
            icon={<Plus className="h-4 w-4" />}
          >
            Založit hru
          </TabBtn>
          <TabBtn
            active={tab === "join"}
            onClick={() => setTab("join")}
            icon={<LogIn className="h-4 w-4" />}
          >
            Připojit se
          </TabBtn>
        </div>

        {/* Form card */}
        <RoomPanel className="p-5 space-y-5">
          <Field label="Tvoje přezdívka">
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              placeholder="např. Karel"
              className="control-pill w-full px-4 py-3 text-base outline-none transition focus:border-[color:var(--gold)]/50"
            />
          </Field>

          <Field label="Vyber postavu">
            <PortraitPicker value={portraitId} onChange={setPortraitId} />
          </Field>

          {tab === "join" && (
            <Field label="Kód místnosti">
              <input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 5),
                  )
                }
                inputMode="text"
                autoCapitalize="characters"
                placeholder="ABCDE"
                className="control-pill w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none transition focus:border-[color:var(--gold)]/50"
              />
            </Field>
          )}

          <RoomButton
            variant="primary"
            size="lg"
            block
            onClick={go}
            disabled={!canSubmit}
            loading={submitting}
            icon={
              !submitting &&
              (tab === "create" ? <Dice5 className="h-4 w-4" /> : <LogIn className="h-4 w-4" />)
            }
            iconRight={<ArrowRight className="h-4 w-4 opacity-70" />}
          >
            {submitting
              ? tab === "create"
                ? "Zakládám…"
                : "Připojuji…"
              : tab === "create"
                ? "Vytvořit hru"
                : "Připojit se"}
          </RoomButton>
        </RoomPanel>

        {/* Footer hint */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Až 4 hráči ·</span>
          <Link to="/game" className="underline gold-text">
            náhled stolu
          </Link>
        </div>
      </main>
    </RoomShell>
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
        "flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition active:scale-[0.98]",
        active
          ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/35"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
