import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { Opponent, type OpponentData } from "@/components/Opponent";
import { PlayingCard, SuitBadge, type CardData } from "@/components/PlayingCard";
import { useState } from "react";
import { Timer } from "lucide-react";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "Game table — Prší" },
      { name: "description", content: "Live Prší game table." },
    ],
  }),
  component: Game,
});

const OPPONENTS: OpponentData[] = [
  { id: "1", name: "Pavla", avatar: "🦊", cardCount: 4, isTurn: false },
  { id: "2", name: "Tomáš", avatar: "🐻", cardCount: 6, isTurn: true },
  { id: "3", name: "Eva", avatar: "🦉", cardCount: 3, isTurn: false },
];

const HAND: CardData[] = [
  { suit: "hearts", rank: "7" },
  { suit: "hearts", rank: "K" },
  { suit: "leaves", rank: "9" },
  { suit: "bells", rank: "10" },
  { suit: "acorns", rank: "A" },
  { suit: "hearts", rank: "J" },
  { suit: "bells", rank: "Q" },
];

const TOP_DISCARD: CardData = { suit: "hearts", rank: "10" };

function Game() {
  const [selected, setSelected] = useState<number | null>(null);
  const myTurn = false;
  const activeSuit = TOP_DISCARD.suit;
  const activePlayer = OPPONENTS.find((o) => o.isTurn);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav roomCode="K7XQ2" />

      <div className="flex flex-1 lg:flex-row flex-col">
        <main className="flex-1 px-3 sm:px-5 py-3 sm:py-5 flex flex-col gap-3">
          {/* Turn banner */}
          <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-card/60 backdrop-blur-md px-3.5 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs">
              <span className="font-semibold">{activePlayer?.name ?? "—"}</span>
              <span className="text-muted-foreground"> is playing</span>
            </span>
            <span className="h-3 w-px bg-border/70" />
            <Timer className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">0:18</span>
          </div>

          {/* Felt table */}
          <div className="felt-table relative flex-1 rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 flex flex-col">
            {/* Top opponent */}
            <div className="flex justify-center">
              <Opponent player={OPPONENTS[1]} position="top" />
            </div>

            {/* Side opponents + center */}
            <div className="flex-1 flex items-center justify-between gap-2 sm:gap-4 py-3">
              <Opponent player={OPPONENTS[0]} position="left" />

              {/* Center area */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-end gap-4 sm:gap-6">
                  {/* Draw deck */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative h-[6.6rem] w-[4.5rem]">
                      <PlayingCard faceDown size="md" className="absolute top-1 left-1 opacity-50" />
                      <PlayingCard faceDown size="md" className="absolute top-0.5 left-0.5 opacity-75" />
                      <PlayingCard faceDown size="md" className="absolute top-0 left-0" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 tabular-nums">
                      Deck · 24
                    </span>
                  </div>

                  {/* Discard pile */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative h-[6.6rem] w-[4.5rem]">
                      <PlayingCard
                        card={{ suit: "leaves", rank: "8" }}
                        size="md"
                        className="absolute top-0 left-0 -rotate-6 opacity-60"
                      />
                      <PlayingCard card={TOP_DISCARD} size="md" className="absolute top-0 left-0 rotate-3" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80">
                      Pile
                    </span>
                  </div>
                </div>

                {/* Active suit */}
                <div className="flex items-center gap-2.5 rounded-full bg-background/50 backdrop-blur-md px-3 py-1.5 ring-1 ring-border/40">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Suit
                  </span>
                  <SuitBadge suit={activeSuit} size="sm" />
                </div>
              </div>

              <Opponent player={OPPONENTS[2]} position="right" />
            </div>
          </div>

          {/* My hand */}
          <div className="pt-1">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-sm shadow-sm">
                  🐺
                </div>
                <span className="text-sm font-semibold">You</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  · {HAND.length} cards
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    myTurn
                      ? "bg-primary text-primary-foreground shadow shadow-primary/30"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {myTurn ? "Your turn" : "Waiting"}
                </span>
                <button
                  disabled={!myTurn}
                  className="rounded-full bg-card/80 border border-border/60 px-3 py-1 text-xs font-medium transition hover:bg-card disabled:opacity-40"
                >
                  Draw
                </button>
              </div>
            </div>

            <div className="relative flex justify-center items-end h-32 overflow-x-auto no-scrollbar px-2">
              <div className="flex items-end pt-4">
                {HAND.map((card, i) => {
                  const offset = i - (HAND.length - 1) / 2;
                  return (
                    <PlayingCard
                      key={i}
                      card={card}
                      size="md"
                      playable={myTurn}
                      selected={selected === i}
                      onClick={() => setSelected(selected === i ? null : i)}
                      className="-mr-7 last:mr-0"
                      style={{
                        transform: `rotate(${offset * 3.5}deg) translateY(${Math.abs(offset) * 3}px)`,
                        zIndex: i,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <ChatPanel />
      </div>
    </div>
  );
}
