import {
  supabase,
  getGameState,
  updateGameState,
  mergeGameState,
  getPlayers,
  alivePlayers,
  startGame,
  resolveImmunity,
  narrateChallengeResults,
  tallyElimination,
  eliminatePlayer,
  narrateTribalCouncil,
  tallyJury,
  crownWinner,
  narrateWinner,
} from './referee.js';

const CHALLENGE_URL = 'https://survivor-fantasy-league-pi.vercel.app/challenge';

// All challenge slugs (mirror of web/lib/challenges/catalog.ts). /challenge
// picks one at random and stores it so every player runs the SAME challenge.
const CHALLENGE_SLUGS = [
  'fire-signal-cipher', 'strategy-trivia', 'idol-lockbox', 'torchlight-labyrinth',
  'memory-totem', 'island-coordinates', 'chain-reaction', 'supply-drop',
  'risk-the-flame', 'tribal-pulse', 'oath-of-attention', 'survivor-gauntlet',
  'command-from-camp', 'vault-lock', 'riddle-trials',
];

// --- Live Discord server names (from the actual guild) ----------------------
const CH = {
  announcements: 'announcements',
  camp: 'camp',
  lobby: 'challenge-lobby',
  tribal: 'tribal-council',
  red: 'tribe-red',
  blue: 'tribe-blue',
  spectators: 'spectators',
  ponderosa: 'ponderosa',
};
const ROLE = { player: 'Player', jury: 'Jury', spectator: 'Spectator', boot: 'Pre-merge boot' };

const findChannel = (guild, name) => guild?.channels?.cache.find((c) => c.name === name);
const findRole = (guild, name) => guild?.roles?.cache.find((r) => r.name === name);

async function post(guild, channelName, content) {
  const ch = findChannel(guild, channelName);
  if (!ch) return;
  try { await ch.send(content); } catch (e) { console.error(`post #${channelName} failed:`, e.message); }
}
async function addRole(guild, discordId, roleName) {
  const role = findRole(guild, roleName);
  if (!role) return;
  try { const m = await guild.members.fetch(discordId); await m.roles.add(role); }
  catch (e) { console.error(`addRole ${roleName}:`, e.message); }
}
async function removeRole(guild, discordId, roleName) {
  const role = findRole(guild, roleName);
  if (!role) return;
  try { const m = await guild.members.fetch(discordId); if (m.roles.cache.has(role.id)) await m.roles.remove(role); }
  catch (e) { console.error(`removeRole ${roleName}:`, e.message); }
}
async function grantTribeChannel(guild, discordId, tribe) {
  const ch = findChannel(guild, tribe === 'red' ? CH.red : CH.blue);
  if (!ch) return;
  try { await ch.permissionOverwrites.edit(discordId, { ViewChannel: true, SendMessages: true }); }
  catch (e) { console.error('grantTribeChannel:', e.message); }
}
async function revokeTribeChannels(guild, discordId) {
  for (const name of [CH.red, CH.blue]) {
    const ch = findChannel(guild, name);
    if (!ch) continue;
    await ch.permissionOverwrites.delete(discordId).catch(() => {});
  }
}

// Move an eliminated player out of the game: strip Player + tribe access; give
// them Pre-merge boot + Spectator (pre-merge) or Jury (post-merge), which grant
// #spectators / #ponderosa. They can still spectate the public channels.
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

