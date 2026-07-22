import { getCurrentGame, normalizeGameCode, requireGame, supabase, userCanManageGame } from './games.js';
import {
  getGameState, updateGameState, mergeGameState, getPlayers, alivePlayers, startGame,
  resolveImmunity, narrateChallengeResults, tallyElimination, eliminatePlayer,
  narrateTribalCouncil, tallyJury, crownWinner, narrateWinner,
} from './referee.js';
import { CHALLENGE_CHOICES, getChallengeName } from './challenges.js';
import { GIFS } from './gifs.js';
import { tribeLabel } from './tribe-names.js';

const CHALLENGE_BASE = 'https://survivor-fantasy-league-pi.vercel.app/game';

// One challenge is drawn per round; mirror of web/lib/challenges/catalog.ts.
const CHALLENGE_SLUGS = CHALLENGE_CHOICES.map((challenge) => challenge.value);

// Live Discord server names.
const CH = { announcements: 'announcements', camp: 'camp', lobby: 'challenge-lobby', tribal: 'tribal-council', red: 'tribe-red', blue: 'tribe-blue', spectators: 'spectators', ponderosa: 'ponderosa' };
const ROLE = { player: 'Player', jury: 'Jury', spectator: 'Spectator', boot: 'Pre-merge boot' };

const findChannel = (guild, name) => guild?.channels?.cache.find((c) => c.name === name);
const findRole = (guild, name) => guild?.roles?.cache.find((r) => r.name === name);

// Discord channel names must be lowercase-kebab. Turn a tribe name into a slug.
const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90) || 'tribe';
const tribeChannelName = (name) => `tribe-${slugify(name)}`;

// Resolve a game channel by its stored id (rename-proof), falling back to the
// original fixed name for games that started before ids were captured.
// key is 'red' | 'blue' | 'camp'.
function gameChannel(guild, state, key) {
  const id = state?.tribe_channels?.[key];
  if (id) { const byId = guild?.channels?.cache.get(id); if (byId) return byId; }
  const name = key === 'red' ? CH.red : key === 'blue' ? CH.blue : key === 'camp' ? CH.camp : null;
  return name ? findChannel(guild, name) : null;
}

async function post(guild, name, content) {
  const ch = findChannel(guild, name);
  if (!ch) return;
  try { await ch.send(content); } catch (e) { console.error(`post #${name}:`, e.message); }
}
// Post a Jeff Probst reaction GIF (its own message so Discord embeds the Tenor
// link). No-ops if that beat's GIF is unset. See gifs.js.
async function postGif(guild, name, key) {
  if (GIFS[key]) await post(guild, name, GIFS[key]);
}
async function addRole(guild, discordId, roleName) {
  const role = findRole(guild, roleName);
  if (!role) return;
  try { const m = await guild.members.fetch(discordId); await m.roles.add(role); } catch (e) { console.error(`addRole ${roleName}:`, e.message); }
}
async function removeRole(guild, discordId, roleName) {
  const role = findRole(guild, roleName);
  if (!role) return;
  try { const m = await guild.members.fetch(discordId); if (m.roles.cache.has(role.id)) await m.roles.remove(role); } catch (e) { console.error(`removeRole ${roleName}:`, e.message); }
}
async function grantTribeChannel(guild, state, discordId, tribe) {
  // Allow the player's own tribe room, and explicitly deny the other tribe's
  // room so pre-merge players can only ever see their own camp.
  const own = gameChannel(guild, state, tribe);
  if (own) {
    try { await own.permissionOverwrites.edit(discordId, { ViewChannel: true, SendMessages: true }); } catch (e) { console.error('grantTribeChannel:', e.message); }
  }
  const otherKey = tribe === 'red' ? 'blue' : 'red';
  const other = gameChannel(guild, state, otherKey);
  if (other) {
    try { await other.permissionOverwrites.edit(discordId, { ViewChannel: false, SendMessages: false }); } catch (e) { console.error('denyTribeChannel:', e.message); }
  }
}
async function revokeTribeChannels(guild, state, discordId) {
  for (const key of ['red', 'blue']) {
    const ch = gameChannel(guild, state, key);
    if (ch) await ch.permissionOverwrites.delete(discordId).catch(() => {});
  }
}
async function archiveTribeRooms(guild, state, players) {
  if (!guild) return { ok: false, missing: ['tribe-red', 'tribe-blue', 'camp'] };
  const red = gameChannel(guild, state, 'red');
  const blue = gameChannel(guild, state, 'blue');
  const camp = gameChannel(guild, state, 'camp');
  const missing = [['tribe-red', red], ['tribe-blue', blue], ['camp', camp]]
    .filter(([, channel]) => !channel)
    .map(([name]) => name);
  if (missing.length) return { ok: false, missing };

  for (const player of alivePlayers(players)) {
    const tribeChannel = player.tribe === 'red' ? red : player.tribe === 'blue' ? blue : null;
    if (!tribeChannel) continue;
    await tribeChannel.permissionOverwrites
      .edit(player.discord_id, { SendMessages: false })
      .catch((error) => console.error(`archive #${tribeChannel.name}:`, error.message));
  }
  return { ok: true, missing: [] };
}
async function syncDiscordProfiles(guild, players) {
  if (!guild) return players;
  const synced = [];
  for (const player of players) {
    if (!/^\d{17,20}$/.test(player.discord_id)) {
      synced.push(player);
      continue;
    }
    try {
      const member = await guild.members.fetch(player.discord_id);
      const username = member.user.username;
      const avatarUrl = member.displayAvatarURL({ extension: 'png', size: 128 });
      if (player.username !== username || player.avatar_url !== avatarUrl) {
        await supabase.from('players').update({ username, avatar_url: avatarUrl }).eq('id', player.id);
      }
      synced.push({ ...player, username, avatar_url: avatarUrl });
    } catch (error) {
      console.error(`sync Discord profile ${player.discord_id}:`, error.message);
      synced.push(player);
    }
  }
  return synced;
}
// Eliminated: strip Player + tribe access; grant boot/spectator (pre-merge) or jury (post-merge).
async function moveOut(guild, state, discordId, postMerge) {
  if (!guild) return;
  await revokeTribeChannels(guild, state, discordId);
  await removeRole(guild, discordId, ROLE.player);
  if (postMerge) {
    await addRole(guild, discordId, ROLE.jury);
  } else {
    await addRole(guild, discordId, ROLE.boot);
    await addRole(guild, discordId, ROLE.spectator);
  }
}
// The text channels a season uses; purged when a new season is created.
const GAME_TEXT_CHANNELS = [CH.announcements, CH.camp, CH.lobby, CH.tribal, CH.red, CH.blue, CH.spectators, CH.ponderosa];

