import { getCurrentGame, normalizeGameCode, requireGame, supabase, userCanManageGame } from './games.js';
import {
  getGameState, updateGameState, mergeGameState, getPlayers, alivePlayers, startGame,
  resolveImmunity, narrateChallengeResults, tallyElimination, eliminatePlayer,
  narrateTribalCouncil, tallyJury, crownWinner, narrateWinner,
} from './referee.js';

const CHALLENGE_BASE = 'https://survivor-fantasy-league-pi.vercel.app/game';

// One challenge is drawn per round; mirror of web/lib/challenges/catalog.ts.
const CHALLENGE_SLUGS = [
  'fire-signal-cipher', 'strategy-trivia', 'idol-lockbox', 'torchlight-labyrinth',
  'memory-totem', 'island-coordinates', 'chain-reaction', 'supply-drop',
  'risk-the-flame', 'tribal-pulse', 'oath-of-attention', 'survivor-gauntlet',
  'command-from-camp', 'vault-lock', 'riddle-trials',
];

// Live Discord server names.
const CH = { announcements: 'announcements', camp: 'camp', lobby: 'challenge-lobby', tribal: 'tribal-council', red: 'tribe-red', blue: 'tribe-blue', spectators: 'spectators', ponderosa: 'ponderosa' };
const ROLE = { player: 'Player', jury: 'Jury', spectator: 'Spectator', boot: 'Pre-merge boot' };

const findChannel = (guild, name) => guild?.channels?.cache.find((c) => c.name === name);
const findRole = (guild, name) => guild?.roles?.cache.find((r) => r.name === name);

