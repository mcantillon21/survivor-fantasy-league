begin;

-- The complete ruleset identifies councils by round and vote type. Remove the
-- short-lived council label introduced before round-aware voting landed.
drop index if exists public.votes_one_per_player_per_council;
drop index if exists public.votes_game_council_idx;
alter table public.votes drop constraint if exists votes_tribal_council_id_check;
alter table public.votes drop column if exists tribal_council_id;

-- A player gets one ballot of each type per round. /vote replaces that ballot,
-- which also makes a tied Tribal Council safe to revote.
delete from public.votes a
using public.votes b
where a.ctid < b.ctid
  and a.game_id = b.game_id
  and a.voter_id = b.voter_id
  and a.round = b.round
  and a.vote_type = b.vote_type;

create unique index if not exists votes_one_per_player_per_round
  on public.votes (game_id, voter_id, round, vote_type);

-- The same challenge may appear again later in a season, but never twice for
-- the same player in one round.
drop index if exists public.challenges_one_attempt_per_player;

delete from public.challenges a
using public.challenges b
where a.ctid < b.ctid
  and a.game_id = b.game_id
  and lower(a.player_id) = lower(b.player_id)
  and a.round = b.round;

create unique index if not exists challenges_one_attempt_per_round
  on public.challenges (game_id, round, lower(player_id));

create or replace function public.submit_challenge_attempt(
  p_game_id uuid,
  p_challenge_type text,
  p_username text,
  p_score integer
)
returns table (
  attempt_id uuid,
  canonical_username text,
  submitted_score integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_game public.games%rowtype;
  selected_state public.game_state%rowtype;
  selected_player public.players%rowtype;
  inserted_attempt_id uuid;
begin
  select * into selected_game
  from public.games
  where id = p_game_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_FOUND';
  end if;

  if selected_game.status <> 'live' then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_LIVE';
  end if;

  select * into selected_state
  from public.game_state
  where game_id = p_game_id;

  if not found or selected_state.phase not in ('tribe', 'individual') then
    raise exception using errcode = 'P0001', message = 'ROUND_NOT_ACTIVE';
  end if;

  if selected_state.active_challenge is null
     or selected_state.active_challenge <> p_challenge_type then
    raise exception using errcode = 'P0001', message = 'CHALLENGE_NOT_OFFICIAL';
  end if;

  if p_score < 0 or p_score > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;

  select * into selected_player
  from public.players
  where game_id = p_game_id
    and lower(username) = lower(trim(p_username))
    and is_eliminated = false
  order by created_at asc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'REGISTERED_PLAYER_NOT_FOUND';
  end if;

  begin
    insert into public.challenges (
      game_id,
      challenge_type,
      player_id,
      tribe,
      round,
      score
    ) values (
      p_game_id,
      p_challenge_type,
      selected_player.username,
      selected_player.tribe,
      selected_state.current_round,
      p_score
    )
    returning id into inserted_attempt_id;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'ATTEMPT_ALREADY_SUBMITTED';
  end;

  return query
  select inserted_attempt_id, selected_player.username, p_score;
end;
$$;

revoke insert on table public.challenges from anon, authenticated;
revoke all on function public.submit_challenge_attempt(uuid, text, text, integer) from public;
grant execute on function public.submit_challenge_attempt(uuid, text, text, integer)
  to anon, authenticated, service_role;

commit;
