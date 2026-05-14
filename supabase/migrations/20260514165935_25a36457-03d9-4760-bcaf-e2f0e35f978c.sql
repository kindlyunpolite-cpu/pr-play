
-- Enums
create type public.room_status as enum ('waiting', 'playing', 'finished');

-- Rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status public.room_status not null default 'waiting',
  host_player_id uuid,
  max_players smallint not null default 4 check (max_players between 2 and 4),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index rooms_code_idx on public.rooms (code);

-- Players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  avatar text,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  seat smallint not null check (seat between 0 and 3),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, seat)
);
create index players_room_idx on public.players (room_id);

-- Private session tokens (never exposed to client)
create table public.player_secrets (
  player_id uuid primary key references public.players(id) on delete cascade,
  session_token text not null unique
);

-- Room messages
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  nickname text not null,
  avatar text,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index room_messages_room_created_idx on public.room_messages (room_id, created_at);

-- Enable RLS on everything
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_secrets enable row level security;
alter table public.room_messages enable row level security;

-- Public read for rooms, players, messages (needed for lookup + realtime).
-- Writes are blocked — only server functions (service role) can mutate.
create policy "Rooms are publicly readable"
  on public.rooms for select using (true);

create policy "Players are publicly readable"
  on public.players for select using (true);

create policy "Room messages are publicly readable"
  on public.room_messages for select using (true);

-- player_secrets: NO policies = anon cannot read. Only service role can access.

-- Realtime publication
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.room_messages;

alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.room_messages replica identity full;
