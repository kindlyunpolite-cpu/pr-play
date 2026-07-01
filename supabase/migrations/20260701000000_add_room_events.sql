-- Durable room event log for system notices and player actions.
-- Security model: room events intentionally follow the existing public-read
-- room/players/messages model in this prototype. Events must therefore contain
-- only table-visible gameplay facts and immutable actor snapshots, never secrets
-- such as session tokens or hidden hand/deck information.
CREATE TABLE IF NOT EXISTS public.room_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (char_length(type) BETWEEN 1 AND 64),
  player_id uuid,
  actor_nickname text,
  actor_seat smallint,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS room_events_room_timestamp_idx
  ON public.room_events(room_id, timestamp);

ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room events are publicly readable" ON public.room_events;
CREATE POLICY "Room events are publicly readable"
  ON public.room_events FOR SELECT USING (true);

GRANT SELECT ON public.room_events TO anon, authenticated;
GRANT ALL ON public.room_events TO service_role;

ALTER TABLE public.room_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'room_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_events;
  END IF;
END $$;