// ---------------------------------------------------------------------------
// /register — join the game (lobby only)
// ---------------------------------------------------------------------------
export async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const state = await getGameState();
  if (state && state.phase !== 'lobby') {
    await interaction.reply({ content: 'The game has already started — registration is closed.', ephemeral: true });
    return;
  }

  const { data: existing } = await supabase.from('players').select('*').eq('discord_id', userId).single();
  if (existing) {
    await interaction.reply({ content: 'You are already in the game.', ephemeral: true });
    return;
  }

  const { error } = await supabase.from('players').insert({
    discord_id: userId, username, tribe: null, is_eliminated: false, has_immunity: false, is_juror: false,
  });
  if (error) throw error;

  await interaction.reply({ content: `Welcome to the game, ${username}. Wait for the host to form the tribes.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /start — (host) assign tribes, roles, and tribe-channel access
// ---------------------------------------------------------------------------
export async function handleStart(interaction) {
  await interaction.deferReply();
  const result = await startGame();
  if (result.error) { await interaction.editReply(result.error); return; }

  const guild = interaction.guild;
  if (guild) {
    for (const p of alivePlayers(await getPlayers())) {
      await addRole(guild, p.discord_id, ROLE.player);
      await grantTribeChannel(guild, p.discord_id, p.tribe);
    }
  }

  let message = `🌴 **THE GAME BEGINS** — ${result.count} castaways, two tribes.\n\n`;
  for (const [tribe, members] of Object.entries(result.rosters)) {
    const emoji = tribe === 'red' ? '🔴' : tribe === 'blue' ? '🔵' : '•';
    message += `${emoji} **Tribe ${tribe} (${members.length})**\n${members.map((m) => `• ${m}`).join('\n')}\n\n`;
  }
  message += `Each tribe can only see its own tribe channel. First immunity challenge is up — merge at 12.`;
  await post(guild, CH.announcements, message);
  await interaction.editReply(message);
}

// ---------------------------------------------------------------------------
// /challenge — pick ONE challenge for everyone and post it to #challenge-lobby
// ---------------------------------------------------------------------------
export async function handleChallenge(interaction) {
  const state = await getGameState();
  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.reply({ content: 'Start a game with `/start` first.', ephemeral: true });
    return;
  }

  const slug = CHALLENGE_SLUGS[Math.floor(Math.random() * CHALLENGE_SLUGS.length)];
  await updateGameState({ active_challenge: slug });

  const teamLine = state.phase === 'tribe'
    ? 'Your whole tribe competes — your scores combine into one tribe total. Losing tribe goes to Tribal Council.'
    : 'Every player for themselves. Only the top scorer is safe tonight.';

  await post(interaction.guild, CH.lobby,
    `🔥 **IMMUNITY CHALLENGE**\n\n${teamLine}\n\nEveryone plays the same challenge — enter here:\n${CHALLENGE_URL}\n\nYou have 10 minutes.`);
  await interaction.reply({ content: `Challenge posted to #${CH.lobby} (same challenge for everyone).`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /results — (host) tally scores, grant immunity, name the losing tribe
// ---------------------------------------------------------------------------
export async function handleResults(interaction) {
  await interaction.deferReply();
  const state = await getGameState();
  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.editReply('No active challenge phase. Start a game with `/start` first.');
    return;
  }

  const summary = await resolveImmunity();
  if (summary.empty) {
    await interaction.editReply('No challenge results yet. Players need to complete the challenge first.');
    return;
  }

  const narration = await narrateChallengeResults(summary);
  let message = `🔥 **CHALLENGE RESULTS**\n\n${narration}\n\n`;

  if (summary.phase === 'tribe') {
    const winning = summary.winningTribe;
    const losing = (state.tribe_names || ['red', 'blue']).find((t) => t !== winning) || 'the other';
    message += '**Tribe scores:**\n';
    summary.tribeTotals.forEach(([tribe, total], i) => {
      const tag = tribe === winning ? ' 🛡️ IMMUNE' : ' — Tribal Council';
      message += `${i === 0 ? '🥇' : '•'} ${tribe}: ${total} points${tag}\n`;
    });
    await post(interaction.guild, CH.lobby,
      `🏆 **Tribe ${winning}** wins immunity!\n**Tribe ${losing}** has the fewest points and is going to Tribal Council. Head to #${CH.tribal} and \`/vote\` — you can only vote your own tribe, and votes stay secret.`);
    message += `\nTribe ${losing} is voting someone out.`;
  } else {
    message += '**Scores:**\n';
    summary.ranked.forEach((r, i) => {
      message += `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} ${r.player_id}: ${r.score} points${i === 0 ? ' 🛡️ IMMUNE' : ''}\n`;
    });
    await post(interaction.guild, CH.lobby,
      `🛡️ **${summary.winner}** wins individual immunity! Everyone else — head to #${CH.tribal} and \`/vote\`. You cannot vote for ${summary.winner}.`);
  }

  await interaction.editReply(message);
}

// ---------------------------------------------------------------------------
// /vote — secret elimination vote, or a jury vote at the finale
// ---------------------------------------------------------------------------
export async function handleVote(interaction) {
  const voterId = interaction.user.id;
  const target = interaction.options.getUser('player');
  const state = await getGameState();

  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.reply({ content: 'There is no vote happening right now.', ephemeral: true });
    return;
  }

  const { data: voter } = await supabase.from('players').select('*').eq('discord_id', voterId).single();
  const { data: targetData } = await supabase.from('players').select('*').eq('discord_id', target.id).single();

  // Jury finale
  if (state.phase === 'final') {
    if (!voter || !voter.is_juror) {
      await interaction.reply({ content: 'Only jury members vote at the finale.', ephemeral: true });
      return;
    }
    const pool = state.finalist_pool || [];
    if (!targetData || !pool.includes(target.id)) {
      await interaction.reply({ content: 'You can only vote for one of the three finalists.', ephemeral: true });
      return;
    }
    await supabase.from('votes').delete().eq('voter_id', voterId).eq('round', state.current_round).eq('vote_type', 'jury');
    const { error } = await supabase.from('votes').insert({ voter_id: voterId, target_id: target.id, round: state.current_round, vote_type: 'jury' });
    if (error) throw error;
    await interaction.reply({ content: `🔒 Your jury vote for ${target.username} to WIN is locked in.`, ephemeral: true });
    return;
  }

  // Elimination vote
  if (!voter || voter.is_eliminated) {
    await interaction.reply({ content: 'You are not in the game or already eliminated.', ephemeral: true });
    return;
  }
  if (state.phase === 'tribe' && voter.has_immunity) {
    await interaction.reply({ content: 'Your tribe won immunity — you are safe and do not vote this round.', ephemeral: true });
    return;
  }
  if (target.id === voterId) {
    await interaction.reply({ content: 'You cannot vote for yourself.', ephemeral: true });
    return;
  }
  if (!targetData || targetData.is_eliminated) {
    await interaction.reply({ content: 'That player is not in the game.', ephemeral: true });
    return;
  }
  if (targetData.has_immunity) {
    await interaction.reply({ content: `${target.username} has immunity and cannot be voted out.`, ephemeral: true });
    return;
  }
  if (state.phase === 'tribe' && targetData.tribe !== voter.tribe) {
    await interaction.reply({ content: 'You can only vote for someone on your own tribe.', ephemeral: true });
    return;
  }

  await supabase.from('votes').delete().eq('voter_id', voterId).eq('round', state.current_round).eq('vote_type', 'elimination');
  const { error } = await supabase.from('votes').insert({ voter_id: voterId, target_id: target.id, round: state.current_round, vote_type: 'elimination' });
  if (error) throw error;

  await interaction.reply({ content: `🔒 Your vote for ${target.username} is locked in and stays secret until the host reveals the tally.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /tribal — (host) reveal the vote and eliminate a player
// ---------------------------------------------------------------------------
export async function handleTribal(interaction) {
  await interaction.deferReply();
  const state = await getGameState();
  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.editReply('There is no Tribal Council to hold right now.');
    return;
  }
  if (state.phase === 'final') {
    await interaction.editReply('It is the final three — use `/finaltribal` to bring in the jury.');
    return;
  }

  const players = await getPlayers();
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  const result = await tallyElimination(state.current_round);
  if (!result) { await interaction.editReply('No votes have been cast yet.'); return; }

  const aliveBefore = alivePlayers(players).length;
  const postMerge = state.phase === 'individual';
  const narration = await narrateTribalCouncil(result.votes, playerMap, { tie: result.tie, tied: result.tied });

  await eliminatePlayer(result.eliminated, { juror: postMerge, placement: aliveBefore });
  await moveOut(interaction.guild, result.eliminated, postMerge);

  const aliveAfter = aliveBefore - 1;
  let transition = '';

  if (state.phase === 'tribe' && aliveAfter <= state.merge_at) {
    await mergeGameState();
    await updateGameState({ current_round: state.current_round + 1 });
    transition = `\n\n🏝️ **THE MERGE!** ${aliveAfter} players remain — it is now every player for themselves. Immunity is individual from here.`;
    await post(interaction.guild, CH.announcements, `🏝️ **THE MERGE!** ${aliveAfter} players remain. Individual game begins.`);
  } else if (aliveAfter <= 3) {
    const finalists = alivePlayers(await getPlayers()).map((p) => p.discord_id);
    await updateGameState({ phase: 'final', finalist_pool: finalists, current_round: state.current_round + 1 });
    const names = finalists.map((id) => playerMap.get(id)).join(', ');
    transition = `\n\n🔥 **FINAL 3: ${names}.** Host: run \`/finaltribal\` to bring in the jury.`;
  } else {
    await updateGameState({ current_round: state.current_round + 1 });
  }

  const eliminatedName = playerMap.get(result.eliminated) || 'Player';
  const roleNote = postMerge ? ' You are now on the **Jury**.' : ' You are now a **Pre-merge boot**.';
  let msg = `🔥 **TRIBAL COUNCIL**\n\n${narration}\n\n**Final tally:**\n`;
  result.votes.forEach(([id, count]) => {
    msg += `• ${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}${id === result.eliminated ? ' ❌' : ''}\n`;
  });
  msg += `\n**${eliminatedName}, the tribe has spoken. 🔦**${roleNote}${transition}`;
  await post(interaction.guild, CH.tribal, msg);
  await interaction.editReply(msg);
}

// ---------------------------------------------------------------------------
// /finaltribal — (host) the final three face the jury
// ---------------------------------------------------------------------------
export async function handleFinalTribal(interaction) {
  await interaction.deferReply();
  const state = await getGameState();
  if (!state || state.phase !== 'final') {
    await interaction.editReply('It is not the final tribal yet — play down to three players first.');
    return;
  }

  const players = await getPlayers();
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));
  const result = await tallyJury(state.current_round);

  // No jury votes yet → open the final vote.
  if (!result) {
    const finalists = alivePlayers(players);
    await updateGameState({ finalist_pool: finalists.map((p) => p.discord_id) });
    const names = finalists.map((p) => p.username).join(', ');
    await post(interaction.guild, CH.tribal,
      `⚖️ **FINAL TRIBAL COUNCIL**\n\nThe jury may now speak. Jurors — \`/vote\` for who you believe should WIN.\nFinalists: **${names}** (finalists cannot vote).\n\nWhen every juror has voted, the host runs \`/finaltribal\` again to read the votes.`);
    await interaction.editReply('Final Tribal opened — the jury can vote now. Run `/finaltribal` again to read the votes.');
    return;
  }

  if (result.tie) {
    await updateGameState({ finalist_pool: result.tied });
    await supabase.from('votes').delete().eq('round', state.current_round).eq('vote_type', 'jury');
    const names = result.tied.map((id) => playerMap.get(id) || 'Unknown').join(' vs ');
    await post(interaction.guild, CH.tribal, `⚖️ **THE JURY IS DEADLOCKED.** Revote between **${names}** — jurors, \`/vote\` again.`);
    await interaction.editReply(`Tie — revote between ${names}. Jurors vote again, then run \`/finaltribal\`.`);
    return;
  }

  const winnerName = playerMap.get(result.winner) || 'the winner';
  const ordered = result.votes.map(([id]) => id).filter((id) => id !== result.winner);
  if (ordered[0]) await supabase.from('players').update({ placement: 2 }).eq('discord_id', ordered[0]);
  if (ordered[1]) await supabase.from('players').update({ placement: 3 }).eq('discord_id', ordered[1]);
  await crownWinner(result.winner);

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
// /merge — (host) force the merge early (also auto-happens at 12)
// ---------------------------------------------------------------------------
export async function handleMerge(interaction) {
  await interaction.deferReply();
  const state = await getGameState();
  if (!state || state.phase !== 'tribe') {
    await interaction.editReply('The tribes are not in a state to merge right now.');
    return;
  }
  await mergeGameState();
  await post(interaction.guild, CH.announcements, '🏝️ **THE TRIBES HAVE MERGED!** It is now every player for themselves. Immunity is individual.');
  await interaction.editReply('Merge complete — the game is now individual.');
}

