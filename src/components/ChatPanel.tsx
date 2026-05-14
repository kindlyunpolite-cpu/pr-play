import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  id: number;
  user: string;
  avatar: string;
  text: string;
  ts: number;
  mine?: boolean;
  system?: boolean;
}

const NOW = Date.now();
const SEED: Msg[] = [
  { id: 1, user: "System", avatar: "✨", text: "Pavla joined the table", ts: NOW - 5 * 60_000, system: true },
  { id: 2, user: "Pavla", avatar: "🦊", text: "Good luck everyone!", ts: NOW - 4 * 60_000 },
  { id: 3, user: "Tomáš", avatar: "🐻", text: "Watch out for the sevens 😉", ts: NOW - 2 * 60_000 },
  { id: 4, user: "You", avatar: "🐺", text: "Bring it on", ts: NOW - 60_000, mine: true },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relative(ts: number) {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 45) return "now";
  if (diff < 90) return "1m";
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  return formatTime(ts);
}

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<number>(SEED.length);

  // Auto-scroll on new messages or when opening
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  // Track unread on mobile while drawer closed
  useEffect(() => {
    if (open) {
      setUnread(0);
      lastSeenRef.current = msgs.length;
    } else {
      setUnread(Math.max(0, msgs.length - lastSeenRef.current));
    }
  }, [msgs, open]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [
      ...m,
      { id: Date.now(), user: "You", avatar: "🐺", text: t, ts: Date.now(), mine: true },
    ]);
    setText("");
  };

  return (
    <>
      {/* Floating launcher (mobile only) */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-30",
          "flex h-12 w-12 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-xl shadow-primary/30",
          "transition active:scale-95 lg:hidden",
          open && "hidden",
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

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
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[82dvh] flex-col rounded-t-2xl border-t border-[color:var(--gold)]/15 bg-popover/95 backdrop-blur-xl shadow-2xl transition-transform duration-300",
          "lg:static lg:max-h-none lg:h-full lg:w-full lg:max-w-[18rem] lg:rounded-none lg:border-l lg:border-[color:var(--gold)]/10 lg:border-t-0 lg:translate-y-0 lg:shadow-none",
          "lg:bg-gradient-to-b lg:from-background/36 lg:via-background/14 lg:to-background/42 lg:backdrop-blur-xl",
          open ? "translate-y-0" : "translate-y-full lg:translate-y-0",
        )}
        role="dialog"
        aria-label="Table chat"
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 lg:hidden">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <header className="flex h-12 items-center justify-between px-4 lg:h-14 lg:border-b lg:border-[color:var(--gold)]/10">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Table chat</h3>
            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {msgs.filter((m) => !m.system).length}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted lg:hidden"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-2.5 overflow-y-auto scrollbar-thin px-3 py-3"
        >
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
              const grouped = prev && !prev.system && prev.user === m.user && m.ts - prev.ts < 60_000;
              return (
                <div key={m.id} className={cn("flex gap-2", m.mine && "flex-row-reverse")}>
                  <div className="w-7 shrink-0">
                    {!grouped && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm">
                        {m.avatar}
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
                         "rounded-2xl px-3 py-1.5 text-sm leading-snug shadow-[0_8px_20px_-14px_rgba(0,0,0,0.9)]",
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
            send();
          }}
          className="flex items-center gap-2 border-t border-[color:var(--gold)]/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message the table…"
            maxLength={240}
            className="control-pill flex-1 px-4 py-2 text-sm outline-none transition focus:border-[color:var(--gold)]/45"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--primary-foreground)] transition active:scale-95 disabled:opacity-40 shadow-[0_8px_24px_-10px_oklch(0.82_0.14_85/0.6)]"
            aria-label="Send message"
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
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No messages yet</p>
      <p className="text-xs text-muted-foreground">
        Say hi to your table — keep it friendly and have fun.
      </p>
    </div>
  );
}
