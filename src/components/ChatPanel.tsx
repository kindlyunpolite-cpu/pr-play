import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPortrait } from "@/lib/portraits";
import { sendMessage } from "@/lib/rooms.functions";
import type { RoomMessage, RoomSession } from "@/types/room";

interface Msg {
  id: string;
  user: string;
  avatar: string;
  text: string;
  ts: number;
  mine?: boolean;
  system?: boolean;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relative(ts: number) {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 45) return "teď";
  if (diff < 90) return "1m";
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  return formatTime(ts);
}

export function ChatPanel({
  messages = [],
  session,
}: {
  messages?: RoomMessage[];
  session: RoomSession | null;
}) {
  const [open, setOpen] = useState(false);
  const [collapsedDesktop, setCollapsedDesktop] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<number>(0);
  const callSendMessage = useServerFn(sendMessage);
  const msgs = useMemo<Msg[]>(
    () =>
      messages.map((message) => ({
        id: message.id,
        user: message.nickname,
        avatar: message.avatar ?? "",
        text: message.text,
        ts: new Date(message.created_at).getTime(),
        mine: message.player_id === session?.playerId,
      })),
    [messages, session?.playerId],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      lastSeenRef.current = msgs.length;
    } else {
      setUnread(Math.max(0, msgs.length - lastSeenRef.current));
    }
  }, [msgs, open]);

  const send = async () => {
    const t = text.trim();
    if (!t || !session || sending) return;
    setSending(true);
    try {
      await callSendMessage({
        data: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          text: t,
        },
      });
      setText("");
    } catch {
      /* keep production flow server-backed; caller can retry */
    } finally {
      setSending(false);
    }
  };

  const msgCount = msgs.filter((m) => !m.system).length;

  return (
    <>
      {/* Floating launcher (mobile) */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-24 right-3 z-30 lg:hidden",
          "inline-flex items-center gap-1.5 rounded-full px-3 py-2",
          "bg-black/70 border border-white/10 text-[12px] font-semibold text-foreground/90 shadow-xl backdrop-blur",
          "transition active:scale-95",
          open && "hidden",
        )}
        aria-label="Otevřít chat"
      >
        <MessageCircle className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        Chat ({msgCount})
        {unread > 0 && (
          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Desktop collapsed launcher */}
      {collapsedDesktop && (
        <button
          onClick={() => setCollapsedDesktop(false)}
          className="hidden lg:inline-flex fixed bottom-6 right-6 z-30 items-center gap-1.5 rounded-full px-3.5 py-2 bg-black/70 border border-white/10 text-[12px] font-semibold text-foreground/90 shadow-xl backdrop-blur hover:border-[color:var(--gold)]/40 hover:text-[color:var(--gold)] transition"
          aria-label="Otevřít chat"
        >
          <MessageCircle className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Chat ({msgCount})
          {unread > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Backdrop on mobile */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-background/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[78dvh] flex-col rounded-t-2xl border-t border-[color:var(--gold)]/15 bg-popover/95 backdrop-blur-xl shadow-2xl transition-transform duration-300",
          "lg:static lg:max-h-none lg:h-full lg:rounded-none lg:border-l lg:border-[color:var(--gold)]/10 lg:border-t-0 lg:translate-y-0 lg:shadow-none",
          "lg:bg-gradient-to-b lg:from-background/40 lg:via-background/20 lg:to-background/45",
          collapsedDesktop ? "lg:hidden" : "lg:flex lg:w-[16rem]",
          open ? "translate-y-0" : "translate-y-full lg:translate-y-0",
        )}
        role="dialog"
        aria-label="Chat u stolu"
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 lg:hidden">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <header className="flex h-11 items-center justify-between px-3 lg:border-b lg:border-white/8">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.18em]">
              Chat
            </h3>
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {msgs.filter((m) => !m.system).length}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/5 lg:hidden"
            aria-label="Zavřít chat"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCollapsedDesktop(true)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/5"
            aria-label="Skrýt chat"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto scrollbar-thin px-3 py-2">
          {msgs.length === 0 ? (
            <EmptyState />
          ) : (
            msgs.map((m, i) => {
              if (m.system) {
                return (
                  <div key={m.id} className="flex items-center justify-center gap-1.5 py-1">
                    <Sparkles className="h-3 w-3 text-muted-foreground/70" />
                    <span className="text-[11px] text-muted-foreground/80">{m.text}</span>
                    <span className="text-[10px] text-muted-foreground/50">· {relative(m.ts)}</span>
                  </div>
                );
              }
              const prev = msgs[i - 1];
              const grouped =
                prev && !prev.system && prev.user === m.user && m.ts - prev.ts < 60_000;
              const portrait = getPortrait(m.avatar);
              return (
                <div key={m.id} className={cn("flex gap-2", m.mine && "flex-row-reverse")}>
                  <div className="w-7 shrink-0">
                    {!grouped && (
                      <div className="relative h-7 w-7 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                        <img
                          src={portrait.src}
                          alt={portrait.name}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      </div>
                    )}
                  </div>
                  <div className={cn("flex max-w-[78%] flex-col gap-0.5", m.mine && "items-end")}>
                    {!grouped && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-1 text-[10px]",
                          m.mine && "flex-row-reverse",
                        )}
                      >
                        <span className="font-medium text-foreground/80">{m.user}</span>
                        <span className="text-muted-foreground/60 tabular-nums">
                          {formatTime(m.ts)}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-1.5 text-[13px] leading-snug",
                        m.mine
                          ? "bg-[color:var(--gold)] text-[color:var(--primary-foreground)] rounded-tr-sm"
                          : "bg-white/7 text-foreground rounded-tl-sm border border-white/5",
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 border-t border-white/8 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Napiš zprávu…"
            maxLength={240}
            className="control-pill flex-1 px-3.5 py-2 text-[13px] outline-none transition focus:border-[color:var(--gold)]/45"
          />
          <button
            type="submit"
            disabled={!text.trim() || !session || sending}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--primary-foreground)] transition active:scale-95 disabled:opacity-40 shadow-[0_8px_20px_-10px_oklch(0.82_0.14_85/0.6)]"
            aria-label="Odeslat"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Zatím žádné zprávy</p>
      <p className="text-xs text-muted-foreground">
        Pozdrav ostatní u stolu — v klidu a s úsměvem.
      </p>
    </div>
  );
}
