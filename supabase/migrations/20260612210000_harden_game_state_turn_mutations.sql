-- Add optimistic concurrency and idempotency metadata for multiplayer turn actions.
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_action_id text,
  ADD COLUMN IF NOT EXISTS last_action_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_action_signature text,
  ADD COLUMN IF NOT EXISTS processed_actions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS game_states_turn_guard_idx
  ON public.game_states(room_id, current_player_id, status, turn_version);

CREATE INDEX IF NOT EXISTS game_states_last_action_idx
  ON public.game_states(last_action_id)
  WHERE last_action_id IS NOT NULL;
