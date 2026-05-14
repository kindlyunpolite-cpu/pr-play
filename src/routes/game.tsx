import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { ChatPanel } from "@/components/ChatPanel";
import { Opponent, type OpponentData, type SeatPlacement } from "@/components/Opponent";
import {
  PlayingCard,
  CardStack,
  DiscardPile,
  SuitBadge,
  type CardData,
} from "@/components/cards";
import { useEffect, useState } from "react";
import { Timer, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import portraitPavla from "@/assets/portraits/pavla.png";
import portraitTomas from "@/assets/portraits/tomas.png";
import portraitEva from "@/assets/portraits/eva.png";
import portraitYou from "@/assets/portraits/you.png";

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
  { id: "1", name: "Pavla", avatar: portraitPavla, cardCount: 4, isTurn: false, rank: 12, wins: 84, chips: 2150, accent: "oklch(0.7 0.18 25)" },
  { id: "2", name: "Tomáš", avatar: portraitTomas, cardCount: 6, isTurn: true, rank: 3, wins: 212, chips: 5400, badge: "Pro", accent: "oklch(0.78 0.16 60)" },
  { id: "3", name: "Eva", avatar: portraitEva, cardCount: 3, isTurn: false, rank: 27, wins: 56, chips: 980, accent: "oklch(0.68 0.22 320)" },
];

const HAND: CardData[] = [
  { suit: "hearts", rank: "7" },
  { suit: "hearts", rank: "K" },
  { suit: "clubs", rank: "9" },
  { suit: "diamonds", rank: "10" },
  { suit: "spades", rank: "A" },
  { suit: "hearts", rank: "J" },
  { suit: "diamonds", rank: "Q" },
];

const TOP_DISCARD: CardData = { suit: "hearts", rank: "10" };

const YOU: OpponentData = {
  id: "me",
  name: "You",
  avatar: portraitYou,
  cardCount: HAND.length,
  isTurn: true,
  rank: 8,
  wins: 142,
  chips: 3200,
  accent: "oklch(0.72 0.2 290)",
};

