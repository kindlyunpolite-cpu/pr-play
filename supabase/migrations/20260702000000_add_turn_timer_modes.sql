-- Add authoritative room-wide turn timer mode fields.
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_timer_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS turn_timer_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS turn_timer_duration_ms integer NOT NULL DEFAULT 30000 CHECK (turn_timer_duration_ms > 0),
  ADD COLUMN IF NOT EXISTS turn_remaining_ms integer CHECK (turn_remaining_ms IS NULL OR turn_remaining_ms >= 0);

ALTER TABLE public.game_states
  ALTER COLUMN turn_started_at DROP NOT NULL,
  ALTER COLUMN turn_deadline_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.set_game_state_turn_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.turn_timer_enabled, true) = false THEN
      NEW.turn_started_at := NULL;
      NEW.turn_deadline_at := NULL;
      NEW.turn_remaining_ms := NULL;
    ELSE
      IF NEW.turn_started_at IS NULL THEN
        NEW.turn_started_at := now();
      END IF;
      IF COALESCE(NEW.turn_timer_paused, false) = true THEN
        NEW.turn_deadline_at := NULL;
        NEW.turn_remaining_ms := COALESCE(NEW.turn_remaining_ms, NEW.turn_timer_duration_ms, 30000);
      ELSIF NEW.turn_deadline_at IS NULL THEN
        NEW.turn_deadline_at := NEW.turn_started_at + make_interval(secs => COALESCE(NEW.turn_timer_duration_ms, 30000) / 1000.0);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'playing'
     AND NEW.current_player_id IS DISTINCT FROM OLD.current_player_id THEN
    IF COALESCE(NEW.turn_timer_enabled, true) = false THEN
      NEW.turn_started_at := NULL;
      NEW.turn_deadline_at := NULL;
      NEW.turn_remaining_ms := NULL;
    ELSE
      NEW.turn_started_at := COALESCE(NEW.turn_started_at, now());
      IF COALESCE(NEW.turn_timer_paused, false) = true THEN
        NEW.turn_deadline_at := NULL;
        NEW.turn_remaining_ms := COALESCE(NEW.turn_remaining_ms, NEW.turn_timer_duration_ms, 30000);
      ELSE
        NEW.turn_deadline_at := COALESCE(NEW.turn_deadline_at, NEW.turn_started_at + make_interval(secs => COALESCE(NEW.turn_timer_duration_ms, 30000) / 1000.0));
        NEW.turn_remaining_ms := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
