-- Minimal persisted multiplayer game state for active Prší rooms.
CREATE TABLE IF NOT EXISTS public.game_states (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  discard_pile jsonb NOT NULL DEFAULT '[]'::jsonb,
  hands jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  active_suit text CHECK (active_suit IN ('hearts', 'diamonds', 'clubs', 'spades')),
  direction smallint NOT NULL DEFAULT 1 CHECK (direction IN (-1, 1)),
  status text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_states_current_player_idx
  ON public.game_states(current_player_id);

ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game states are publicly readable" ON public.game_states;
CREATE POLICY "Game states are publicly readable"
  ON public.game_states FOR SELECT USING (true);

ALTER TABLE public.game_states REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
