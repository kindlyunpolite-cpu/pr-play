-- Authoritative room event log for system events and visible player actions.
CREATE TABLE IF NOT EXISTS public.room_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('system', 'player_action')),
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS room_events_room_timestamp_idx
  ON public.room_events(room_id, "timestamp");

ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room events are publicly readable" ON public.room_events;
CREATE POLICY "Room events are publicly readable"
  ON public.room_events FOR SELECT USING (true);

GRANT SELECT ON public.room_events TO anon, authenticated;
GRANT ALL ON public.room_events TO service_role;

ALTER TABLE public.room_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