// ---------------------------------------------------------------------------
// /endgame — (host) end the game; lock channels so chat is preserved but frozen
// ---------------------------------------------------------------------------
export async function handleEndgame(interaction) {
  await interaction.deferReply();
  await updateGameState({ phase: 'ended' });

  const guild = interaction.guild;
  if (guild) {
    for (const name of [CH.camp, CH.tribal, CH.lobby, CH.red, CH.blue, CH.spectators, CH.ponderosa]) {
      const ch = findChannel(guild, name);
      if (!ch) continue;
      try { await ch.permissionOverwrites.edit(guild.id, { SendMessages: false }); }
      catch (e) { console.error(`endgame lock #${name}:`, e.message); }
    }
  }
  await interaction.editReply('🏁 **The game is over.** All channels are now read-only — the story stays, but no one can post anymore.');
}

// ---------------------------------------------------------------------------
// /newseason — (host) hard reset
// ---------------------------------------------------------------------------
export async function handleNewSeason(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const players = await getPlayers();

  await supabase.from('votes').delete().neq('voter_id', '');
  await supabase.from('challenges').delete().neq('player_id', '');
  await supabase.from('players').delete().neq('discord_id', '');
  await updateGameState({ phase: 'lobby', current_round: 1, active_challenge: null, finalist_pool: null, winner_discord_id: null });

  if (guild) {
    for (const p of players) {
      await revokeTribeChannels(guild, p.discord_id);
      for (const r of [ROLE.player, ROLE.jury, ROLE.spectator, ROLE.boot]) await removeRole(guild, p.discord_id, r);
    }
  }
  await interaction.editReply('🌅 **NEW SEASON** — players, votes, challenges, and roles reset. Use `/register` to join.');
}