// On a new season: reset any channels the previous season renamed (the tribe
// rooms, and the merged camp) back to their canonical names, then clear old
// messages so the new game starts on a clean slate. `prevState` is the previous
// game's game_state (for the stored channel ids). bulkDelete can only remove
// messages younger than 14 days — older ones are left behind by Discord.
async function resetAndPurgeChannels(guild, prevState) {
  if (!guild) return;
  // 1) Rename renamed tribe/camp channels back to canonical (by stored id).
  for (const [key, canonical] of [['red', CH.red], ['blue', CH.blue], ['camp', CH.camp]]) {
    const id = prevState?.tribe_channels?.[key];
    const ch = id ? guild.channels.cache.get(id) : null;
    if (ch && ch.name !== canonical) await ch.setName(canonical).catch((e) => console.error(`reset #${canonical}:`, e.message));
  }
  // 2) Gather channels to purge: the canonical set, the prev camp by id, and any
  //    leftover #tribe-* rooms (in case a reset above did not apply).
  const targets = new Map();
  for (const name of GAME_TEXT_CHANNELS) { const c = findChannel(guild, name); if (c) targets.set(c.id, c); }
  const campId = prevState?.tribe_channels?.camp;
  if (campId && guild.channels.cache.has(campId)) targets.set(campId, guild.channels.cache.get(campId));
  for (const c of guild.channels.cache.values()) { if (c?.name?.startsWith('tribe-')) targets.set(c.id, c); }
  // 3) Purge each channel (loop because bulkDelete clears at most 100 at a time).
  for (const ch of targets.values()) {
    if (typeof ch.bulkDelete !== 'function') continue;
    try {
      let removed; let guard = 0;
      do { removed = await ch.bulkDelete(100, true); guard++; } while (removed.size >= 2 && guard < 20);
    } catch (e) { console.error(`purge #${ch.name}:`, e.message); }
  }
}

async function hostOnly(interaction) {
  if (userCanManageGame(interaction)) return true;
  await interaction.reply({ content: 'Only a host (Manage Server) can run that.', ephemeral: true });
  return false;
}

// ---------------------------------------------------------------------------
// /newgame — (host) create a season for this server
// ---------------------------------------------------------------------------
export async function handleNewGame(interaction) {
  if (!(await hostOnly(interaction))) return;
  // Ephemeral so the confirmation is NOT a real channel message — otherwise the
  // channel purge below would delete this very reply and the edit would fail.
  await interaction.deferReply({ ephemeral: true });

  const existing = await getCurrentGame(interaction.guildId);
  if (existing) { await interaction.editReply(`A season already exists (**${existing.name}**, \`${existing.code}\`). End it with \`/endgame\` first.`); return; }

  // Clean slate: reset renamed channels and clear the previous season's messages.
  const previous = await getCurrentGame(interaction.guildId, { includeEnded: true });
  const previousState = previous ? await getGameState(previous.id) : null;
  await resetAndPurgeChannels(interaction.guild, previousState);

  const code = normalizeGameCode(interaction.options.getString('code'));
  const name = interaction.options.getString('name');
  const { data: game, error } = await supabase.from('games')
    .insert({ code, name, discord_guild_id: interaction.guildId, status: 'setup' })
    .select('*').single();
  if (error) { await interaction.editReply(`Could not create the season: ${error.message}`); return; }

  await supabase.from('game_state').insert({
    game_id: game.id, phase: 'tribe', current_round: 1, merge_at: 12, tribe_names: ['red', 'blue'],
  });

  // Re-open #announcements as the pre-game lobby so players can /register.
  const guild = interaction.guild;
  if (guild) {
    const ann = findChannel(guild, CH.announcements);
    if (ann) await ann.permissionOverwrites.edit(guild.id, { SendMessages: true, UseApplicationCommands: true }).catch((e) => console.error('open announcements:', e.message));
  }

  // Durable, public sign-up prompt — posted AFTER the purge so it survives, and
  // as a real message (not the ephemeral reply) so every player can see it.
  await post(guild, CH.announcements,
    `🌱 **A NEW SEASON HAS BEGUN — ${name.toUpperCase()}** (\`${code}\`)\n\nPlayers: use \`/register\` right here to join. When everyone's in, the host runs \`/start\` to form the tribes.`);

  await interaction.editReply(`🌱 Season **${name}** created (\`${code}\`). The sign-up prompt is posted in #${CH.announcements}. Players \`/register\`, then run \`/start\`.`);
}

