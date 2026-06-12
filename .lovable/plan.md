# Premium Card-Room UI Unification

Goal: every screen in the Prší app feels like the same adult, dark, felt-and-gold card room. Czech copy throughout. No emoji, no cartoon. Mobile-first. Backend untouched.

## Scope

UI/presentation only. No changes to `rooms.functions.ts`, realtime hooks, session storage, or any server logic.

## 1. Shared design language

Add a small set of shared primitives in `src/components/ui-room/` so every screen uses the same vocabulary:

- `RoomShell` — dark felt background (radial green-black gradient + subtle noise), gold rim accents, max-width wrapper, consistent paddings for mobile.
- `RoomPanel` — the card-back surface used today on seat info panels (linear gradient + border + backdrop blur). Reused for lobby form card, waiting room player cards, dialogs.
- `RoomButton` — single button component with variants `primary` (gold gradient), `secondary` (felt outline), `ghost`. Replaces ad-hoc buttons for Lízni, Zahraj, Připraven, Spustit hru, Kopírovat odkaz.
- `SectionTitle` — small uppercase gold-tracked label used as section header.

Tokens already live in `src/styles.css` (`--gold`, `--card-back`, felt colors). Add any missing ones (e.g. `--felt-rim`, `--panel-bg`) there; never hardcode hex.

## 2. Portrait-based avatar system

- Curate ~10 semi-realistic portraits (reuse the same art set used for in-game opponents; pick from `src/assets/` portraits if present, otherwise generate a consistent set with `imagegen` at premium quality, transparent PNG, matching style).
- Export from `src/lib/portraits.ts` as `{ id, name, src }[]`.
- New `<PortraitPicker />` component: horizontal scroller / 2-row grid of portrait thumbs in `RoomPanel` style with gold ring on selection. Replaces emoji grid in `routes/index.tsx`.
- Store selected portrait `id` in room session in place of the emoji `avatar` string. Server already accepts arbitrary string — no backend change.
- `<SeatPortrait />` extracted from `Opponent.tsx` so lobby preview, waiting room cards, and in-game seats all render the same portrait visuals (rim glow, floor shadow, drop shadow) at different sizes.

## 3. Lobby (`src/routes/index.tsx`) redesign

- Wrap in `RoomShell`. Replace gradient/blur card with `RoomPanel`.
- Czech copy: "Hraj Prší s přáteli", "Rychlé partie, žádná registrace", tabs "Založit hru" / "Připojit se", fields "Tvoje přezdívka", "Vyber postavu", "Kód místnosti", buttons "Vytvořit novou hru" / "Připojit se do hry", random-name aria "Náhodné jméno", footer "Až 4 hráči · náhled stolu".
- Replace `AVATARS` emoji grid with `<PortraitPicker />`.
- Identity preview row uses `<SeatPortrait size="sm" />` instead of the emoji tile.
- Keep current submit/validation logic.

## 4. Waiting room (`src/routes/waiting.tsx`)

- Wrap in `RoomShell`.
- Each connected player rendered with the same `<SeatPortrait>` + info panel used in-game (name, online dot, "Připraven" badge replacing whatever's there). Empty seats show a dimmed silhouette panel "Volné místo".
- Header line "Místnost <kód>" with `RoomButton variant="ghost"` "Kopírovat odkaz" (Czech toast "Odkaz zkopírován").
- Host action: `RoomButton variant="primary"` "Spustit hru". Non-host: "Připraven" toggle button.
- Mobile: 2-col grid of seats, action buttons in a sticky bottom bar inside the shell.

## 5. Game table (`src/routes/game.tsx`)

- Top nav becomes a slimmer translucent strip (`h-12`) so it never overlaps top seat.
- Recompute table sizing as `min(100dvh - topNav - bottomHand - safe, available-width * ratio)` so portraits at top/left/right/bottom always fit. Concretely:
  - Wrap the table in a flex column: `<header/>`, `<main class="flex-1 min-h-0 grid place-items-center">`, `<footer hand/>`.
  - Table itself uses `aspect-[16/11]`, `max-h-full`, `max-w-full`, with `padding` reserved on each side equal to portrait half-height so opponent seats sit on the rail without being clipped.
  - Seats positioned with `top/left/right/bottom: 0` + `translate` relative to that padded box — single source of truth instead of the current sm/md guesswork.
- Chat: desktop ≥`lg` becomes a narrow collapsible side rail (`w-72`, toggle button, default collapsed on `md`); mobile becomes a `Drawer` (shadcn `drawer.tsx`) with a floating chat FAB above the hand. Unread count badge on the FAB.
- Action buttons (Lízni, Zahraj kolo, Pas) all use `RoomButton primary/secondary`, same height, same gold treatment, grouped in a single bar above the hand.

## 6. Czech localization sweep

Single pass over every visible string in:
- `routes/index.tsx`, `routes/waiting.tsx`, `routes/game.tsx`
- `components/TopNav.tsx`, `components/ChatPanel.tsx`, `components/Opponent.tsx` (any aria-labels, tooltips)
- Toasts in `rooms.functions.ts` consumers (messages only on client side; server error strings localized at the catch site, not server)

No i18n framework — direct Czech strings, since the app is Czech-only.

## 7. Out of scope

- Game rules, deck logic, turn engine.
- Database schema, RLS, server functions.
- Auth flows.

## Technical notes

- New files: `src/components/ui-room/{RoomShell,RoomPanel,RoomButton,SectionTitle,SeatPortrait,PortraitPicker}.tsx`, `src/lib/portraits.ts`.
- Edited files: `src/routes/index.tsx`, `src/routes/waiting.tsx`, `src/routes/game.tsx`, `src/components/Opponent.tsx` (extract portrait), `src/components/TopNav.tsx`, `src/components/ChatPanel.tsx`.
- Asset generation: only if existing portraits aren't already in `src/assets/`. Will check first; reuse beats regenerate.
- All colors via tokens in `src/styles.css`; add `--panel-bg`, `--felt-rim` if missing.

## Verification

- Visual QA at 360×640 (mobile), 768 (tablet), 1280 (desktop) on `/`, `/waiting`, `/game`.
- Check that no opponent portrait is clipped by nav/hand/chat at any of those widths.
- Lighthouse-style scan: no English strings remain in the three routes.

Approve and I'll implement.