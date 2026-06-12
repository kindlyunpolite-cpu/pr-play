
CREATE TABLE public.game_states (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  discard_pile jsonb NOT NULL DEFAULT '[]'::jsonb,
  hands jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_player_id uuid,
  active_suit text,
  direction smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'playing',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_states TO anon, authenticated;
GRANT ALL ON public.game_states TO service_role;

ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game states are publicly readable"
  ON public.game_states FOR SELECT
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;
ALTER TABLE public.game_states REPLICA IDENTITY FULL;
