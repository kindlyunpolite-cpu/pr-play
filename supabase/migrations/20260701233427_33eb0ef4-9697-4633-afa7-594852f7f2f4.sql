
-- 1. Add turn timer columns to game_states
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS turn_deadline_at timestamptz NOT NULL DEFAULT (now() + interval '30 seconds');

-- 2. Create room_events table
CREATE TABLE IF NOT EXISTS public.room_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  player_id uuid,
  actor_nickname text,
  actor_seat smallint,
  message text NOT NULL
);

CREATE INDEX IF NOT EXISTS room_events_room_id_timestamp_idx
  ON public.room_events (room_id, timestamp DESC);

GRANT SELECT ON public.room_events TO anon, authenticated;
GRANT ALL ON public.room_events TO service_role;

ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room events are publicly readable" ON public.room_events;
CREATE POLICY "Room events are publicly readable"
  ON public.room_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Enable realtime
ALTER TABLE public.room_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_events;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
