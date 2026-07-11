import {
  supabase,
  getGameState,
  updateGameState,
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

const CHALLENGE_URL = 'https://web-86d8fkyo6-nox-72b81e55.vercel.app/challenge';

// ---------------------------------------------------------------------------
// /register — join the game (lobby only)
// ---------------------------------------------------------------------------
export async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const state = await getGameState();
  if (state && state.phase !== 'lobby') {
    await interaction.reply({
      content: 'The game has already started — registration is closed.',
      ephemeral: true,
    });
    return;
  }

  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', userId)
    .single();

  if (existing) {
    await interaction.reply({
      content: 'You are already in the game.',
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('players').insert({
    discord_id: userId,
    username,
    tribe: null,
    is_eliminated: false,
    has_immunity: false,
    is_juror: false,
  });

  if (error) throw error;

  await interaction.reply({
    content: `Welcome to the game, ${username}. The tribe will see you soon.`,
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------
// /start — (host) assign tribes and begin the game
// ---------------------------------------------------------------------------
export async function handleStart(interaction) {
  await interaction.deferReply();

  const result = await startGame();
  if (result.error) {
    await interaction.editReply(result.error);
    return;
  }

  let message = `🌴 **THE GAME BEGINS** — ${result.count} castaways, two tribes.\n\n`;
  for (const [tribe, members] of Object.entries(result.rosters)) {
    message += `**${tribe} (${members.length})**\n${members.map((m) => `• ${m}`).join('\n')}\n\n`;
  }
  message += `First immunity challenge is up. Losing tribe goes to Tribal Council. Merge at 12.`;

  await interaction.editReply(message);
}

// ---------------------------------------------------------------------------
// /challenge — post the immunity challenge link (phase-aware)
// ---------------------------------------------------------------------------
export async function handleChallenge(interaction) {
  const state = await getGameState();
  const phase = state?.phase;

  let intro;
  if (phase === 'tribe') {
    intro =
      '🔥 **TRIBAL IMMUNITY CHALLENGE**\n\nYour whole tribe competes together — your scores combine into one tribe total. Losing tribe goes to Tribal Council.';
  } else if (phase === 'individual' || phase === 'final') {
    intro =
      '🔥 **INDIVIDUAL IMMUNITY CHALLENGE**\n\nEvery player for themselves. Only the top scorer is safe tonight.';
  } else {
    intro = '🔥 **IMMUNITY CHALLENGE**';
  }

  await interaction.reply({
    content: `${intro}\n\nHead to the challenge arena:\n${CHALLENGE_URL}\n\nYou have 10 minutes.`,
  });
}

// ---------------------------------------------------------------------------
// /results — (host) resolve immunity and narrate
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
    message += '**Tribe scores:**\n';
    summary.tribeTotals.forEach(([tribe, total], i) => {
      const safe = tribe === summary.winningTribe ? ' 🛡️ IMMUNE' : ' — Tribal Council';
      message += `${i === 0 ? '🥇' : '•'} ${tribe}: ${total} points${safe}\n`;
    });
  } else {
    message += '**Scores:**\n';
    summary.ranked.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      const immunity = i === 0 ? ' 🛡️ IMMUNE' : '';
      message += `${medal} ${r.player_id}: ${r.score} points${immunity}\n`;
    });
  }

  await interaction.editReply(message);
}

// ---------------------------------------------------------------------------
// /vote — cast an elimination vote, or a jury vote in the finale
// ---------------------------------------------------------------------------
export async function handleVote(interaction) {
  const voterId = interaction.user.id;
  const target = interaction.options.getUser('player');
  const state = await getGameState();

  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.reply({ content: 'There is no vote happening right now.', ephemeral: true });
    return;
  }

  const { data: voter } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', voterId)
    .single();
  const { data: targetData } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', target.id)
    .single();

  // ---- Jury finale: jurors vote FOR a finalist to win ----
  if (state.phase === 'final') {
    if (!voter || !voter.is_juror) {
      await interaction.reply({ content: 'Only jury members vote at the finale.', ephemeral: true });
      return;
    }
    const pool = state.finalist_pool || [];
    if (!targetData || !pool.includes(target.id)) {
      await interaction.reply({ content: 'You can only vote for one of the finalists.', ephemeral: true });
      return;
    }
    await supabase
      .from('votes')
      .delete()
      .eq('voter_id', voterId)
      .eq('round', state.current_round)
      .eq('vote_type', 'jury');
    const { error } = await supabase.from('votes').insert({
      voter_id: voterId,
      target_id: target.id,
      round: state.current_round,
      vote_type: 'jury',
    });
    if (error) throw error;
    await interaction.reply({ content: `Your jury vote for ${target.username} to WIN is locked in.`, ephemeral: true });
    return;
  }

  // ---- Elimination vote (tribe or individual phase) ----
  if (!voter || voter.is_eliminated) {
    await interaction.reply({ content: 'You are not in the game or already eliminated.', ephemeral: true });
    return;
  }
  if (state.phase === 'tribe' && voter.has_immunity) {
    await interaction.reply({
      content: 'Your tribe won immunity — you are safe and do not vote this round.',
      ephemeral: true,
    });
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
    await interaction.reply({ content: `${target.username} has immunity. You cannot vote for them.`, ephemeral: true });
    return;
  }
  if (state.phase === 'tribe' && targetData.tribe !== voter.tribe) {
    await interaction.reply({ content: 'You can only vote for someone on your own tribe.', ephemeral: true });
    return;
  }

  await supabase
    .from('votes')
    .delete()
    .eq('voter_id', voterId)
    .eq('round', state.current_round)
    .eq('vote_type', 'elimination');
  const { error } = await supabase.from('votes').insert({
    voter_id: voterId,
    target_id: target.id,
    round: state.current_round,
    vote_type: 'elimination',
  });
  if (error) throw error;

  await interaction.reply({ content: `Your vote for ${target.username} has been cast.`, ephemeral: true });
}

// ---------------------------------------------------------------------------
// /tribal — (host) tally votes; eliminate, or crown the winner in the finale
// ---------------------------------------------------------------------------
export async function handleTribal(interaction) {
  await interaction.deferReply();

  const state = await getGameState();
  if (!state || state.phase === 'lobby' || state.phase === 'ended') {
    await interaction.editReply('There is no Tribal Council to hold right now.');
    return;
  }

  const players = await getPlayers();
  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));

  // ---- Finale: read the jury's votes ----
  if (state.phase === 'final') {
    const result = await tallyJury(state.current_round);
    if (!result) {
      await interaction.editReply('The jury has not voted yet.');
      return;
    }

    if (result.tie) {
      // Revote: drop everyone but the tied leaders, clear jury votes, vote again.
      await updateGameState({ finalist_pool: result.tied });
      await supabase
        .from('votes')
        .delete()
        .eq('round', state.current_round)
        .eq('vote_type', 'jury');

      const names = result.tied.map((id) => playerMap.get(id) || 'Unknown').join(' vs ');
      let msg = `⚖️ **THE JURY IS DEADLOCKED**\n\n`;
      result.votes.forEach(([id, count]) => {
        msg += `• ${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}\n`;
      });
      msg += `\nRevote between **${names}**. Jury, cast your votes again with \`/vote\`, then the host runs \`/tribal\`.`;
      await interaction.editReply(msg);
      return;
    }

    const winnerName = playerMap.get(result.winner) || 'the winner';
    // Assign runner-up placements by jury votes received.
    const ordered = result.votes.map(([id]) => id).filter((id) => id !== result.winner);
    if (ordered[0]) await supabase.from('players').update({ placement: 2 }).eq('discord_id', ordered[0]);
    if (ordered[1]) await supabase.from('players').update({ placement: 3 }).eq('discord_id', ordered[1]);

    await crownWinner(result.winner);

    const voteBoard = result.votes
      .map(([id, count]) => `${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}`)
      .join('\n');
    const narration = await narrateWinner(winnerName, voteBoard);

    let msg = `🏆 **THE FINALE**\n\n${narration}\n\n**Final jury vote:**\n`;
    result.votes.forEach(([id, count]) => {
      const crown = id === result.winner ? ' 👑' : '';
      msg += `• ${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}${crown}\n`;
    });
    msg += `\n**${winnerName} is the Sole Survivor.** 🔥`;
    await interaction.editReply(msg);
    return;
  }

  // ---- Elimination Tribal Council (tribe / individual phase) ----
  const result = await tallyElimination(state.current_round);
  if (!result) {
    await interaction.editReply('No votes have been cast yet.');
    return;
  }

  const aliveBefore = alivePlayers(players).length;
  const postMerge = state.phase === 'individual';

  const narration = await narrateTribalCouncil(result.votes, playerMap, {
    tie: result.tie,
    tied: result.tied,
  });

  await eliminatePlayer(result.eliminated, { juror: postMerge, placement: aliveBefore });

  const aliveAfter = aliveBefore - 1;
  let transition = '';

  // Merge check
  if (state.phase === 'tribe' && aliveAfter <= state.merge_at) {
    await supabase.from('players').update({ has_immunity: false }).eq('is_eliminated', false);
    await updateGameState({ phase: 'individual', current_round: state.current_round + 1 });
    transition = `\n\n🏝️ **THE MERGE!** ${aliveAfter} players remain. Tribes are dissolved — from here it is every player for themselves. Immunity is now individual.`;
  }
  // Endgame check
  else if (aliveAfter <= 3) {
    const finalists = alivePlayers(await getPlayers()).map((p) => p.discord_id);
    await updateGameState({ phase: 'final', finalist_pool: finalists, current_round: state.current_round + 1 });
    const names = finalists.map((id) => playerMap.get(id)).join(', ');
    transition = `\n\n🔥 **FINAL ${aliveAfter}: ${names}.** The jury will now decide the winner. Jurors, use \`/vote\` for who you want to WIN, then the host runs \`/tribal\`.`;
  } else {
    await updateGameState({ current_round: state.current_round + 1 });
  }

  const eliminatedName = playerMap.get(result.eliminated) || 'Player';
  let message = `🔥 **TRIBAL COUNCIL**\n\n${narration}\n\n**Final Tally:**\n`;
  result.votes.forEach(([id, count]) => {
    const mark = id === result.eliminated ? ' ❌' : '';
    message += `• <@${id}>: ${count} vote${count > 1 ? 's' : ''}${mark}\n`;
  });
  const juryNote = postMerge ? ' You will be the newest member of the jury.' : '';
  message += `\n**${eliminatedName}, the tribe has spoken. 🔦**${juryNote}${transition}`;

  await interaction.editReply(message);
}