function Game() {
  const [selected, setSelected] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [pileNonce, setPileNonce] = useState(0);
  const [drawNonce, setDrawNonce] = useState(0);
  const [dealt, setDealt] = useState(false);
  const myTurn = true;
  const activeSuit = TOP_DISCARD.suit;
  const activePlayer = OPPONENTS.find((o) => o.isTurn);

  useEffect(() => {
    const t = setTimeout(() => setDealt(true), HAND.length * 70 + 600);
    return () => clearTimeout(t);
  }, []);

  const handlePlay = (i: number) => {
    if (!myTurn) return;
    if (selected !== i) {
      setSelected(i);
      return;
    }
    setPlayingIdx(i);
    setTimeout(() => {
      setPlayingIdx(null);
      setSelected(null);
      setPileNonce((n) => n + 1);
    }, 320);
  };

  const handleDraw = () => setDrawNonce((n) => n + 1);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <TopNav roomCode="K7XQ2" />

      <div className="flex flex-1 lg:flex-row flex-col min-h-0">
        <main className="game-stage relative flex-1 flex flex-col min-h-0">
          {/* Table arena — seated like the reference, with explicit space above and a compact hand zone below */}
          <div className="table-arena absolute inset-0 z-10 flex items-center justify-center px-4 sm:px-8 lg:px-10 pt-[8rem] sm:pt-[8.75rem] pb-[8.25rem] sm:pb-[8.75rem] pointer-events-none">
            <div className="table-shell relative mx-auto">
              {/* Outer ambient halo — soft glow bleed around the table */}
              <div
                aria-hidden
                className="absolute -inset-20 rounded-[72px] pointer-events-none opacity-90"
                style={{
                  background:
                    "radial-gradient(ellipse at center, oklch(0.82 0.14 85 / 0.10) 0%, oklch(0.55 0.18 220 / 0.08) 34%, transparent 72%)",
                  filter: "blur(24px)",
                }}
              />
              {/* Decorative outer rail — thick layered dimensional table edge */}
              <div
                aria-hidden
                className="absolute -inset-10 sm:-inset-12 rounded-[66px] sm:rounded-[82px] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(0.29 0.035 70) 0%, oklch(0.16 0.025 70) 36%, oklch(0.075 0.015 80) 72%, oklch(0.045 0.012 120) 100%)",
                  boxShadow:
                    "inset 0 4px 0 oklch(1 0 0 / 0.10), inset 0 -7px 0 oklch(0 0 0 / 0.82), inset 0 0 0 1px oklch(0.82 0.14 85 / 0.24), inset 0 0 0 8px oklch(0 0 0 / 0.22), inset 0 0 46px oklch(0 0 0 / 0.70), 0 46px 110px -22px oklch(0 0 0 / 0.95), 0 0 0 1px oklch(0 0 0 / 0.72)",
                }}
              />
              {/* Inner gold piping ring — thin accent between rail and felt */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[48px] sm:rounded-[62px] pointer-events-none"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px oklch(0.82 0.14 85 / 0.38), inset 0 0 0 5px oklch(0 0 0 / 0.28), 0 0 18px -2px oklch(0.82 0.14 85 / 0.25)",
                }}
              />
              {/* Table itself: rounded rectangle, slightly wider */}
              <div
                className="felt-table relative aspect-[16/9.5] w-full rounded-[34px] sm:rounded-[48px]"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at center, color-mix(in oklab, var(--primary) 10%, transparent) 0%, transparent 62%)",
                }}
              >
                {/* Top-left HUD: turn timer */}
                <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 ring-1 ring-white/8 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--gold)] opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
                  </span>
                  <span className="text-[11px] font-semibold truncate max-w-[7rem]">
                    {activePlayer?.name ?? "You"}
                  </span>
                  <span className="h-3 w-px bg-white/10" />
                  <Timer className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">0:18</span>
                </div>

                {/* Top-right HUD: active suit */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 ring-1 ring-white/8 shadow-sm">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Suit
                  </span>
                  <div className="rounded-full bg-[color:var(--gold)]/10 ring-1 ring-[color:var(--gold)]/35 px-1.5 py-0.5">
                    <SuitBadge suit={activeSuit} size="sm" />
                  </div>
                </div>

                {/* Cinematic spotlight halo */}
                <div className="table-spotlight" aria-hidden="true" />

                {/* Center stage: deck + pile */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="center-stage relative z-[1] flex items-center gap-6 sm:gap-10 md:gap-14">
                    <button
                      type="button"
                      onClick={handleDraw}
                      disabled={!myTurn}
                      className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl p-1 -m-1 transition active:scale-95 disabled:opacity-60 disabled:active:scale-100"
                      aria-label="Draw a card"
                    >
                      <CardStack
                        key={drawNonce}
                        count={3}
                        maxVisible={3}
                        size="md"
                        layout="stack"
                        className={drawNonce ? "animate-card-draw" : ""}
                      />
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 tabular-nums">
                        Deck · 24
                      </span>
                    </button>

                    <div className="flex flex-col items-center gap-2">
                      <div key={pileNonce} className={pileNonce ? "animate-pile-bump" : ""}>
                        <DiscardPile
                          cards={[{ suit: "clubs", rank: "8" }, TOP_DISCARD]}
                          size="md"
                          recent
                        />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                        Pile
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seats around the table — portraits sit outside the rail, panels attached to the edge */}
                {OPPONENTS.map((p, i) => {
                  const n = OPPONENTS.length;
                  const seatPos: SeatPlacement[] =
                    n === 1
                      ? ["top"]
                      : n === 2
                        ? ["left", "right"]
                        : ["left", "top", "right"];
                  const pos = seatPos[i] ?? "top";
                  const cls =
                    pos === "top"
                      ? "top-0 left-1/2 -translate-x-1/2 -translate-y-[32%] sm:-translate-y-[36%]"
                      : pos === "left"
                        ? "left-0 top-1/2 -translate-x-[18%] sm:-translate-x-[44%] lg:-translate-x-[50%] -translate-y-1/2"
                        : "right-0 top-1/2 translate-x-[18%] sm:translate-x-[44%] lg:translate-x-[50%] -translate-y-1/2";
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "absolute z-10 pointer-events-auto transition-all duration-500",
                        cls,
                      )}
                    >
                      <Opponent player={p} placement={pos} compactMobile />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Own seat is a separate top layer so cards/action chrome never crop it. */}
          <div className="absolute inset-0 z-40 flex items-center justify-center px-4 sm:px-8 lg:px-10 pt-[8rem] sm:pt-[8.75rem] pb-[8.25rem] sm:pb-[8.75rem] pointer-events-none">
            <div className="table-shell relative mx-auto">
              <div className="relative aspect-[16/9.5] w-full">
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[24%] sm:translate-y-[27%] pointer-events-auto">
                  <Opponent player={YOU} placement="bottom" compactMobile self />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action bar + hand — blends into scene with vertical gradient fade */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/62 to-transparent pb-safe">
            {/* Floating action group */}
            <div className="flex items-center justify-between gap-3 px-4 pt-1 pb-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]",
                  myTurn
                    ? "bg-gradient-to-r from-[color:var(--gold)]/25 to-transparent text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/40"
                    : "bg-white/5 text-muted-foreground ring-1 ring-white/8",
                )}
              >
                <Sparkles className="h-3 w-3" />
                {myTurn ? "Your turn" : "Waiting"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDraw}
                  disabled={!myTurn}
                  className="control-pill h-10 px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/90 hover:border-[color:var(--gold)]/45 hover:text-[color:var(--gold)] transition active:scale-95 disabled:opacity-40"
                >
                  Draw
                </button>
                <button
                  disabled={!myTurn}
                  className="relative h-10 rounded-full px-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--primary-foreground)] shadow-[0_8px_24px_-8px_oklch(0.82_0.14_85/0.6),inset_0_1px_0_oklch(1_0_0/0.35)] ring-1 ring-[color:var(--gold)]/60 transition active:scale-95 disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(180deg, oklch(0.92 0.12 88) 0%, oklch(0.78 0.16 80) 50%, oklch(0.6 0.14 75) 100%)",
                  }}
                >
                  Play turn
                </button>
              </div>
            </div>

            <div className="fan-hand hand-scroll relative flex items-end justify-center overflow-x-auto sm:overflow-visible no-scrollbar px-4 pt-4 pb-1 min-h-[5.75rem] sm:min-h-[6.35rem]">
              {HAND.map((card, i) => {
                const n = HAND.length;
                const mid = (n - 1) / 2;
                const offset = i - mid;
                const spread = Math.min(7, 26 / Math.max(n, 1));
                const rot = offset * spread;
                const arc = offset * offset * 1.6;
                const isSelected = selected === i;
                return (
                  <div
                    key={i}
                    className="fan-card-wrap group relative shrink-0 transition-transform duration-300 ease-out will-change-transform"
                    style={{
                      transform: isSelected
                        ? `translateY(-22px) rotate(${rot * 0.3}deg) scale(1.06)`
                        : `translateY(${arc}px) rotate(${rot}deg)`,
                      transformOrigin: "bottom center",
                      zIndex: isSelected ? 50 : 10 + i,
                      marginLeft: i === 0 ? 0 : "-1.9rem",
                    }}
                  >
                    <div className="transition-transform duration-300 ease-out group-hover:-translate-y-5 group-hover:scale-[1.05] group-focus-within:-translate-y-5 group-active:translate-y-0 group-active:scale-95">
                      <PlayingCard
                        card={card}
                        size="md"
                        state={myTurn ? "idle" : "disabled"}
                        animation={
                          playingIdx === i
                            ? "play"
                            : !dealt
                            ? "deal"
                            : undefined
                        }
                        animationDelay={!dealt ? i * 70 : undefined}
                        onClick={() => handlePlay(i)}
                        className={cn(
                          "shrink-0 shadow-xl shadow-black/50 cursor-pointer",
                          isSelected &&
                            "ring-2 ring-[color:var(--color-gold)] glow-primary",
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <ChatPanel />
      </div>
    </div>
  );
}
