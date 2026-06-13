-- Track stacked Prší seven-card draw penalties on each active game.
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS pending_draw integer NOT NULL DEFAULT 0 CHECK (pending_draw >= 0);
