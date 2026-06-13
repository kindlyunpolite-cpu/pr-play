ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS last_action_id text,
  ADD COLUMN IF NOT EXISTS last_action_player_id uuid,
  ADD COLUMN IF NOT EXISTS last_action_signature text;

GRANT INSERT, UPDATE, DELETE ON public.game_states TO service_role;
GRANT UPDATE, DELETE ON public.rooms TO service_role;
GRANT UPDATE, DELETE ON public.players TO service_role;
GRANT ALL ON public.player_secrets TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.room_messages TO service_role;