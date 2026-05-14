import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { id: number; user: string; avatar: string; text: string; mine?: boolean; }

const SEED: Msg[] = [
  { id: 1, user: "Pavla", avatar: "🦊", text: "Good luck everyone!" },
  { id: 2, user: "Tomáš", avatar: "🐻", text: "Watch out for the sevens 😉" },
  { id: 3, user: "You", avatar: "🐺", text: "Bring it on", mine: true },
];

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMsgs([...msgs, { id: Date.now(), user: "You", avatar: "🐺", text, mine: true }]);
    setText("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-105 lg:hidden"
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
          {msgs.length}
        </span>
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-popover transition-transform duration-300 lg:static lg:translate-x-0 lg:max-w-xs",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Table chat</h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.mine && "flex-row-reverse")}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                {m.avatar}
              </div>
              <div className={cn("flex max-w-[75%] flex-col gap-0.5", m.mine && "items-end")}>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.user}</span>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-1.5 text-sm",
                    m.mine
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm",
                  )}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-full border border-input bg-background/50 px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 disabled:opacity-50"
            disabled={!text.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </>
  );
}
