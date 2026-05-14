import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { Opponent, type OpponentData } from "@/components/Opponent";
import { PlayingCard, SuitBadge, type CardData } from "@/components/PlayingCard";
import { useState } from "react";
import { Crown, Timer } from "lucide-react";

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

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav roomCode="K7XQ2" />

      <div className="flex flex-1 lg:flex-row flex-col">
        <main className="flex-1 px-3 py-4 flex flex-col">
          {/* Turn banner */}
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3 py-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs">
              <span className="font-semibold">Tomáš</span>
              <span className="text-muted-foreground"> is playing</span>
            </span>
            <span className="mx-1 h-3 w-px bg-border" />
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-mono">0:18</span>
          </div>

          {/* Felt table */}
          <div className="felt-table relative flex-1 rounded-[2rem] p-3 flex flex-col">
            {/* Top opponent */}
            <div className="flex justify-center pb-2">
              <Opponent player={OPPONENTS[1]} position="top" />
            </div>

            {/* Side opponents + center */}
            <div className="flex-1 flex items-center justify-between gap-2">
              <Opponent player={OPPONENTS[0]} position="left" />

              {/* Center area */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-end gap-3">
                  {/* Draw deck */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <PlayingCard faceDown size="md" className="absolute -top-1 -left-1 opacity-60" />
                      <PlayingCard faceDown size="md" className="absolute -top-0.5 -left-0.5 opacity-80" />
                      <PlayingCard faceDown size="md" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Deck · 24</span>
                  </div>

                  {/* Discard pile */}
                  <div className="flex flex-col items-center gap-1.5">
                    <PlayingCard card={TOP_DISCARD} size="md" className="rotate-3" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pile</span>
                  </div>
                </div>

                {/* Active suit */}
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/40 backdrop-blur px-2.5 py-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Suit</span>
                  <SuitBadge suit={activeSuit} size="sm" />
                </div>
              </div>

              <Opponent player={OPPONENTS[2]} position="right" />
            </div>

            {/* My turn indicator */}
            <div className="text-center pt-2">
              <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                myTurn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {myTurn ? "Your turn" : "Waiting…"}
              </span>
            </div>
          </div>

          {/* My hand */}
          <div className="pt-4 pb-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-sm">
                  🐺
                </div>
                <span className="text-sm font-semibold">You</span>
                <span className="text-xs text-muted-foreground">· {HAND.length} cards</span>
              </div>
              <button
                disabled={!myTurn}
                className="rounded-full bg-card border border-border px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                Draw
              </button>
            </div>

            <div className="relative flex justify-center items-end h-28 overflow-x-auto scrollbar-thin px-2">
              <div className="flex items-end">
                {HAND.map((card, i) => {
                  const offset = (i - (HAND.length - 1) / 2);
                  return (
                    <PlayingCard
                      key={i}
                      card={card}
                      size="md"
                      playable={myTurn}
                      selected={selected === i}
                      onClick={() => setSelected(selected === i ? null : i)}
                      className="-mr-6 last:mr-0"
                      style={{
                        transform: `rotate(${offset * 3}deg) translateY(${Math.abs(offset) * 2}px)`,
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
