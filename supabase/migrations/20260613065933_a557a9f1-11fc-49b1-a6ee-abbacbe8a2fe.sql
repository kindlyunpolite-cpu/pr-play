CREATE TABLE IF NOT EXISTS public.player_stats (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  games_played int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  cards_drawn int NOT NULL DEFAULT 0,
  cards_played int NOT NULL DEFAULT 0,
  turns_taken int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_stats_room_idx ON public.player_stats(room_id);

CREATE TABLE IF NOT EXISTS public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  winner_player_id uuid REFERENCES public.players(id),
  finished_at timestamptz NOT NULL DEFAULT now(),
  player_count int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_results_room_finished_idx ON public.game_results(room_id, finished_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS game_results_room_finished_unique_idx ON public.game_results(room_id, finished_at);
CREATE INDEX IF NOT EXISTS game_results_winner_idx ON public.game_results(winner_player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats TO authenticated;
GRANT ALL ON public.player_stats TO service_role;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Player stats are publicly readable" ON public.player_stats FOR SELECT USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game results are publicly readable" ON public.game_results FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.increment_player_stats(
  p_player_id uuid,
  p_room_id uuid,
  p_games_played int DEFAULT 0,
  p_wins int DEFAULT 0,
  p_cards_drawn int DEFAULT 0,
  p_cards_played int DEFAULT 0,
  p_turns_taken int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_stats (
    player_id, room_id, games_played, wins, cards_drawn, cards_played, turns_taken, updated_at
  ) VALUES (
    p_player_id, p_room_id, p_games_played, p_wins, p_cards_drawn, p_cards_played, p_turns_taken, now()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    room_id = EXCLUDED.room_id,
    games_played = public.player_stats.games_played + EXCLUDED.games_played,
    wins = public.player_stats.wins + EXCLUDED.wins,
    cards_drawn = public.player_stats.cards_drawn + EXCLUDED.cards_drawn,
    cards_played = public.player_stats.cards_played + EXCLUDED.cards_played,
    turns_taken = public.player_stats.turns_taken + EXCLUDED.turns_taken,
    updated_at = now();
END;
$$;