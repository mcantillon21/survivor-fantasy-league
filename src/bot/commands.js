import {
  getChallengeResults,
  narrateChallengeResults,
  grantImmunity,
  tallyVotes,
  eliminatePlayer,
  narrateTribalCouncil,
} from './referee.js';
import { getCurrentGame, normalizeGameCode, requireGame, supabase, userCanManageGame } from './games.js';

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://survivor-fantasy-league-pi.vercel.app';

export async function handleRegister(interaction) {
  const game = await requireGame(interaction);
  if (!game) return;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL({ extension: 'webp', size: 128 });

  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('discord_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('players').update({ username, avatar_url: avatarUrl }).eq('id', existing.id);
    await interaction.reply({
      content: `Your profile is current for **${game.name}**.`,
      ephemeral: true,
    });
    return;
  }

  // Auto-assign to tribe with fewer players
  const { data: allPlayers } = await supabase
    .from('players')
    .select('tribe')
    .eq('game_id', game.id)
    .eq('is_eliminated', false);

  const redCount = (allPlayers || []).filter(p => p.tribe === 'red').length;
  const blueCount = (allPlayers || []).filter(p => p.tribe === 'blue').length;
  const assignedTribe = redCount <= blueCount ? 'red' : 'blue';

  const { error } = await supabase.from('players').insert({
    game_id: game.id,
    discord_id: userId,
    username: username,
    avatar_url: avatarUrl,
    tribe: assignedTribe,
    is_eliminated: false,
    has_immunity: false,
  });

  if (error) throw error;

  // Assign Discord tribe role
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId);
  const roleName = assignedTribe === 'red' ? 'Tribe Red' : 'Tribe Blue';
  const tribeRole = guild.roles.cache.find(r => r.name === roleName);
  if (tribeRole) {
    await member.roles.add(tribeRole);
  }

  const tribeEmoji = assignedTribe === 'red' ? '🔴' : '🔵';
  await interaction.reply({
    content: `${tribeEmoji} Welcome to **Tribe ${assignedTribe.charAt(0).toUpperCase() + assignedTribe.slice(1)}**, ${username}.\n\nYou can ONLY see and communicate with your tribemates. The other tribe is invisible to you until the merge.`,
    ephemeral: true,
  });
}

export async function handleChallenge(interaction) {
  const game = await requireGame(interaction, { live: true });
  if (!game) return;
  await interaction.reply({
    content: `🔥 **IMMUNITY CHALLENGE**\n\n${WEB_APP_URL}/game/${game.code}/challenge`,
  });
}

export async function handleResults(interaction) {
  const game = await getCurrentGame(interaction.guildId);
  if (!game || game.status !== 'live') {
    await interaction.reply({ content: 'No live season exists for this server.', ephemeral: true });
    return;
  }
  await interaction.deferReply();

  const results = await getChallengeResults(game.id, game.official_challenge_slug);

  if (!results || results.length === 0) {
    await interaction.editReply('No challenge results yet. Players need to complete the challenge first.');
    return;
  }

  const narration = await narrateChallengeResults(results);

  const top3 = results.slice(0, 3).map((r) => r.player_id);
  await grantImmunity(game.id, top3);

  let message = `🔥 **CHALLENGE RESULTS**\n\n${narration}\n\n**Scores:**\n`;
  results.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
    const immunity = i < 3 ? ' 🛡️' : '';
    message += `${medal} ${r.player_id}: ${r.score} points${immunity}\n`;
  });

  await interaction.editReply(message);
}

