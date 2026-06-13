-- Track post-game rematch votes per player.
alter table public.game_states
  add column if not exists rematch_votes jsonb not null default '{}'::jsonb;
