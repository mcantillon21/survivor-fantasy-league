alter table public.votes
  add column if not exists tribal_council_id text;

update public.votes
set tribal_council_id = 'tribal-merged'
where tribal_council_id is null;

alter table public.votes
  alter column tribal_council_id set not null;

alter table public.votes
  drop constraint if exists votes_tribal_council_id_check,
  add constraint votes_tribal_council_id_check
    check (tribal_council_id in ('tribal-red', 'tribal-blue', 'tribal-merged'));

create unique index if not exists votes_one_per_player_per_council
  on public.votes (game_id, voter_id, tribal_council_id);

create index if not exists votes_game_council_idx
  on public.votes (game_id, tribal_council_id);
