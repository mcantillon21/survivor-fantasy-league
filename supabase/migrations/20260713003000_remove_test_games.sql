-- Remove disposable integration-test seasons. Real seasons always use a
-- Discord guild id; the prefix and null guild guard keep this narrowly scoped.
delete from public.games
where discord_guild_id is null
  and (code like 'qa-rpc-%' or code like 'qa-flow-%');
