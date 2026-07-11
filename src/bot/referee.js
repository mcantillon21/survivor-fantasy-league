import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function getChallengeResults() {
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(20);

  if (!challenges || challenges.length === 0) {
    return null;
  }

  // Group by player, take their best score
  const playerScores = new Map();
  challenges.forEach((c) => {
    if (!playerScores.has(c.player_id) || c.score > playerScores.get(c.player_id).score) {
      playerScores.set(c.player_id, c);
    }
  });

  const sorted = Array.from(playerScores.values()).sort((a, b) => b.score - a.score);

  return sorted;
}

export async function narrateChallengeResults(results) {
  const prompt = `You are Jeff Probst hosting Survivor. ${results.length} players just completed an immunity challenge. Here are the scores:

${results.map((r, i) => `${i + 1}. ${r.player_id}: ${r.score} points`).join('\n')}

Write a dramatic 2-3 sentence narration announcing the winner(s) and who's vulnerable at Tribal Council. Be theatrical but concise.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return message.content[0].text;
}

export async function grantImmunity(playerIds) {
  // Clear all immunity first
  await supabase.from('players').update({ has_immunity: false }).neq('id', '00000000-0000-0000-0000-000000000000');

  // Grant to winners
  const { error } = await supabase
    .from('players')
    .update({ has_immunity: true })
    .in('discord_id', playerIds);

  if (error) {
    console.error('Failed to grant immunity:', error);
  }
}

export async function tallyVotes(tribalCouncilId) {
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('tribal_council_id', tribalCouncilId);

  if (!votes || votes.length === 0) {
    return null;
  }

  const tally = new Map();
  votes.forEach((v) => {
    tally.set(v.target_id, (tally.get(v.target_id) || 0) + 1);
  });

  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);

  return {
    eliminated: sorted[0][0], // Discord ID
    votes: sorted,
  };
}

export async function eliminatePlayer(discordId) {
  const { error } = await supabase
    .from('players')
    .update({ is_eliminated: true, has_immunity: false })
    .eq('discord_id', discordId);

  if (error) {
    console.error('Failed to eliminate player:', error);
  }
}

export async function narrateTribalCouncil(votes) {
  const { data: players } = await supabase.from('players').select('*');

  const playerMap = new Map(players.map((p) => [p.discord_id, p.username]));

  const prompt = `You are Jeff Probst at Tribal Council on Survivor. The votes have been tallied:

${votes.map(([id, count]) => `${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}`).join('\n')}

Write a dramatic 2-3 sentence reveal of who was voted out. Build suspense, then deliver the result. Be theatrical but concise.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return message.content[0].text;
}
