ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_timer_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS turn_timer_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS turn_timer_duration_ms integer NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS turn_remaining_ms integer;