// ---------------------------------------------------------------------------
// /standings
// ---------------------------------------------------------------------------
export async function handleStandings(interaction) {
  const state = await getGameState();
  const players = await getPlayers();
  if (!players || players.length === 0) { await interaction.reply('No players registered yet.'); return; }

  if (state && state.phase === 'ended') {
    const winner = players.find((p) => p.discord_id === state.winner_discord_id);
    await interaction.reply(`🏆 **GAME OVER** — **${winner?.username || 'Unknown'}** is the Sole Survivor. 👑`);
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const jurors = players.filter((p) => p.is_eliminated && p.is_juror);
  const boots = players.filter((p) => p.is_eliminated && !p.is_juror);
  const phaseLabel = state?.phase === 'tribe' ? 'Tribe phase' : state?.phase === 'individual' ? 'Individual (merged)' : state?.phase === 'final' ? 'Final — jury vote' : 'Lobby';

  let message = `**🌴 SURVIVOR STANDINGS**\n_${phaseLabel} · Round ${state?.current_round ?? 1}_\n\n**Still in (${alive.length}):**\n`;
  if (state?.phase === 'tribe') {
    const byTribe = {};
    alive.forEach((p) => { (byTribe[p.tribe || 'unassigned'] ||= []).push(p); });
    for (const [tribe, members] of Object.entries(byTribe)) {
      message += `\n__Tribe ${tribe}__\n`;
      members.forEach((p) => { message += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; });
    }
  } else {
    alive.forEach((p) => { message += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`; });
  }
  if (jurors.length) { message += `\n**Jury (${jurors.length}):**\n`; jurors.forEach((p) => (message += `• ${p.username}\n`)); }
  if (boots.length) { message += `\n**Pre-merge boots (${boots.length}):**\n`; boots.forEach((p) => (message += `• ${p.username}\n`)); }

  await interaction.reply(message);
}
