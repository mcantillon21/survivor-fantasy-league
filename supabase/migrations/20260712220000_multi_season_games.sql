begin;

create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  name text not null check (char_length(name) between 1 and 80),
  discord_guild_id text,
  status text not null default 'setup' check (status in ('setup', 'live', 'ended')),
  official_challenge_slug text not null default 'fire-signal-cipher',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create unique index if not exists games_one_current_per_guild
  on public.games (discord_guild_id)
  where discord_guild_id is not null and status in ('setup', 'live');

insert into public.games (code, name, status, official_challenge_slug, started_at)
values ('main', 'Season One', 'live', 'fire-signal-cipher', now())
on conflict (code) do nothing;

alter table public.players add column if not exists game_id uuid;
alter table public.players add column if not exists avatar_url text;
alter table public.votes add column if not exists game_id uuid;
alter table public.challenges add column if not exists game_id uuid;
alter table public.game_state add column if not exists game_id uuid;

update public.players
set game_id = (select id from public.games where code = 'main')
where game_id is null;

update public.votes
set game_id = (select id from public.games where code = 'main')
where game_id is null;

update public.challenges
set game_id = (select id from public.games where code = 'main')
where game_id is null;

update public.game_state
set game_id = (select id from public.games where code = 'main')
where game_id is null;

alter table public.players alter column game_id set not null;
alter table public.votes alter column game_id set not null;
alter table public.challenges alter column game_id set not null;
alter table public.game_state alter column game_id set not null;

alter table public.players
  drop constraint if exists players_game_id_fkey,
  add constraint players_game_id_fkey foreign key (game_id) references public.games(id) on delete cascade;

alter table public.votes
  drop constraint if exists votes_game_id_fkey,
  add constraint votes_game_id_fkey foreign key (game_id) references public.games(id) on delete cascade;

alter table public.challenges
  drop constraint if exists challenges_game_id_fkey,
  add constraint challenges_game_id_fkey foreign key (game_id) references public.games(id) on delete cascade;

alter table public.game_state
  drop constraint if exists game_state_game_id_fkey,
  add constraint game_state_game_id_fkey foreign key (game_id) references public.games(id) on delete cascade;

alter table public.players drop constraint if exists players_discord_id_key;
alter table public.players drop constraint if exists players_game_discord_unique;
alter table public.players add constraint players_game_discord_unique unique (game_id, discord_id);

alter table public.game_state drop constraint if exists game_state_game_id_key;
alter table public.game_state add constraint game_state_game_id_key unique (game_id);

create index if not exists players_game_id_idx on public.players (game_id);
create index if not exists votes_game_id_idx on public.votes (game_id);
create index if not exists challenges_game_id_completed_idx on public.challenges (game_id, completed_at desc);

alter table public.games enable row level security;

drop policy if exists "games are publicly readable" on public.games;
create policy "games are publicly readable"
  on public.games for select
  using (true);

drop policy if exists "games can be created by the game service" on public.games;
create policy "games can be created by the game service"
  on public.games for insert
  with check (true);

drop policy if exists "games can be updated by the game service" on public.games;
create policy "games can be updated by the game service"
  on public.games for update
  using (true)
  with check (true);

commit;
