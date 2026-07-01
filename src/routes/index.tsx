import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { RoomShell } from "@/components/ui-room/RoomShell";
import { RoomPanel } from "@/components/ui-room/RoomPanel";
import { RoomButton } from "@/components/ui-room/RoomButton";
import { SeatPortrait } from "@/components/ui-room/SeatPortrait";
import { PORTRAITS, getPortrait } from "@/lib/portraits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Dice5, Dices, ArrowRight, Loader2, LogOut, LogIn, Check, Pencil } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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
import { z } from "zod";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ code: z.string().optional() }),
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

const NAME_POOL = [
  "Karel",
  "Pavla",
  "Tomáš",
  "Eva",
  "Honza",
  "Lenka",
  "Mára",
  "Bára",
  "Petr",
  "Jana",
  "Míša",
  "Dan",
];

function randomName(exclude?: string) {
  const pool = exclude ? NAME_POOL.filter((n) => n !== exclude) : NAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomPortraitId() {
  return PORTRAITS[Math.floor(Math.random() * PORTRAITS.length)].id;
}

function Lobby() {
  const search = Route.useSearch();
  const initialCode = search.code
    ? search.code
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5)
    : "";
  const initialProfile = typeof window !== "undefined" ? loadProfile() : null;
  const [nick, setNick] = useState(() => initialProfile?.nickname ?? randomName());
  const [portraitId, setPortraitId] = useState(() =>
    initialProfile?.avatar && PORTRAITS.some((p) => p.id === initialProfile.avatar)
      ? initialProfile.avatar
      : randomPortraitId(),
  );
  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState<"create" | "join" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();
  const callCreate = useServerFn(createRoom);
  const callJoin = useServerFn(joinRoom);
  useReconnect({
    showMissingError: false,
    showExpiredError: false,
  });

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const portrait = getPortrait(portraitId);
  const canCreate = !submitting && nick.trim().length >= 2;
  const canJoin = canCreate && code.length === 5;
  const joinIntent = code.length > 0;

  const submit = async (mode: "create" | "join") => {
    const nickname = nick.trim();
    if (nickname.length < 2) {
      toast.error("Zadej přezdívku");
      return;
    }
    if (mode === "join" && code.length !== 5) {
      toast.error("Zadej 5místný kód hry");
      return;
    }
    setSubmitting(mode);
    try {
      const result =
        mode === "create"
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
      setSubmitting(null);
    }
  };

  // Persist profile preferences as the user edits them.
  useEffect(() => {
    const trimmed = nick.trim();
    if (!trimmed) return;
    saveProfile({ nickname: trimmed, avatar: portraitId });
  }, [nick, portraitId]);

  const hasSavedProfile =
    typeof window !== "undefined" && (loadProfile() !== null || initialProfile !== null);

  const handleLogout = () => {
    clearSession();
    clearProfile();
    setNick(randomName());
    setPortraitId(randomPortraitId());
    setCode("");
  };

  // Don't block the lobby on reconnect — if a stored session is valid, useReconnect
  // will navigate to /waiting or /game; otherwise the user can start fresh here.

  return (
    <RoomShell>
      <TopNav />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:py-6">
        {/* Hero */}
        <section className="mb-3 text-center sm:mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-3 py-1 mb-3">
            <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] gold-text">
              Online · 2–4 hráči
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            Prší <span className="gold-text">Online</span>
          </h1>
        </section>

        {/* Identity card */}
        <RoomPanel className="mb-3 space-y-3 p-4 sm:mb-5 sm:space-y-4 sm:p-5" tone="active">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="group relative flex h-20 w-16 shrink-0 cursor-pointer items-end justify-center rounded-xl border-2 border-white/10 bg-black/30 transition hover:border-[color:var(--gold)]/60 hover:shadow-[0_0_18px_-6px_oklch(0.82_0.14_85/0.35)] active:scale-95"
              aria-label="Vybrat postavu"
            >
              <SeatPortrait
                src={portrait.src}
                name={portrait.name}
                accent={portrait.accent}
                size="sm"
                active
              />
              <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[color:var(--gold)] text-[color:var(--primary-foreground)] shadow transition group-hover:scale-110">
                <Pencil className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Tvoje přezdívka
              </label>
              <div className="flex gap-2">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  maxLength={16}
                  placeholder="Tvoje jméno"
                  className="control-pill w-full px-3 py-2.5 text-base outline-none transition focus:border-[color:var(--gold)]/50"
                />
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setNick(randomName(nick.trim()))}
                        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition hover:text-[color:var(--gold)] hover:border-[color:var(--gold)]/50 active:scale-95"
                        aria-label="Náhodná přezdívka"
                      >
                        <Dices className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Náhodná přezdívka</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </RoomPanel>

        {/* New Game */}
        <RoomButton
          variant={joinIntent ? "secondary" : "primary"}
          size="lg"
          block
          onClick={() => submit("create")}
          disabled={!canCreate}
          loading={submitting === "create"}
          icon={submitting !== "create" && <Dice5 className="h-5 w-5" />}
          iconRight={<ArrowRight className="h-4 w-4 opacity-70" />}
          className="mb-3 sm:mb-5"
        >
          {submitting === "create" ? "Zakládám…" : "Nová hra"}
        </RoomButton>

        {/* Divider */}
        <div className="mb-2 flex items-center gap-3 sm:mb-4">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            nebo
          </span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        {/* Join */}
        <RoomPanel className="space-y-2 p-3 sm:space-y-3 sm:p-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Mám kód hry
            </label>
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
              placeholder="Zadej kód hry"
              className="control-pill w-full px-4 py-2.5 text-center text-lg font-mono font-bold tracking-[0.3em] outline-none transition focus:border-[color:var(--gold)]/50 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
            />
          </div>
          <RoomButton
            variant={joinIntent ? "primary" : "secondary"}
            size="md"
            block
            onClick={() => submit("join")}
            disabled={!canJoin}
            loading={submitting === "join"}
            icon={submitting !== "join" && <LogIn className="h-4 w-4" />}
          >
            {submitting === "join" ? "Připojuji…" : "Připojit se"}
          </RoomButton>
        </RoomPanel>

        {/* Logout */}
        {hasSavedProfile && (
          <div className="mt-auto flex justify-center pt-4">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground transition hover:border-[color:var(--gold)]/40 hover:text-[color:var(--gold)]"
            >
              <LogOut className="h-3 w-3" />
              Odhlásit
            </button>
          </div>
        )}
      </main>

      {/* Avatar picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[color:var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Vyber postavu</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {PORTRAITS.map((p) => {
              const selected = p.id === portraitId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPortraitId(p.id);
                    setPickerOpen(false);
                  }}
                  aria-pressed={selected}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition active:scale-95",
                    selected
                      ? "border-[color:var(--gold)]/70 bg-[color:var(--gold)]/8 shadow-[0_0_18px_-6px_oklch(0.82_0.14_85/0.6)]"
                      : "border-white/8 bg-black/30 hover:border-[color:var(--gold)]/35",
                  )}
                >
                  <div className="flex h-20 w-full items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-transparent to-black/40">
                    <SeatPortrait
                      src={p.src}
                      name={p.name}
                      accent={p.accent}
                      size="sm"
                      active={selected}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      selected ? "text-[color:var(--gold)]" : "text-muted-foreground",
                    )}
                  >
                    {p.name}
                  </span>
                  {selected && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--primary-foreground)] shadow-md">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </RoomShell>
  );
}