// ---------------------------------------------------------------------------
// /register — join the game (setup only)
// ---------------------------------------------------------------------------
export async function handleRegister(interaction) {
  const game = await requireGame(interaction);
  if (!game) return;
  if (game.status !== 'setup') { await interaction.reply({ content: 'Registration is closed — the season has already started.', ephemeral: true }); return; }

  const { data: existing } = await supabase.from('players').select('id').eq('game_id', game.id).eq('discord_id', interaction.user.id).maybeSingle();
  if (existing) { await interaction.reply({ content: 'You are already registered.', ephemeral: true }); return; }

  const { error } = await supabase.from('players').insert({
    game_id: game.id, discord_id: interaction.user.id, username: interaction.user.username,
    avatar_url: interaction.member?.displayAvatarURL?.({ extension: 'png', size: 128 })
      || interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
    tribe: null, is_eliminated: false, has_immunity: false, is_juror: false,
  });
  if (error) throw error;
  await interaction.reply({ content: `Welcome, ${interaction.user.username}. Wait for the host to form the tribes with \`/start\`.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /start — (host) form tribes, assign roles/channels, go live
// ---------------------------------------------------------------------------
export async function handleStart(interaction) {
  if (!(await hostOnly(interaction))) return;
  // Ephemeral: the roster is posted publicly to #announcements below — a public
  // reply would duplicate it when /start is run in that same channel.
  await interaction.deferReply({ ephemeral: true });
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No season exists. Create one with `/newgame` first.'); return; }

  // Admin-only test flags (/start is already host-gated):
  //  • test   — start with any even number of players (>=2), tribe phase.
  //  • merged — skip tribes and start already merged (individual phase). Good
  //    for small test games that would otherwise choke on the tribe→merge step.
  const test = interaction.options.getBoolean('test') ?? false;
  const merged = interaction.options.getBoolean('merged') ?? false;
  const result = merged
    ? await startGame(game.id, { minPlayers: 4, merged: true })
    : test
      ? await startGame(game.id, { minPlayers: 2, requireEven: true })
      : await startGame(game.id);
  if (result.error) { await interaction.editReply(result.error); return; }
  await supabase.from('games').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', game.id);

  const guild = interaction.guild;
  if (guild) {
    // Capture channel ids (so we can still find these rooms after renaming) and
    // rename the two tribe rooms to the freshly generated tribe names.
    let state = await getGameState(game.id);
    if (!merged) {
      const red = findChannel(guild, CH.red);
      const blue = findChannel(guild, CH.blue);
      const camp = findChannel(guild, CH.camp);
      await updateGameState(game.id, { tribe_channels: { red: red?.id ?? null, blue: blue?.id ?? null, camp: camp?.id ?? null } });
      state = await getGameState(game.id);
      if (red && result.tribeNames?.[0]) await red.setName(tribeChannelName(result.tribeNames[0])).catch((e) => console.error('rename tribe red:', e.message));
      if (blue && result.tribeNames?.[1]) await blue.setName(tribeChannelName(result.tribeNames[1])).catch((e) => console.error('rename tribe blue:', e.message));
    }
    for (const p of alivePlayers(await getPlayers(game.id))) {
      await addRole(guild, p.discord_id, ROLE.player);
      if (!merged) await grantTribeChannel(guild, state, p.discord_id, p.tribe);
    }
    // Registration is closed — lock #announcements back to a read-only feed.
    const ann = findChannel(guild, CH.announcements);
    if (ann) await ann.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch((e) => console.error('lock announcements:', e.message));
    // Everyone still in the game (Player role) can cast votes in #tribal-council.
    const playerRole = findRole(guild, ROLE.player);
    const tc = findChannel(guild, CH.tribal);
    if (playerRole && tc) await tc.permissionOverwrites.edit(playerRole.id, { ViewChannel: true, SendMessages: true, UseApplicationCommands: true }).catch((e) => console.error('tribal-council perms:', e.message));
  }

  let msg;
  if (merged) {
    msg = `🌴 **THE GAME BEGINS — MERGED TEST** — ${result.count} individuals, no tribes.\n\n`;
    msg += result.rosters.everyone.map((m) => `• ${m}`).join('\n');
    msg += `\n\nIndividual immunity from round one — top scorer is safe, everyone votes. Play down to the final 3, then \`/finaltribal\`.`;
  } else {
    msg = `🌴 **THE GAME BEGINS** — ${result.count} castaways, two tribes.\n\n`;
    for (const [tribe, members] of Object.entries(result.rosters)) {
      const emoji = tribe === 'red' ? '🔴' : tribe === 'blue' ? '🔵' : '•';
      msg += `${emoji} **${tribeLabel(tribe, result.tribeNames)} (${members.length})**\n${members.map((m) => `• ${m}`).join('\n')}\n\n`;
    }
    if (test) msg += `⚠️ **Test mode** — started with a reduced roster of ${result.count}.\n\n`;
    msg += `Each tribe only sees its own channel. The host will post the first immunity challenge — merge at ${result.mergeAt}.`;
  }
  await post(guild, CH.announcements, msg);
  await interaction.editReply(`🌴 Season started — the roster is posted in #${CH.announcements}.`);
}

// ---------------------------------------------------------------------------
// /challenge — (host) select ONE challenge for everyone this round
// ---------------------------------------------------------------------------
export async function handleChallenge(interaction) {
  if (!(await hostOnly(interaction))) return;
  const game = await requireGame(interaction, { live: true });
  if (!game) return;

  const state = await getGameState(game.id);
  if (state.active_challenge) {
    const { count } = await supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('round', state.current_round);
    if (count > 0) {
      await interaction.reply({
        content: `${getChallengeName(state.active_challenge)} is already official for this round and attempts have started. Finish the round before posting another.`,
        ephemeral: true,
      });
      return;
    }
  }

  const selected = interaction.options.getString('game');
  const slug = selected || CHALLENGE_SLUGS[Math.floor(Math.random() * CHALLENGE_SLUGS.length)];
  await updateGameState(game.id, { active_challenge: slug });
  const teamLine = state.phase === 'tribe'
    ? 'Your whole tribe competes — scores combine into one tribe total. Losing tribe goes to Tribal Council.'
    : 'Every player for themselves. Only the top scorer is safe.';

  await post(interaction.guild, CH.lobby,
    `🔥 **${getChallengeName(slug).toUpperCase()}**\n\n${teamLine}\n\nPlay here:\n${CHALLENGE_BASE}/${game.code}/challenge\n\nYou have 10 minutes.`);
  await postGif(interaction.guild, CH.lobby, 'immunity'); // "Immunity is back up for grabs."
  await interaction.reply({ content: `${getChallengeName(slug)} posted to #${CH.lobby}.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /results — (host) tally scores, grant immunity, name the losing tribe
// ---------------------------------------------------------------------------
export async function handleResults(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }

  const summary = await resolveImmunity(game.id);
  if (summary.empty) { await interaction.editReply('No challenge results yet.'); return; }

  const narration = await narrateChallengeResults(summary);
  let msg = `🔥 **CHALLENGE RESULTS**\n\n${narration}\n\n`;
  const state = await getGameState(game.id);

  if (summary.phase === 'tribe') {
    const winning = summary.winningTribe;                       // internal key: 'red' | 'blue'
    const losingKey = winning === 'red' ? 'blue' : 'red';
    const winLabel = tribeLabel(winning, state.tribe_names);
    const loseLabel = tribeLabel(losingKey, state.tribe_names);
    msg += '**Tribe scores:**\n';
    summary.tribeTotals.forEach(([t, n], i) => { msg += `${i === 0 ? '🥇' : '•'} ${tribeLabel(t, state.tribe_names)}: ${n} points${t === winning ? ' 🛡️ IMMUNE' : ' — Tribal Council'}\n`; });
    await post(interaction.guild, CH.lobby, `🏆 **${winLabel}** wins immunity!\n**${loseLabel}** has the fewest points and is going to Tribal Council. Head to #${CH.tribal} and \`/vote\` — own tribe only, votes stay secret.`);
  } else {
    msg += '**Scores:**\n';
    summary.ranked.forEach((r, i) => { msg += `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${r.player_id}: ${r.score} points${i === 0 ? ' 🛡️ IMMUNE' : ''}\n`; });
    await post(interaction.guild, CH.lobby, `🛡️ **${summary.winner}** wins individual immunity! Everyone else — #${CH.tribal} and \`/vote\`. You cannot vote for ${summary.winner}.`);
  }
  await post(interaction.guild, CH.tribal, '⚖️ **Tribal Council is now in session.** Cast your `/vote`.');
  await postGif(interaction.guild, CH.tribal, 'tribalStart'); // "Well, let's get into it."
  await interaction.editReply(msg);
}

// ---------------------------------------------------------------------------
// /vote — secret elimination vote, or jury vote at the finale
// ---------------------------------------------------------------------------
export async function handleVote(interaction) {
  const game = await requireGame(interaction, { live: true });
  if (!game) return;
  const target = interaction.options.getUser('player');
  const state = await getGameState(game.id);

  const { data: voter } = await supabase.from('players').select('*').eq('game_id', game.id).eq('discord_id', interaction.user.id).maybeSingle();
  const { data: targetData } = await supabase.from('players').select('*').eq('game_id', game.id).eq('discord_id', target.id).maybeSingle();

  if (state.phase === 'final') {
    if (!voter || !voter.is_juror) { await interaction.reply({ content: 'Only jury members vote at the finale.', ephemeral: true }); return; }
    const pool = state.finalist_pool || [];
    if (!targetData || !pool.includes(target.id)) { await interaction.reply({ content: 'You can only vote for one of the three finalists.', ephemeral: true }); return; }
    const { error: clearError } = await supabase.from('votes').delete().eq('game_id', game.id).eq('voter_id', interaction.user.id).eq('round', state.current_round).eq('vote_type', 'jury');
    if (clearError) throw clearError;
    const { error: voteError } = await supabase.from('votes').insert({ game_id: game.id, voter_id: interaction.user.id, target_id: target.id, round: state.current_round, vote_type: 'jury' });
    if (voteError) throw voteError;
    await interaction.reply({ content: `🔒 Your jury vote for ${target.username} to WIN is locked in.`, ephemeral: true });
    return;
  }

  if (!voter || voter.is_eliminated) { await interaction.reply({ content: 'You are not in the game or already eliminated.', ephemeral: true }); return; }
  const { count: immuneCount } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', game.id)
    .eq('is_eliminated', false)
    .eq('has_immunity', true);
  if (!immuneCount) { await interaction.reply({ content: 'Voting is not open yet. Wait for the host to post `/results`.', ephemeral: true }); return; }
  if (state.phase === 'tribe' && voter.has_immunity) { await interaction.reply({ content: 'Your tribe won immunity — you are safe and do not vote this round.', ephemeral: true }); return; }
  if (target.id === interaction.user.id) { await interaction.reply({ content: 'You cannot vote for yourself.', ephemeral: true }); return; }
  if (!targetData || targetData.is_eliminated) { await interaction.reply({ content: 'That player is not in the game.', ephemeral: true }); return; }
  if (targetData.has_immunity) { await interaction.reply({ content: `${target.username} has immunity and cannot be voted out.`, ephemeral: true }); return; }
  if (state.phase === 'tribe' && targetData.tribe !== voter.tribe) { await interaction.reply({ content: 'You can only vote for someone on your own tribe.', ephemeral: true }); return; }

  const { error: clearError } = await supabase.from('votes').delete().eq('game_id', game.id).eq('voter_id', interaction.user.id).eq('round', state.current_round).eq('vote_type', 'elimination');
  if (clearError) throw clearError;
  const { error: voteError } = await supabase.from('votes').insert({ game_id: game.id, voter_id: interaction.user.id, target_id: target.id, round: state.current_round, vote_type: 'elimination' });
  if (voteError) throw voteError;
  await interaction.reply({ content: `🔒 Your vote for ${target.username} is locked in.`, ephemeral: true });

  try {
    const players = await getPlayers(game.id);
    const eligible = alivePlayers(players).filter((player) => state.phase !== 'tribe' || !player.has_immunity);
    const { data: cast } = await supabase.from('votes').select('voter_id')
      .eq('game_id', game.id).eq('round', state.current_round).eq('vote_type', 'elimination');
    const voted = new Set((cast || []).map((vote) => vote.voter_id)).size;
    if (eligible.length > 0 && voted >= eligible.length && !resolvingGames.has(game.id)) {
      resolvingGames.add(game.id);
      try {
        await post(interaction.guild, CH.tribal, '🗳️ Everyone has voted. Reading the votes…');
        await resolveEliminationTribal(interaction.guild, game.id);
      } finally {
        resolvingGames.delete(game.id);
      }
    }
  } catch (error) {
    console.error('Auto-tribal failed:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Tribal resolution shared by automatic reveal and the host backup command.
// ---------------------------------------------------------------------------
const resolvingGames = new Set();

async function resolveEliminationTribal(guild, gameId) {
  const state = await getGameState(gameId);
  if (!state || !['tribe', 'individual'].includes(state.phase)) return { ok: false, reason: 'phase' };
  const players = await getPlayers(gameId);
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  if (!alivePlayers(players).some((player) => player.has_immunity)) {
    return { ok: false, reason: 'results' };
  }
  const result = await tallyElimination(gameId, state.current_round);
  if (!result) return { ok: false, reason: 'novotes' };
  const eligibleVoters = alivePlayers(players).filter((player) => state.phase !== 'tribe' || !player.has_immunity);
  const votesCast = result.votes.reduce((total, [, count]) => total + count, 0);
  if (votesCast < eligibleVoters.length) {
    return { ok: false, reason: 'waiting', votesCast, eligible: eligibleVoters.length };
  }

  // A tie goes straight to a rock draw — one of the tied castaways randomly
  // pulls the purple rock and is out. No revote.
  let rockDraw = null;
  if (result.tie) {
    result.eliminated = result.tied[Math.floor(Math.random() * result.tied.length)];
    rockDraw = { drawn: result.eliminated, tied: result.tied };
  }

  const aliveBefore = alivePlayers(players).length;
  const postMerge = state.phase === 'individual';
  const narration = await narrateTribalCouncil(result.votes, playerMap,
    rockDraw ? { rockDraw: true, drawn: rockDraw.drawn, tied: rockDraw.tied } : {});

  await eliminatePlayer(gameId, result.eliminated, { juror: postMerge, placement: aliveBefore });
  await moveOut(guild, state, result.eliminated, postMerge);
  await supabase.from('votes').delete().eq('game_id', gameId).eq('round', state.current_round).eq('vote_type', 'elimination');
  await supabase.from('players').update({ has_immunity: false }).eq('game_id', gameId).eq('is_eliminated', false);

  const aliveAfter = aliveBefore - 1;
  let transition = '';
  if (aliveAfter <= 3) {
    const finalists = alivePlayers(await getPlayers(gameId)).map((p) => p.discord_id);
    await updateGameState(gameId, { phase: 'final', finalist_pool: finalists, current_round: state.current_round + 1, active_challenge: null });
    transition = `\n\n🔥 **FINAL 3: ${finalists.map((id) => playerMap.get(id)).join(', ')}.** Host: run \`/finaltribal\`.`;
  } else if (state.phase === 'tribe' && aliveAfter <= state.merge_at) {
    const archive = await archiveTribeRooms(guild, state, players);
    if (!archive.ok) console.error(`Merge could not archive channels: ${archive.missing.join(', ')}`);
    await mergeGameState(gameId);
    await updateGameState(gameId, { current_round: state.current_round + 1, active_challenge: null });
    transition = `\n\n🏝️ **THE MERGE!** ${aliveAfter} players remain — individual game from here.`;
    await post(guild, CH.announcements, `🏝️ **THE MERGE!** ${aliveAfter} players remain. It is now every player for themselves.`);
    await postGif(guild, CH.announcements, 'merge'); // "Everybody drop your buffs."
    await post(guild, CH.camp, `🏝️ **WELCOME TO THE MERGED CAMP.** ${aliveAfter} players remain. Tribe rooms are now read-only.`);
    await openMergeNaming(guild, gameId); // players suggest a merged-tribe name
  } else {
    await updateGameState(gameId, { current_round: state.current_round + 1, active_challenge: null });
  }

  const name = playerMap.get(result.eliminated) || 'Player';
  const header = rockDraw ? '🔥 **TRIBAL COUNCIL — ROCK DRAW**' : '🔥 **TRIBAL COUNCIL**';
  let msg = `${header}\n\n${narration}\n\n**${rockDraw ? 'Tied vote' : 'Final tally'}:**\n`;
  result.votes.forEach(([id, c]) => {
    const mark = id === result.eliminated ? (rockDraw ? ' 🟣' : ' ❌') : '';
    msg += `• ${playerMap.get(id) || 'Unknown'}: ${c} vote${c > 1 ? 's' : ''}${mark}\n`;
  });
  if (rockDraw) msg += `\n🟣 **${name} drew the purple rock and is out of the game.**`;
  msg += `\n**${name}, the tribe has spoken. 🔦**${postMerge ? ' You are now on the **Jury**.' : ' You are now a **Pre-merge boot**.'}${transition}`;
  await post(guild, CH.tribal, msg);
  await postGif(guild, CH.tribal, 'voteReveal'); // "The tribe has spoken."
  return { ok: true, msg };
}

// ---------------------------------------------------------------------------
// /tribal — host backup; the bot normally resolves when all votes are in.
// ---------------------------------------------------------------------------
export async function handleTribal(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  if (resolvingGames.has(game.id)) { await interaction.editReply('That Tribal Council is already being resolved.'); return; }

  resolvingGames.add(game.id);
  try {
    const result = await resolveEliminationTribal(interaction.guild, game.id);
    if (result.msg) { await interaction.editReply(result.msg); return; }
    if (result.reason === 'results') { await interaction.editReply('Tribal Council is not open yet. Run `/results` first.'); return; }
    if (result.reason === 'waiting') { await interaction.editReply(`Waiting for votes: ${result.votesCast}/${result.eligible} eligible players have voted.`); return; }
    if (result.reason === 'novotes') { await interaction.editReply('No votes have been cast yet.'); return; }
    await interaction.editReply('There is no Tribal Council to hold right now.');
  } finally {
    resolvingGames.delete(game.id);
  }
}

// ---------------------------------------------------------------------------
// /finaltribal — (host) open the final tribal council; the jury votes for a winner
// ---------------------------------------------------------------------------
export async function handleFinalTribal(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase !== 'final') { await interaction.editReply('It is not the final tribal yet — play down to three players first.'); return; }

  const players = await getPlayers(game.id);
  const finalists = alivePlayers(players);
  await updateGameState(game.id, { finalist_pool: finalists.map((p) => p.discord_id) });
  await post(interaction.guild, CH.tribal,
    `⚖️ **FINAL TRIBAL COUNCIL**\n\nThe jury may now speak. Jurors — \`/vote\` for who should WIN.\nFinalists: **${finalists.map((p) => p.username).join(', ')}** (finalists cannot vote).\n\nWhen every juror has voted, the host runs \`/revealvotes\` to read the votes.`);
  await interaction.editReply('Final Tribal opened — jurors can vote now. Run `/revealvotes` to read the votes.');
}

// ---------------------------------------------------------------------------
// /revealvotes — (host) read the jury vote and crown the Sole Survivor
// ---------------------------------------------------------------------------
export async function handleRevealVotes(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase !== 'final') { await interaction.editReply('There is no final vote to reveal — open the final tribal with `/finaltribal` at the final three first.'); return; }

  const players = await getPlayers(game.id);
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  const result = await tallyJury(game.id, state.current_round);

  if (!result) {
    await interaction.editReply('No jury votes have been cast yet. Open the final tribal with `/finaltribal`, then wait for jurors to `/vote`.');
    return;
  }

  const juryCount = players.filter((player) => player.is_juror).length;
  const juryVotesCast = result.votes.reduce((total, [, count]) => total + count, 0);
  if (juryVotesCast < juryCount) {
    await interaction.editReply(`Waiting for jury votes: ${juryVotesCast}/${juryCount} jurors have voted.`);
    return;
  }

  if (result.tie) {
    await updateGameState(game.id, { finalist_pool: result.tied });
    await supabase.from('votes').delete().eq('game_id', game.id).eq('round', state.current_round).eq('vote_type', 'jury');
    const names = result.tied.map((id) => playerMap.get(id) || 'Unknown').join(' vs ');
    await post(interaction.guild, CH.tribal, `⚖️ **THE JURY IS DEADLOCKED.** Revote between **${names}** — jurors, \`/vote\` again.`);
    await interaction.editReply(`Tie — revote between ${names}, then run \`/revealvotes\` again.`);
    return;
  }

  const winnerName = playerMap.get(result.winner) || 'the winner';
  const ordered = result.votes.map(([id]) => id).filter((id) => id !== result.winner);
  if (ordered[0]) await supabase.from('players').update({ placement: 2 }).eq('game_id', game.id).eq('discord_id', ordered[0]);
  if (ordered[1]) await supabase.from('players').update({ placement: 3 }).eq('game_id', game.id).eq('discord_id', ordered[1]);
  await crownWinner(game.id, result.winner);
  await supabase.from('games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', game.id);

  const board = result.votes.map(([id, c]) => `${playerMap.get(id) || 'Unknown'}: ${c} vote${c > 1 ? 's' : ''}`).join('\n');
  const narration = await narrateWinner(winnerName, board);
  let msg = `🏆 **THE FINALE**\n\n${narration}\n\n**Final jury vote:**\n`;
  result.votes.forEach(([id, c]) => { msg += `• ${playerMap.get(id) || 'Unknown'}: ${c} vote${c > 1 ? 's' : ''}${id === result.winner ? ' 👑' : ''}\n`; });
  msg += `\n**${winnerName} is the Sole Survivor.** 🔥`;
  await post(interaction.guild, CH.tribal, msg);
  await post(interaction.guild, CH.announcements, `🏆 **${winnerName}** has won Survivor Fantasy League!`);
  await interaction.editReply(msg);
}

// ---------------------------------------------------------------------------
// /merge — (host) force the merge early
// ---------------------------------------------------------------------------
export async function handleMerge(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase !== 'tribe') { await interaction.editReply('The tribes are not in a state to merge right now.'); return; }
  const players = await getPlayers(game.id);
  const archive = await archiveTribeRooms(interaction.guild, state, players);
  if (!archive.ok) {
    await interaction.editReply(`Merge stopped: missing #${archive.missing.join(', #')}. No game state was changed.`);
    return;
  }
  await mergeGameState(game.id);
  await updateGameState(game.id, { active_challenge: null });
  await post(interaction.guild, CH.announcements, '🏝️ **THE TRIBES HAVE MERGED!** Every player for themselves. Immunity is individual.');
  await postGif(interaction.guild, CH.announcements, 'merge'); // "Everybody drop your buffs."
  await post(interaction.guild, CH.camp, '🏝️ **WELCOME TO THE MERGED CAMP.** Tribe rooms are now read-only. The game is individual.');
  await openMergeNaming(interaction.guild, game.id); // players suggest a merged-tribe name
  await interaction.editReply('Merge complete — tribe rooms are read-only and the game is now in #camp. Players can `/suggestname`, then run `/namepoll`.');
}

// ---------------------------------------------------------------------------
// Merged-tribe naming: /suggestname (players) → /namepoll (host opens the vote,
// then runs it again to close the poll and rename the merged camp channel).
// ---------------------------------------------------------------------------
async function openMergeNaming(guild, gameId) {
  // Clear any leftover suggestions/poll from a previous merge, then invite names.
  await supabase.from('merge_suggestions').delete().eq('game_id', gameId);
  await updateGameState(gameId, { merged_tribe_name: null, merge_poll_message_id: null });
  // Open the merged camp so the remaining players can actually chat there (the
  // camp channel may deny @everyone by default). Per-player overwrites win.
  const state = await getGameState(gameId);
  const camp = gameChannel(guild, state, 'camp');
  if (camp) {
    for (const p of alivePlayers(await getPlayers(gameId))) {
      await camp.permissionOverwrites.edit(p.discord_id, { ViewChannel: true, SendMessages: true }).catch((e) => console.error('open camp:', e.message));
    }
  }
  await post(guild, CH.camp,
    '🏕️ **NAME YOUR NEW TRIBE!**\nEveryone still in the game: suggest a name with `/suggestname <name>`.\nWhen suggestions are in, the host opens the vote with `/namepoll`.');
}

export async function handleSuggestName(interaction) {
  const game = await requireGame(interaction, { live: true });
  if (!game) return;
  const state = await getGameState(game.id);
  if (state.phase !== 'individual') { await interaction.reply({ content: 'Tribe-name suggestions open after the merge.', ephemeral: true }); return; }
  if (state.merged_tribe_name) { await interaction.reply({ content: `The merged tribe is already named **${state.merged_tribe_name}**.`, ephemeral: true }); return; }
  if (state.merge_poll_message_id) { await interaction.reply({ content: 'The naming poll is already open — vote on the poll in #camp instead.', ephemeral: true }); return; }

  const { data: player } = await supabase.from('players').select('*').eq('game_id', game.id).eq('discord_id', interaction.user.id).maybeSingle();
  if (!player || player.is_eliminated) { await interaction.reply({ content: 'Only players still in the game can suggest a name.', ephemeral: true }); return; }

  const name = (interaction.options.getString('name') || '').replace(/[@`\n\r]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 24) { await interaction.reply({ content: 'Keep the name between 2 and 24 characters.', ephemeral: true }); return; }

  const { error } = await supabase.from('merge_suggestions')
    .upsert({ game_id: game.id, discord_id: interaction.user.id, name }, { onConflict: 'game_id,discord_id' });
  if (error) throw error;
  await interaction.reply({ content: `📝 Your suggestion **${name}** is in. (You can run \`/suggestname\` again to change it until the host opens the poll.)`, ephemeral: true });
}

export async function handleNamePoll(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase !== 'individual') { await interaction.editReply('The naming vote runs after the merge.'); return; }
  if (state.merged_tribe_name) { await interaction.editReply(`The merged tribe is already named **${state.merged_tribe_name}**.`); return; }

  const camp = gameChannel(interaction.guild, state, 'camp');
  if (!camp) { await interaction.editReply('Could not find the merged camp channel.'); return; }

  // Second run: a poll is open — close it, pick the winner, rename camp, lock tribes.
  if (state.merge_poll_message_id) {
    let pollMsg = null;
    try { pollMsg = await camp.messages.fetch(state.merge_poll_message_id); } catch { /* deleted */ }
    if (!pollMsg?.poll) {
      await updateGameState(game.id, { merge_poll_message_id: null });
      await interaction.editReply('The poll message is gone. Run `/namepoll` again to start a fresh vote.');
      return;
    }
    try { if (!pollMsg.poll.resultsFinalized) await pollMsg.poll.end(); } catch { /* already ended */ }
    try { pollMsg = await camp.messages.fetch(state.merge_poll_message_id); } catch { /* keep the copy we have */ }

    const answers = [...pollMsg.poll.answers.values()];
    const topVotes = answers.reduce((max, a) => Math.max(max, a.voteCount), 0);
    const leaders = answers.filter((a) => a.voteCount === topVotes);
    const winner = leaders[Math.floor(Math.random() * leaders.length)];
    const winnerName = winner?.text || 'The Merged Tribe';

    await camp.setName(slugify(winnerName)).catch((e) => console.error('rename camp:', e.message));
    await updateGameState(game.id, { merged_tribe_name: winnerName, merge_poll_message_id: null });

    // Everyone still in stays in camp; the pre-merge tribe rooms go dark.
    const players = await getPlayers(game.id);
    for (const p of alivePlayers(players)) {
      await camp.permissionOverwrites.edit(p.discord_id, { ViewChannel: true, SendMessages: true }).catch(() => {});
      for (const key of ['red', 'blue']) {
        const ch = gameChannel(interaction.guild, state, key);
        if (ch) await ch.permissionOverwrites.edit(p.discord_id, { ViewChannel: false, SendMessages: false }).catch(() => {});
      }
    }

    const tally = answers.sort((a, b) => b.voteCount - a.voteCount)
      .map((a) => `• ${a.text}: ${a.voteCount} vote${a.voteCount === 1 ? '' : 's'}${a === winner ? ' 👑' : ''}`).join('\n');
    await camp.send(`🔥 **THE TRIBE HAS SPOKEN — YOU HAVE A NAME.**\n\nYou are now the **${winnerName}**.\n\n${tally}\n\nYour old tribe rooms are closed.`).catch(() => {});
    await post(interaction.guild, CH.announcements, `🏝️ The merged tribe is now the **${winnerName}**!`);
    await interaction.editReply(`Named the merged tribe **${winnerName}**, renamed the camp channel, and closed the old tribe rooms.`);
    return;
  }

  // First run: build the poll from the collected suggestions.
  const { data: rows } = await supabase.from('merge_suggestions').select('name').eq('game_id', game.id);
  const seen = new Set();
  const options = [];
  for (const row of rows || []) {
    const clean = (row.name || '').trim().slice(0, 55);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); options.push(clean); }
    if (options.length >= 10) break; // Discord polls allow at most 10 answers
  }
  if (options.length < 2) {
    await interaction.editReply(`Need at least 2 different suggestions to open a poll (there ${options.length === 1 ? 'is 1' : `are ${options.length}`}). Ask players to \`/suggestname\` first.`);
    return;
  }

  let pollMsg;
  try {
    pollMsg = await camp.send({
      poll: {
        question: { text: 'What should the merged tribe be called?' },
        answers: options.map((text) => ({ text })),
        duration: 24, // hours; the host closes it early by re-running /namepoll
        allowMultiselect: false,
      },
    });
  } catch (e) {
    console.error('create merge poll:', e.message);
    await interaction.editReply('Could not create the poll (the bot may be missing the "Create Polls" permission in that channel).');
    return;
  }
  await updateGameState(game.id, { merge_poll_message_id: pollMsg.id });
  await interaction.editReply(`📊 Naming poll posted in #${camp.name} with ${options.length} option${options.length === 1 ? '' : 's'}. When voting's done, run \`/namepoll\` again to lock in the winner.`);
}