// ---------------------------------------------------------------------------
// /standings — show the state of the game
// ---------------------------------------------------------------------------
export async function handleStandings(interaction) {
  const state = await getGameState();
  const players = await getPlayers();

  if (!players || players.length === 0) {
    await interaction.reply('No players registered yet.');
    return;
  }

  if (state && state.phase === 'ended') {
    const winner = players.find((p) => p.discord_id === state.winner_discord_id);
    await interaction.reply(`🏆 **GAME OVER**\n\n**${winner?.username || 'Unknown'}** is the Sole Survivor. 👑`);
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const jurors = players.filter((p) => p.is_eliminated && p.is_juror);
  const eliminated = players.filter((p) => p.is_eliminated && !p.is_juror);

  const phaseLabel =
    state?.phase === 'tribe'
      ? 'Tribe phase'
      : state?.phase === 'individual'
      ? 'Individual (merged)'
      : state?.phase === 'final'
      ? 'Final — jury vote'
      : 'Lobby';

  let message = `**🌴 SURVIVOR STANDINGS**\n_${phaseLabel} · Round ${state?.current_round ?? 1}_\n\n`;
  message += `**Still in the game (${alive.length}):**\n`;

  if (state?.phase === 'tribe') {
    const byTribe = {};
    alive.forEach((p) => {
      const t = p.tribe || 'Unassigned';
      (byTribe[t] ||= []).push(p);
    });
    for (const [tribe, members] of Object.entries(byTribe)) {
      message += `\n__${tribe}__\n`;
      members.forEach((p) => {
        message += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`;
      });
    }
  } else {
    alive.forEach((p) => {
      message += `• ${p.username}${p.has_immunity ? ' 🛡️' : ''}\n`;
    });
  }

  if (jurors.length > 0) {
    message += `\n**Jury (${jurors.length}):**\n`;
    jurors.forEach((p) => (message += `• ${p.username}\n`));
  }
  if (eliminated.length > 0) {
    message += `\n**Eliminated (${eliminated.length}):**\n`;
    eliminated.forEach((p) => (message += `• ${p.username}\n`));
  }

  await interaction.reply(message);
}
