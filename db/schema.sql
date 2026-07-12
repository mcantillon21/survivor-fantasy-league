-- Survivor Fantasy League — database schema / migration
-- Safe to run repeatedly (idempotent). Run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- game_state: single-row table tracking the whole game's phase and round
-- ---------------------------------------------------------------------------
create table if not exists game_state (
  id             int primary key default 1,
  phase          text not null default 'lobby',   -- lobby | tribe | individual | final | ended
  current_round  int  not null default 1,
  merge_at       int  not null default 12,         -- merge when this many players remain
  roster_size    int  not null default 18,
  tribe_names    text[] not null default array['red', 'blue'],
  active_challenge text,                             -- slug of the challenge selected for this round
  finalist_pool  text[],                            -- discord_ids eligible to win (jury phase)
  winner_discord_id text,
  updated_at     timestamptz default now(),
  constraint game_state_single_row check (id = 1)
);

insert into game_state (id) values (1) on conflict (id) do nothing;

-- Add newer game_state columns to a pre-existing row/table
alter table game_state add column if not exists active_challenge text;
alter table game_state add column if not exists finalist_pool    text[];

-- Align tribe names with the Discord channels (tribe-red / tribe-blue) if the
-- row still holds an earlier default. Won't clobber a custom choice.
update game_state set tribe_names = array['red', 'blue']
  where tribe_names = array['Tagi', 'Pagong'] or tribe_names = array['Red', 'Blue'];

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  discord_id    text unique not null,
  username      text not null,
  tribe         text,
  is_eliminated boolean default false,
  has_immunity  boolean default false,
  is_juror      boolean default false,
  placement     int,                               -- final placement (18 = first out, 1 = winner)
  created_at    timestamptz default now()
);

-- Add columns to a pre-existing players table
alter table players add column if not exists is_juror  boolean default false;
alter table players add column if not exists placement int;

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
create table if not exists votes (
  id         uuid primary key default gen_random_uuid(),
  voter_id   text not null,
  target_id  text not null,
  round      int  not null default 1,
  vote_type  text not null default 'elimination',  -- elimination | jury
  created_at timestamptz default now()
);

-- Migrate a pre-existing votes table (was: tribal_council_id int)
alter table votes add column if not exists round     int  not null default 1;
alter table votes add column if not exists vote_type text not null default 'elimination';
-- If the old tribal_council_id column exists, backfill round from it, then drop it
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'votes' and column_name = 'tribal_council_id'
  ) then
    update votes set round = tribal_council_id where round = 1;
    alter table votes drop column tribal_council_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- challenges
-- ---------------------------------------------------------------------------
create table if not exists challenges (
  id             uuid primary key default gen_random_uuid(),
  challenge_type text not null,
  player_id      text not null,   -- discord id/username submitted from the web
  tribe          text,
  round          int not null default 1,
  score          int not null,
  completed_at   timestamptz default now()
);

alter table challenges add column if not exists tribe text;
alter table challenges add column if not exists round int not null default 1;
