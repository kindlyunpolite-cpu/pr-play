GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.game_states TO anon, authenticated;
GRANT SELECT ON public.room_messages TO anon, authenticated;
GRANT SELECT ON public.player_stats TO anon, authenticated;
GRANT SELECT ON public.game_results TO anon, authenticated;

GRANT INSERT ON public.rooms TO anon, authenticated;
GRANT INSERT ON public.players TO anon, authenticated;
GRANT INSERT ON public.room_messages TO anon, authenticated;

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.game_states TO service_role;
GRANT ALL ON public.room_messages TO service_role;
GRANT ALL ON public.player_stats TO service_role;
GRANT ALL ON public.game_results TO service_role;