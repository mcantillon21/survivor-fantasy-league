begin;

-- Early prototypes seeded fictional contestants with non-Discord ids. They
-- cannot use slash commands, be selected in Discord user pickers, or submit a
-- registered challenge attempt, so keeping them in a live cast makes a season
-- impossible to finish.
create temporary table legacy_cast_games on commit drop as
select distinct game_id
from public.players
where discord_id !~ '^[0-9]{17,20}$';

delete from public.players
where discord_id !~ '^[0-9]{17,20}$';

-- If removing the demo cast leaves too few real players, reopen registration
-- and clear only that prototype season's round data.
create temporary table reopened_games on commit drop as
select game.id
from public.games game
join legacy_cast_games legacy on legacy.game_id = game.id
where game.status = 'live'
  and (select count(*) from public.players player where player.game_id = game.id) < 6;

delete from public.votes where game_id in (select id from reopened_games);
delete from public.challenges where game_id in (select id from reopened_games);

update public.players
set tribe = null,
    is_eliminated = false,
    has_immunity = false,
    is_juror = false,
    placement = null
where game_id in (select id from reopened_games);

update public.game_state
set phase = 'tribe',
    current_round = 1,
    active_challenge = null,
    finalist_pool = null,
    winner_discord_id = null,
    updated_at = now()
where game_id in (select id from reopened_games);

update public.games
set status = 'setup',
    started_at = null,
    ended_at = null
where id in (select id from reopened_games);

commit;
