-- Fixed-clock schedule: challenges drop 5pm ET and close 12h later; Tribal
-- opens at the next 5pm ET and closes 12h after opening.
--   tribal_opens_at  — set when results reveal (the next 5pm ET)
--   tribal_closes_at — set when the tribal-open message posts (opens + 12h)
-- Both clear when the elimination resolves.
-- sit_outs: usernames on the larger tribe sitting out the current challenge
-- so tribes compete with even numbers; their scores are not counted.
alter table public.game_state add column if not exists tribal_opens_at timestamptz;
alter table public.game_state add column if not exists tribal_closes_at timestamptz;
alter table public.game_state add column if not exists sit_outs text[] not null default '{}';
