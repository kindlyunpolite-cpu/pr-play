ALTER TABLE public.game_states ALTER COLUMN turn_deadline_at DROP NOT NULL;
ALTER TABLE public.game_states ALTER COLUMN turn_started_at DROP NOT NULL;