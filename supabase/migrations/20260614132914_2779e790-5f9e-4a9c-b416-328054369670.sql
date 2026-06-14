
-- 1) Lock down game_states reads and remove from realtime so deck/hands cannot be exfiltrated
DROP POLICY IF EXISTS "Game states are publicly readable" ON public.game_states;
CREATE POLICY "Deny direct game state reads"
  ON public.game_states FOR SELECT
  USING (false);
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.game_states FROM anon, authenticated;
GRANT ALL ON public.game_states TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_states'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.game_states';
  END IF;
END $$;

-- 2) Remove overly permissive INSERT policies; all writes happen server-side via service_role
DROP POLICY IF EXISTS "Anyone can create a room" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can join as a player" ON public.players;
DROP POLICY IF EXISTS "Anyone can post a chat message" ON public.room_messages;

REVOKE INSERT, UPDATE, DELETE ON public.rooms FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.room_messages FROM anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.room_messages TO service_role;

-- 3) player_secrets: explicit deny-all policy + revoke client grants
CREATE POLICY "Deny all client access to player secrets"
  ON public.player_secrets FOR ALL
  USING (false) WITH CHECK (false);
REVOKE ALL ON public.player_secrets FROM anon, authenticated;
GRANT ALL ON public.player_secrets TO service_role;

-- 4) Restrict SECURITY DEFINER function to service_role only
REVOKE EXECUTE ON FUNCTION public.increment_player_stats(uuid, uuid, integer, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_player_stats(uuid, uuid, integer, integer, integer, integer, integer)
  TO service_role;
