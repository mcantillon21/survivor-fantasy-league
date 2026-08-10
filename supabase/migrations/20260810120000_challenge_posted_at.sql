-- When the current round's challenge was posted. Set on every challenge drop;
-- cleared when results are revealed (so the auto-reveal fires exactly once).
-- Powers the alternate-day rhythm: results auto-reveal when every living
-- player has submitted, or 24h after the drop, whichever comes first.
alter table public.game_state add column if not exists challenge_posted_at timestamptz;