async function post(guild, name, content) {
  const ch = findChannel(guild, name);
  if (!ch) return;
  try { await ch.send(content); } catch (e) { console.error(`post #${name}:`, e.message); }
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
async function grantTribeChannel(guild, discordId, tribe) {
  const ch = findChannel(guild, tribe === 'red' ? CH.red : CH.blue);
  if (!ch) return;
  try { await ch.permissionOverwrites.edit(discordId, { ViewChannel: true, SendMessages: true }); } catch (e) { console.error('grantTribeChannel:', e.message); }
}
async function revokeTribeChannels(guild, discordId) {
  for (const name of [CH.red, CH.blue]) {
    const ch = findChannel(guild, name);
    if (ch) await ch.permissionOverwrites.delete(discordId).catch(() => {});
  }
}
// Eliminated: strip Player + tribe access; grant boot/spectator (pre-merge) or jury (post-merge).
async function moveOut(guild, discordId, postMerge) {
  if (!guild) return;
  await revokeTribeChannels(guild, discordId);
  await removeRole(guild, discordId, ROLE.player);
  if (postMerge) {
    await addRole(guild, discordId, ROLE.jury);
  } else {
    await addRole(guild, discordId, ROLE.boot);
    await addRole(guild, discordId, ROLE.spectator);
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
  await interaction.deferReply();

  const existing = await getCurrentGame(interaction.guildId);
  if (existing) { await interaction.editReply(`A season already exists (**${existing.name}**, \`${existing.code}\`). End it with \`/endgame\` first.`); return; }

  const code = normalizeGameCode(interaction.options.getString('code'));
  const name = interaction.options.getString('name');
  const { data: game, error } = await supabase.from('games')
    .insert({ code, name, discord_guild_id: interaction.guildId, status: 'setup' })
    .select('*').single();
  if (error) { await interaction.editReply(`Could not create the season: ${error.message}`); return; }

  await supabase.from('game_state').insert({
    game_id: game.id, phase: 'tribe', current_round: 1, merge_at: 12, tribe_names: ['red', 'blue'],
  });
  await interaction.editReply(`🌱 Season **${name}** created (\`${code}\`). Players use \`/register\`, then the host runs \`/start\`.`);
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
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No season exists. Create one with `/newgame` first.'); return; }

  const result = await startGame(game.id);
  if (result.error) { await interaction.editReply(result.error); return; }
  await supabase.from('games').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', game.id);

  const guild = interaction.guild;
  if (guild) {
    for (const p of alivePlayers(await getPlayers(game.id))) {
      await addRole(guild, p.discord_id, ROLE.player);
      await grantTribeChannel(guild, p.discord_id, p.tribe);
    }
  }

  let msg = `🌴 **THE GAME BEGINS** — ${result.count} castaways, two tribes.\n\n`;
  for (const [tribe, members] of Object.entries(result.rosters)) {
    const emoji = tribe === 'red' ? '🔴' : tribe === 'blue' ? '🔵' : '•';
    msg += `${emoji} **Tribe ${tribe} (${members.length})**\n${members.map((m) => `• ${m}`).join('\n')}\n\n`;
  }
  msg += 'Each tribe only sees its own channel. First immunity challenge is up — merge at 12.';
  await post(guild, CH.announcements, msg);
  await interaction.editReply(msg);
}

// ---------------------------------------------------------------------------
// /challenge — (host) draw ONE random challenge for everyone this round
// ---------------------------------------------------------------------------
export async function handleChallenge(interaction) {
  if (!(await hostOnly(interaction))) return;
  const game = await requireGame(interaction, { live: true });
  if (!game) return;

  const slug = CHALLENGE_SLUGS[Math.floor(Math.random() * CHALLENGE_SLUGS.length)];
  await updateGameState(game.id, { active_challenge: slug });
  const state = await getGameState(game.id);
  const teamLine = state.phase === 'tribe'
    ? 'Your whole tribe competes — scores combine into one tribe total. Losing tribe goes to Tribal Council.'
    : 'Every player for themselves. Only the top scorer is safe.';

  await post(interaction.guild, CH.lobby,
    `🔥 **IMMUNITY CHALLENGE**\n\n${teamLine}\n\nEveryone plays the same challenge — enter here:\n${CHALLENGE_BASE}/${game.code}/challenge\n\nYou have 10 minutes.`);
  await interaction.reply({ content: `Challenge posted to #${CH.lobby} (same challenge for everyone).`, ephemeral: true });
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
    const winning = summary.winningTribe;
    const losing = (state.tribe_names || ['red', 'blue']).find((t) => t !== winning) || 'the other';
    msg += '**Tribe scores:**\n';
    summary.tribeTotals.forEach(([t, n], i) => { msg += `${i === 0 ? '🥇' : '•'} ${t}: ${n} points${t === winning ? ' 🛡️ IMMUNE' : ' — Tribal Council'}\n`; });
    await post(interaction.guild, CH.lobby, `🏆 **Tribe ${winning}** wins immunity!\n**Tribe ${losing}** has the fewest points and is going to Tribal Council. Head to #${CH.tribal} and \`/vote\` — own tribe only, votes stay secret.`);
  } else {
    msg += '**Scores:**\n';
    summary.ranked.forEach((r, i) => { msg += `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${r.player_id}: ${r.score} points${i === 0 ? ' 🛡️ IMMUNE' : ''}\n`; });
    await post(interaction.guild, CH.lobby, `🛡️ **${summary.winner}** wins individual immunity! Everyone else — #${CH.tribal} and \`/vote\`. You cannot vote for ${summary.winner}.`);
  }
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
    await supabase.from('votes').delete().eq('game_id', game.id).eq('voter_id', interaction.user.id).eq('round', state.current_round).eq('vote_type', 'jury');
    await supabase.from('votes').insert({ game_id: game.id, voter_id: interaction.user.id, target_id: target.id, round: state.current_round, vote_type: 'jury' });
    await interaction.reply({ content: `🔒 Your jury vote for ${target.username} to WIN is locked in.`, ephemeral: true });
    return;
  }

  if (!voter || voter.is_eliminated) { await interaction.reply({ content: 'You are not in the game or already eliminated.', ephemeral: true }); return; }
  if (state.phase === 'tribe' && voter.has_immunity) { await interaction.reply({ content: 'Your tribe won immunity — you are safe and do not vote this round.', ephemeral: true }); return; }
  if (target.id === interaction.user.id) { await interaction.reply({ content: 'You cannot vote for yourself.', ephemeral: true }); return; }
  if (!targetData || targetData.is_eliminated) { await interaction.reply({ content: 'That player is not in the game.', ephemeral: true }); return; }
  if (targetData.has_immunity) { await interaction.reply({ content: `${target.username} has immunity and cannot be voted out.`, ephemeral: true }); return; }
  if (state.phase === 'tribe' && targetData.tribe !== voter.tribe) { await interaction.reply({ content: 'You can only vote for someone on your own tribe.', ephemeral: true }); return; }

  await supabase.from('votes').delete().eq('game_id', game.id).eq('voter_id', interaction.user.id).eq('round', state.current_round).eq('vote_type', 'elimination');
  await supabase.from('votes').insert({ game_id: game.id, voter_id: interaction.user.id, target_id: target.id, round: state.current_round, vote_type: 'elimination' });
  await interaction.reply({ content: `🔒 Your vote for ${target.username} is locked in and stays secret until the host reveals the tally.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /tribal — (host) reveal the vote and eliminate a player
// ---------------------------------------------------------------------------
export async function handleTribal(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase === 'final') { await interaction.editReply('It is the final three — use `/finaltribal`.'); return; }

  const players = await getPlayers(game.id);
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  const result = await tallyElimination(game.id, state.current_round);
  if (!result) { await interaction.editReply('No votes have been cast yet.'); return; }

  const aliveBefore = alivePlayers(players).length;
  const postMerge = state.phase === 'individual';
  const narration = await narrateTribalCouncil(result.votes, playerMap, { tie: result.tie, tied: result.tied });

  await eliminatePlayer(game.id, result.eliminated, { juror: postMerge, placement: aliveBefore });
  await moveOut(interaction.guild, result.eliminated, postMerge);

  const aliveAfter = aliveBefore - 1;
  let transition = '';
  if (state.phase === 'tribe' && aliveAfter <= state.merge_at) {
    await mergeGameState(game.id);
    await updateGameState(game.id, { current_round: state.current_round + 1 });
    transition = `\n\n🏝️ **THE MERGE!** ${aliveAfter} players remain — individual game from here.`;
    await post(interaction.guild, CH.announcements, `🏝️ **THE MERGE!** ${aliveAfter} players remain. It is now every player for themselves.`);
  } else if (aliveAfter <= 3) {
    const finalists = alivePlayers(await getPlayers(game.id)).map((p) => p.discord_id);
    await updateGameState(game.id, { phase: 'final', finalist_pool: finalists, current_round: state.current_round + 1 });
    transition = `\n\n🔥 **FINAL 3: ${finalists.map((id) => playerMap.get(id)).join(', ')}.** Host: run \`/finaltribal\`.`;
  } else {
    await updateGameState(game.id, { current_round: state.current_round + 1 });
  }

  const name = playerMap.get(result.eliminated) || 'Player';
  let msg = `🔥 **TRIBAL COUNCIL**\n\n${narration}\n\n**Final tally:**\n`;
  result.votes.forEach(([id, c]) => { msg += `• ${playerMap.get(id) || 'Unknown'}: ${c} vote${c > 1 ? 's' : ''}${id === result.eliminated ? ' ❌' : ''}\n`; });
  msg += `\n**${name}, the tribe has spoken. 🔦**${postMerge ? ' You are now on the **Jury**.' : ' You are now a **Pre-merge boot**.'}${transition}`;
  await post(interaction.guild, CH.tribal, msg);
  await interaction.editReply(msg);
}

// ---------------------------------------------------------------------------
// /finaltribal — (host) the final three face the jury
// ---------------------------------------------------------------------------
export async function handleFinalTribal(interaction) {
  if (!(await hostOnly(interaction))) return;
  await interaction.deferReply();
  const game = await getCurrentGame(interaction.guildId);
  if (!game) { await interaction.editReply('No active season.'); return; }
  const state = await getGameState(game.id);
  if (state.phase !== 'final') { await interaction.editReply('It is not the final tribal yet — play down to three players first.'); return; }

  const players = await getPlayers(game.id);
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  const result = await tallyJury(game.id, state.current_round);

  if (!result) {
    const finalists = alivePlayers(players);
    await updateGameState(game.id, { finalist_pool: finalists.map((p) => p.discord_id) });
    await post(interaction.guild, CH.tribal,
      `⚖️ **FINAL TRIBAL COUNCIL**\n\nThe jury may now speak. Jurors — \`/vote\` for who should WIN.\nFinalists: **${finalists.map((p) => p.username).join(', ')}** (finalists cannot vote).\n\nWhen every juror has voted, the host runs \`/finaltribal\` again to read the votes.`);
    await interaction.editReply('Final Tribal opened — jurors can vote now. Run `/finaltribal` again to read the votes.');
    return;
  }

  if (result.tie) {
    await updateGameState(game.id, { finalist_pool: result.tied });
    await supabase.from('votes').delete().eq('game_id', game.id).eq('round', state.current_round).eq('vote_type', 'jury');
    const names = result.tied.map((id) => playerMap.get(id) || 'Unknown').join(' vs ');
    await post(interaction.guild, CH.tribal, `⚖️ **THE JURY IS DEADLOCKED.** Revote between **${names}** — jurors, \`/vote\` again.`);
    await interaction.editReply(`Tie — revote between ${names}, then run \`/finaltribal\`.`);
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
  await mergeGameState(game.id);
  await post(interaction.guild, CH.announcements, '🏝️ **THE TRIBES HAVE MERGED!** Every player for themselves. Immunity is individual.');
  await interaction.editReply('Merge complete — the game is now individual.');
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
  const players = await getPlayers(game.id);
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
    for (const [tribe, members] of Object.entries(byTribe)) { msg += `\n__Tribe ${tribe}__\n`; members.forEach((p) => { msg += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; }); }
  } else {
    alive.forEach((p) => { msg += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; });
  }
  if (jurors.length) { msg += `\n**Jury (${jurors.length}):**\n`; jurors.forEach((p) => (msg += `• ${p.username}\n`)); }
  if (boots.length) { msg += `\n**Pre-merge boots (${boots.length}):**\n`; boots.forEach((p) => (msg += `• ${p.username}\n`)); }
  await interaction.reply(msg);
}
