-- Add authoritative server-side turn timing to game state.
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS turn_deadline_at timestamptz NOT NULL DEFAULT (now() + interval '30 seconds');

CREATE OR REPLACE FUNCTION public.set_game_state_turn_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.turn_started_at IS NULL THEN
      NEW.turn_started_at := now();
    END IF;
    IF NEW.turn_deadline_at IS NULL THEN
      NEW.turn_deadline_at := NEW.turn_started_at + interval '30 seconds';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'playing'
     AND NEW.current_player_id IS DISTINCT FROM OLD.current_player_id THEN
    NEW.turn_started_at := now();
    NEW.turn_deadline_at := NEW.turn_started_at + interval '30 seconds';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_game_state_turn_deadline ON public.game_states;
CREATE TRIGGER set_game_state_turn_deadline
  BEFORE INSERT OR UPDATE OF current_player_id, status ON public.game_states
  FOR EACH ROW
  EXECUTE FUNCTION public.set_game_state_turn_deadline();
