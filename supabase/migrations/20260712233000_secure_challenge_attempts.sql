create unique index if not exists challenges_one_attempt_per_player
  on public.challenges (game_id, challenge_type, lower(player_id));

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
  selected_player public.players%rowtype;
  inserted_attempt_id uuid;
begin
  select *
  into selected_game
  from public.games
  where id = p_game_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_FOUND';
  end if;

  if selected_game.status <> 'live' then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_LIVE';
  end if;

  if selected_game.official_challenge_slug <> p_challenge_type then
    raise exception using errcode = 'P0001', message = 'CHALLENGE_NOT_OFFICIAL';
  end if;

  if p_score < 0 or p_score > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;

  select *
  into selected_player
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
      score,
      round
    )
    values (
      p_game_id,
      p_challenge_type,
      selected_player.username,
      p_score,
      coalesce((
        select current_round
        from public.game_state
        where game_id = p_game_id
      ), 1)
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
grant execute on function public.submit_challenge_attempt(uuid, text, text, integer) to anon, authenticated, service_role;
