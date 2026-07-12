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
    content: '🔥 **IMMUNITY CHALLENGE**\n\nHead to the challenge arena:\nhttps://survivor-fantasy-league-pi.vercel.app/challenge\n\nYou have 10 minutes. Winners are safe at Tribal Council.',
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

  if (targetData.has_immunity) {
    await interaction.reply({
      content: `${target.username} has immunity. You cannot vote for them.`,
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('votes').insert({
    voter_id: voter,
    target_id: target.id,
    tribal_council_id: 1,
  });

  if (error) throw error;

  await interaction.reply({
    content: `Your vote for ${target.username} has been cast.`,
    ephemeral: true,
  });
}

export async function handleTribal(interaction) {
  await interaction.deferReply();

  const result = await tallyVotes(1);

  if (!result) {
    await interaction.editReply('No votes have been cast yet.');
    return;
  }

  const narration = await narrateTribalCouncil(result.votes);

  await eliminatePlayer(result.eliminated);

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