// ---------------------------------------------------------------------------
// /endgame — (host) end the season; lock channels read-only (chat preserved)
// ---------------------------------------------------------------------------
export async function handleEndGame(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId, { includeEnded: true });
  if (!game) { await interaction.editReply('No season to end.'); return; }

  await supabase.from('games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', game.id);
  await updateGameState(game.id, { phase: 'ended' });

  const guild = interaction.guild;
  if (guild) {
    for (const name of [CH.camp, CH.tribal, CH.lobby, CH.red, CH.blue, CH.spectators, CH.ponderosa]) {
      const ch = findChannel(guild, name);
      if (ch) await ch.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch((e) => console.error(`lock #${name}:`, e.message));
    }
  }
  await interaction.editReply('🏁 **The season is over.** Channels are read-only — the story stays, but no one can post anymore.');
}

// ---------------------------------------------------------------------------
// /standings
// ---------------------------------------------------------------------------
export async function handleStandings(interaction) {
  const game = await getCurrentGame(interaction.guildId, { includeEnded: true });
  if (!game) { await interaction.reply({ content: 'No season exists for this server yet.', ephemeral: true }); return; }
  const state = await getGameState(game.id);
  const players = await syncDiscordProfiles(interaction.guild, await getPlayers(game.id));
  if (!players.length) { await interaction.reply('No players registered yet.'); return; }

  if (state?.phase === 'ended') {
    const winner = players.find((p) => p.discord_id === state.winner_discord_id);
    await interaction.reply(`🏆 **GAME OVER** — **${winner?.username || 'Unknown'}** is the Sole Survivor. 👑`);
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const jurors = players.filter((p) => p.is_eliminated && p.is_juror);
  const boots = players.filter((p) => p.is_eliminated && !p.is_juror);
  const label = state?.phase === 'tribe' ? 'Tribe phase' : state?.phase === 'individual' ? 'Individual (merged)' : state?.phase === 'final' ? 'Final — jury vote' : 'Setup';

  let msg = `**🌴 ${game.name.toUpperCase()} — STANDINGS**\n_${label} · Round ${state?.current_round ?? 1}_\n\n**Still in (${alive.length}):**\n`;
  if (state?.phase === 'tribe') {
    const byTribe = {};
    alive.forEach((p) => { (byTribe[p.tribe || 'unassigned'] ||= []).push(p); });
    for (const [tribe, members] of Object.entries(byTribe)) { msg += `\n__${tribeLabel(tribe, state.tribe_names)}__\n`; members.forEach((p) => { msg += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; }); }
  } else {
    alive.forEach((p) => { msg += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; });
  }
  if (jurors.length) { msg += `\n**Jury (${jurors.length}):**\n`; jurors.forEach((p) => (msg += `• ${p.username}\n`)); }
  if (boots.length) { msg += `\n**Pre-merge boots (${boots.length}):**\n`; boots.forEach((p) => (msg += `• ${p.username}\n`)); }
  await interaction.reply(msg);
}

// ---------------------------------------------------------------------------
// Scheduled challenge — Sunday and Wednesday at 7:30pm local time by default.
// Override with CHALLENGE_DAYS (0=Sun..6=Sat), HOUR, and MINUTE.
// ---------------------------------------------------------------------------
export async function postScheduledChallenges(client) {
  const { data: games } = await supabase.from('games').select('*').eq('status', 'live');
  for (const game of games || []) {
    const state = await getGameState(game.id);
    if (!state || !['tribe', 'individual'].includes(state.phase)) continue; // skip final/ended/setup
    if (state.active_challenge) continue; // never replace an official challenge mid-round

    const slug = CHALLENGE_SLUGS[Math.floor(Math.random() * CHALLENGE_SLUGS.length)];
    await updateGameState(game.id, { active_challenge: slug });

    const guild = game.discord_guild_id ? client.guilds.cache.get(game.discord_guild_id) : null;
    if (!guild) continue;
    const teamLine = state.phase === 'tribe'
      ? 'Your whole tribe competes — scores combine into one tribe total. Losing tribe goes to Tribal Council.'
      : 'Every player for themselves. Only the top scorer is safe.';
    await post(guild, CH.lobby,
      `🌙 **${getChallengeName(slug).toUpperCase()}**\n\n${teamLine}\n\nPlay here:\n${CHALLENGE_BASE}/${game.code}/challenge`);
  }
}

export function startChallengeScheduler(client) {
  const hour = Number(process.env.CHALLENGE_HOUR ?? 19);
  const minute = Number(process.env.CHALLENGE_MINUTE ?? 30);
  const days = (process.env.CHALLENGE_DAYS || '0,3').split(',').map((day) => Number(day.trim()));
  const run = async () => {
    try { await postScheduledChallenges(client); } catch (e) { console.error('Scheduled challenge failed:', e.message); }
  };
  const scheduleNext = () => {
    const now = new Date();
    let next = null;
    for (let offset = 0; offset <= 7 && !next; offset++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);
      if (days.includes(candidate.getDay()) && candidate > now) next = candidate;
    }
    if (!next) return;
    const ms = next.getTime() - now.getTime();
    console.log(`⏰ Next challenge drop: ${next.toLocaleString()}`);
    setTimeout(async () => { await run(); scheduleNext(); }, ms);
  };
  scheduleNext();
}
