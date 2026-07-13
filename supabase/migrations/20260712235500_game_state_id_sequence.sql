create sequence if not exists public.game_state_id_seq;

select setval(
  'public.game_state_id_seq',
  coalesce(max(id), 1),
  max(id) is not null
)
from public.game_state;

alter sequence public.game_state_id_seq owned by public.game_state.id;

alter table public.game_state
  alter column id set default nextval('public.game_state_id_seq');
