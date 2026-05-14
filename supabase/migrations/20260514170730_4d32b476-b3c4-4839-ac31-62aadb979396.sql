
-- Add reconnect token + connected flag on players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS connected boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS players_token_key ON public.players(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_room_id_idx ON public.players(room_id);

-- Add message column on room_messages, kept in sync with existing `text` column
ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS message text;

UPDATE public.room_messages SET message = text WHERE message IS NULL;

CREATE OR REPLACE FUNCTION public.sync_room_message_text()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message IS NULL AND NEW.text IS NOT NULL THEN
    NEW.message := NEW.text;
  ELSIF NEW.text IS NULL AND NEW.message IS NOT NULL THEN
    NEW.text := NEW.message;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_room_message_text_trg ON public.room_messages;
CREATE TRIGGER sync_room_message_text_trg
  BEFORE INSERT OR UPDATE ON public.room_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_message_text();

CREATE INDEX IF NOT EXISTS room_messages_room_id_created_at_idx
  ON public.room_messages(room_id, created_at);

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE public.players
    ADD CONSTRAINT players_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.room_messages
    ADD CONSTRAINT room_messages_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.room_messages
    ADD CONSTRAINT room_messages_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS (already enabled but safe)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;

-- Anonymous multiplayer policies: public can read + create, mutations are server-only
DROP POLICY IF EXISTS "Anyone can create a room" ON public.rooms;
CREATE POLICY "Anyone can create a room" ON public.rooms
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can join as a player" ON public.players;
CREATE POLICY "Anyone can join as a player" ON public.players
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can post a chat message" ON public.room_messages;
CREATE POLICY "Anyone can post a chat message" ON public.room_messages
  FOR INSERT WITH CHECK (true);

-- player_secrets stays locked down (no public policies); server uses service role.

-- Realtime: full row payloads + add to publication
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
