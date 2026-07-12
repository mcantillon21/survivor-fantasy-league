begin;

-- Full-ruleset columns, layered on the multi-season (game_id) schema.
-- game_state is one row per game; these add the phase/round engine.
alter table public.game_state add column if not exists phase            text not null default 'tribe';
alter table public.game_state add column if not exists current_round    int  not null default 1;
alter table public.game_state add column if not exists merge_at         int  not null default 12;
alter table public.game_state add column if not exists tribe_names      text[] not null default array['red', 'blue'];
alter table public.game_state add column if not exists active_challenge text;
alter table public.game_state add column if not exists finalist_pool    text[];
alter table public.game_state add column if not exists winner_discord_id text;

alter table public.players add column if not exists tribe        text;
alter table public.players add column if not exists has_immunity boolean not null default false;
alter table public.players add column if not exists is_juror     boolean not null default false;
alter table public.players add column if not exists placement    int;

alter table public.votes add column if not exists round     int  not null default 1;
alter table public.votes add column if not exists vote_type text not null default 'elimination';

alter table public.challenges add column if not exists tribe text;
alter table public.challenges add column if not exists round int not null default 1;

commit;
