import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import {
  getChallengeResults,
  narrateChallengeResults,
  grantImmunity,
  tallyVotes,
  eliminatePlayer,
  narrateTribalCouncil,
} from './referee.js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

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

  // Auto-assign to tribe with fewer players
  const { data: allPlayers } = await supabase
    .from('players')
    .select('tribe')
    .eq('is_eliminated', false);

  const redCount = (allPlayers || []).filter(p => p.tribe === 'red').length;
  const blueCount = (allPlayers || []).filter(p => p.tribe === 'blue').length;
  const assignedTribe = redCount <= blueCount ? 'red' : 'blue';

  const { error } = await supabase.from('players').insert({
    discord_id: userId,
    username: username,
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
  await interaction.reply({
    content: '🔥 **IMMUNITY CHALLENGE**\n\nHead to the challenge arena:\nhttps://web-five-psi-52.vercel.app/challenge\n\nYou have 10 minutes. Winners are safe at Tribal Council.',
  });
}

export async function handleResults(interaction) {
  await interaction.deferReply();

  const results = await getChallengeResults();

  if (!results || results.length === 0) {
    await interaction.editReply('No challenge results yet. Players need to complete the challenge first.');
    return;
  }

  const narration = await narrateChallengeResults(results);

  const top3 = results.slice(0, 3).map((r) => r.player_id);
  await grantImmunity(top3);

  let message = `🔥 **CHALLENGE RESULTS**\n\n${narration}\n\n**Scores:**\n`;
  results.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
    const immunity = i < 3 ? ' 🛡️' : '';
    message += `${medal} ${r.player_id}: ${r.score} points${immunity}\n`;
  });

  await interaction.editReply(message);
}

export async function handleVote(interaction) {
  const voter = interaction.user.id;
  const target = interaction.options.getUser('player');

  const { data: voterData } = await supabase
    .from('players')
    .select('*')
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
    .select('merged')
    .single();

  const isMerged = gameState?.merged || false;

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
    .eq('voter_id', voter)
    .eq('tribal_council_id', voterData.tribe === 'red' && !isMerged ? 'tribal-red' : voterData.tribe === 'blue' && !isMerged ? 'tribal-blue' : 'tribal-merged')
    .single();

  const tribalId = isMerged ? 'tribal-merged' : `tribal-${voterData.tribe}`;

  if (existingVote) {
    // Update existing vote
    await supabase
      .from('votes')
      .update({ target_id: target.id })
      .eq('voter_id', voter)
      .eq('tribal_council_id', tribalId);

    await interaction.reply({
      content: `Your vote has been changed. No one will know.`,
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('votes').insert({
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

  const result = await tallyVotes(tribalId);

  if (!result) {
    await interaction.editReply('No votes have been cast yet.');
    return;
  }

  const narration = await narrateTribalCouncil(result.votes);

  await eliminatePlayer(result.eliminated);

  // Clear votes for this tribal
  await supabase.from('votes').delete().eq('tribal_council_id', tribalId);

  const { data: eliminatedPlayer } = await supabase
    .from('players')
    .select('*')
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

export async function handleNewSeason(interaction) {
  await interaction.deferReply();

  // Reset all players
  await supabase.from('votes').delete().neq('voter_id', '');
  await supabase.from('challenges').delete().neq('player_id', '');
  await supabase.from('players').delete().neq('discord_id', '');
  await supabase.from('game_state').upsert({ id: 'current', merged: false, season: 1 });

  // Strip tribe roles from all members
  const guild = interaction.guild;
  const tribeRedRole = guild.roles.cache.find(r => r.name === 'Tribe Red');
  const tribeBlueRole = guild.roles.cache.find(r => r.name === 'Tribe Blue');

  if (tribeRedRole || tribeBlueRole) {
    const members = await guild.members.fetch();
    for (const [, member] of members) {
      if (tribeRedRole && member.roles.cache.has(tribeRedRole.id)) {
        await member.roles.remove(tribeRedRole);
      }
      if (tribeBlueRole && member.roles.cache.has(tribeBlueRole.id)) {
        await member.roles.remove(tribeBlueRole);
      }
    }
  }

  await interaction.editReply(
    '🌅 **NEW SEASON**\n\n' +
    'All players, votes, and challenges have been reset.\n' +
    'Tribe roles have been stripped.\n\n' +
    'Use `/register` to join the new season.'
  );
}

export async function handleStandings(interaction) {
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: true });

  if (!players || players.length === 0) {
    await interaction.reply('No players registered yet.');
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const eliminated = players.filter((p) => p.is_eliminated);

  let message = '**🌴 SURVIVOR STANDINGS**\n\n';
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