export async function handleVote(interaction) {
  const game = await requireGame(interaction, { live: true });
  if (!game) return;
  const voter = interaction.user.id;
  const target = interaction.options.getUser('player');

  const { data: voterData } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('discord_id', voter)
    .single();

  if (!voterData || voterData.is_eliminated) {
    await interaction.reply({
      content: 'You are not in the game or already eliminated.',
      ephemeral: true,
    });
    return;
  }

  const { data: targetData } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('discord_id', target.id)
    .single();

  if (!targetData || targetData.is_eliminated) {
    await interaction.reply({
      content: 'That player is not in the game.',
      ephemeral: true,
    });
    return;
  }

  // Pre-merge: can only vote within your own tribe
  const { data: gameState } = await supabase
    .from('game_state')
    .select('phase')
    .eq('game_id', game.id)
    .maybeSingle();

  const isMerged = gameState?.phase === 'merged';

  if (!isMerged && voterData.tribe !== targetData.tribe) {
    await interaction.reply({
      content: 'You can only vote for players on your own tribe.',
      ephemeral: true,
    });
    return;
  }

  if (targetData.has_immunity) {
    await interaction.reply({
      content: `That player has immunity and cannot be voted out.`,
      ephemeral: true,
    });
    return;
  }

  // Check for existing vote this round (one vote per tribal)
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('game_id', game.id)
    .eq('voter_id', voter)
    .eq('tribal_council_id', voterData.tribe === 'red' && !isMerged ? 'tribal-red' : voterData.tribe === 'blue' && !isMerged ? 'tribal-blue' : 'tribal-merged')
    .single();

  const tribalId = isMerged ? 'tribal-merged' : `tribal-${voterData.tribe}`;

  if (existingVote) {
    // Update existing vote
    await supabase
      .from('votes')
      .update({ target_id: target.id })
      .eq('game_id', game.id)
      .eq('voter_id', voter)
      .eq('tribal_council_id', tribalId);

    await interaction.reply({
      content: `Your vote has been changed. No one will know.`,
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('votes').insert({
    game_id: game.id,
    voter_id: voter,
    target_id: target.id,
    tribal_council_id: tribalId,
  });

  if (error) throw error;

  await interaction.reply({
    content: `Your vote has been cast. It is a secret.`,
    ephemeral: true,
  });
}

export async function handleTribal(interaction) {
  const game = await getCurrentGame(interaction.guildId);
  if (!game || game.status !== 'live') {
    await interaction.reply({ content: 'No live season exists for this server.', ephemeral: true });
    return;
  }
  await interaction.deferReply();

  // Determine which tribal this is based on channel
  const channelName = interaction.channel.name;
  let tribalId;
  if (channelName.includes('red')) {
    tribalId = 'tribal-red';
  } else if (channelName.includes('blue')) {
    tribalId = 'tribal-blue';
  } else {
    tribalId = 'tribal-merged';
  }

  const result = await tallyVotes(game.id, tribalId);

  if (!result) {
    await interaction.editReply('No votes have been cast yet.');
    return;
  }

  const narration = await narrateTribalCouncil(game.id, result.votes);

  await eliminatePlayer(game.id, result.eliminated);

  // Clear votes for this tribal
  await supabase.from('votes').delete().eq('game_id', game.id).eq('tribal_council_id', tribalId);

  const { data: eliminatedPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('discord_id', result.eliminated)
    .single();

  let message = `🔥 **TRIBAL COUNCIL**\n\n${narration}\n\n**Final Tally:**\n`;
  result.votes.forEach(([id, count]) => {
    const eliminated = id === result.eliminated ? ' ❌' : '';
    message += `• <@${id}>: ${count} vote${count > 1 ? 's' : ''}${eliminated}\n`;
  });

  message += `\n**${eliminatedPlayer?.username || 'Player'}, the tribe has spoken. 🔦**`;

  await interaction.editReply(message);
}

export async function handleNewGame(interaction) {
  if (!userCanManageGame(interaction)) {
    await interaction.reply({ content: 'Only a server manager can create a season.', ephemeral: true });
    return;
  }

  const current = await getCurrentGame(interaction.guildId);
  if (current) {
    await interaction.reply({ content: `**${current.name}** is still ${current.status}. End it before creating another season.`, ephemeral: true });
    return;
  }

  const code = normalizeGameCode(interaction.options.getString('code', true));
  const name = interaction.options.getString('name', true).trim();
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(code)) {
    await interaction.reply({ content: 'Use a 3–32 character code with letters, numbers, or hyphens.', ephemeral: true });
    return;
  }

  const { data: game, error } = await supabase.from('games').insert({
    code,
    name,
    discord_guild_id: interaction.guildId,
    status: 'setup',
    official_challenge_slug: 'fire-signal-cipher',
  }).select('*').single();
  if (error) throw error;

  const { error: stateError } = await supabase.from('game_state').insert({
    game_id: game.id,
    phase: 'tribe',
    current_round: 1,
    merge_at: 12,
    roster_size: 18,
    tribe_names: ['red', 'blue'],
  });
  if (stateError) throw stateError;

  await interaction.reply(`🌴 **${game.name}** created.\nCode: **${game.code}**\n${WEB_APP_URL}/game/${game.code}\n\nUse \`/startgame\` when the season begins.`);
}

export async function handleStartGame(interaction) {
  if (!userCanManageGame(interaction)) {
    await interaction.reply({ content: 'Only a server manager can start a season.', ephemeral: true });
    return;
  }
  const game = await getCurrentGame(interaction.guildId);
  if (!game) {
    await interaction.reply({ content: 'Create a season with `/newgame` first.', ephemeral: true });
    return;
  }
  if (game.status === 'live') {
    await interaction.reply({ content: 'This season is already live.', ephemeral: true });
    return;
  }
  const { error } = await supabase.from('games').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', game.id);
  if (error) throw error;
  await interaction.reply(`🔥 **${game.name} is live.**\n${WEB_APP_URL}/game/${game.code}`);
}

export async function handleEndGame(interaction) {
  if (!userCanManageGame(interaction)) {
    await interaction.reply({ content: 'Only a server manager can end a season.', ephemeral: true });
    return;
  }
  const game = await getCurrentGame(interaction.guildId);
  if (!game) {
    await interaction.reply({ content: 'No current season exists.', ephemeral: true });
    return;
  }
  const { error } = await supabase.from('games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', game.id);
  if (error) throw error;
  await interaction.reply(`🏁 **${game.name} has ended.** Final standings remain at ${WEB_APP_URL}/game/${game.code}/standings`);
}

export async function handleStandings(interaction) {
  const game = await getCurrentGame(interaction.guildId, { includeEnded: true });
  if (!game) {
    await interaction.reply({ content: 'No season exists for this server.', ephemeral: true });
    return;
  }

  const { data: initialPlayers } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('created_at', { ascending: true });

  await Promise.allSettled((initialPlayers || []).filter((player) => !player.discord_id.startsWith('bot_')).map(async (player) => {
    const member = await interaction.guild.members.fetch(player.discord_id);
    await supabase.from('players').update({
      username: member.user.username,
      avatar_url: member.user.displayAvatarURL({ extension: 'webp', size: 128 }),
    }).eq('id', player.id);
  }));

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('created_at', { ascending: true });

  if (!players || players.length === 0) {
    await interaction.reply('No players registered yet.');
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const eliminated = players.filter((p) => p.is_eliminated);

  let message = `**🌴 ${game.name.toUpperCase()} STANDINGS**\n\n`;
  message += `**Still in the game (${alive.length}):**\n`;
  alive.forEach((p) => {
    const immunity = p.has_immunity ? ' 🛡️' : '';
    message += `• ${p.username}${immunity}\n`;
  });

  if (eliminated.length > 0) {
    message += `\n**Eliminated (${eliminated.length}):**\n`;
    eliminated.forEach((p) => {
      message += `• ${p.username}\n`;
    });
  }

  await interaction.reply(message);
}
