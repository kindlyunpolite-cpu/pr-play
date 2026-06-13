ALTER TABLE public.game_states 
  ADD COLUMN IF NOT EXISTS processed_actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_draw integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turn_version integer NOT NULL DEFAULT 0;