-- Optional reserved player accounts. Guest flow remains unchanged because
-- players.user_id is nullable and all room mutations still accept guest input.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null unique check (char_length(nick) between 1 and 24),
  login_slug text not null unique check (char_length(login_slug) between 1 and 24),
  internal_auth_email text unique,
  recovery_email text,
  avatar_path text,
  avatar_url text,
  auth_provider text not null default 'quick',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists players_user_id_idx on public.players(user_id);
create index if not exists profiles_login_slug_idx on public.profiles(login_slug);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updateable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();
