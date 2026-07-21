begin;

-- Merged-tribe naming after the merge: players suggest names, a poll decides,
-- and the winning name renames the merged camp channel.

-- game_state additions:
--  * tribe_channels: {"red": "<channel id>", "blue": "...", "camp": "..."} captured
--    at /start so the bot can still find these channels after they are renamed.
--  * merged_tribe_name: the poll-chosen name for the merged tribe (null until set).
--  * merge_poll_message_id: the Discord message id of the active naming poll.
alter table public.game_state add column if not exists tribe_channels        jsonb;
alter table public.game_state add column if not exists merged_tribe_name     text;
alter table public.game_state add column if not exists merge_poll_message_id text;

-- One suggested merged-tribe name per player (upserted, so a player can change it
-- until the poll opens). RLS is left disabled to match votes/game_state, which the
-- bot writes with the anon key.
create table if not exists public.merge_suggestions (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  discord_id text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (game_id, discord_id)
);
create index if not exists merge_suggestions_game_id_idx on public.merge_suggestions (game_id);

commit;
