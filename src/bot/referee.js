import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './games.js';
import { tallyVoteRows } from './game-rules.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'disabled' });
const NARRATION_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

async function narration(prompt, fallback, maxTokens = 220) {
  if (process.env.ENABLE_AI_NARRATION === 'false' || !process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const message = await anthropic.messages.create({
      model: NARRATION_MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content.find((part) => part.type === 'text')?.text || fallback;
  } catch (error) {
    console.error('AI narration unavailable:', error.message);
    return fallback;
  }
}

export { supabase };

// ---------------------------------------------------------------------------
// Game state (one row per game_id)
// ---------------------------------------------------------------------------
export async function getGameState(gameId) {
  const { data } = await supabase.from('game_state').select('*').eq('game_id', gameId).maybeSingle();
  return data;
}

export async function updateGameState(gameId, patch) {
  const { error } = await supabase
    .from('game_state')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('game_id', gameId);
  if (error) console.error('Failed to update game_state:', error.message);
}

// Flip to the individual (post-merge) phase and clear all immunity.
export async function mergeGameState(gameId) {
  await supabase.from('players').update({ has_immunity: false }).eq('game_id', gameId).eq('is_eliminated', false);
  await updateGameState(gameId, { phase: 'individual' });
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
export async function getPlayers(gameId) {
  const { data } = await supabase.from('players').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
  return data || [];
}
export const alivePlayers = (players) => players.filter((p) => !p.is_eliminated);

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle registered players into two tribes and reset to round 1 / tribe phase.
export async function startGame(gameId) {
  const state = await getGameState(gameId);
  const players = await getPlayers(gameId);
  if (players.length < 6) return { error: 'Need at least 6 registered Discord players to start.' };

  const [tribeA, tribeB] = state?.tribe_names || ['red', 'blue'];
  const shuffled = shuffle(players);
  const half = Math.ceil(shuffled.length / 2);
  const mergeAt = Math.min(state?.merge_at || 12, Math.max(5, Math.floor(players.length * 2 / 3)));

  for (let i = 0; i < shuffled.length; i++) {
    await supabase.from('players').update({
      tribe: i < half ? tribeA : tribeB,
      is_eliminated: false, has_immunity: false, is_juror: false, placement: null,
    }).eq('id', shuffled[i].id);
  }

  await updateGameState(gameId, { phase: 'tribe', current_round: 1, merge_at: mergeAt, active_challenge: null, finalist_pool: null, winner_discord_id: null });

  return {
    count: shuffled.length,
    mergeAt,
    rosters: {
      [tribeA]: shuffled.slice(0, half).map((p) => p.username),
      [tribeB]: shuffled.slice(half).map((p) => p.username),
    },
  };
}

// ---------------------------------------------------------------------------
// Challenge scoring & immunity
// ---------------------------------------------------------------------------
async function bestScoresForRound(gameId, round) {
  const { data } = await supabase.from('challenges').select('*').eq('game_id', gameId).eq('round', round);
  const best = new Map();
  (data || []).forEach((c) => {
    const prev = best.get(c.player_id);
    if (!prev || c.score > prev.score) best.set(c.player_id, c);
  });
  return Array.from(best.values());
}

export async function resolveImmunity(gameId) {
  const state = await getGameState(gameId);
  const scores = await bestScoresForRound(gameId, state.current_round);
  if (scores.length === 0) return { empty: true };

  await supabase.from('players').update({ has_immunity: false }).eq('game_id', gameId).eq('is_eliminated', false);

  if (state.phase === 'tribe') {
    const players = await getPlayers(gameId);
    const tribeByName = new Map(players.map((p) => [p.username, p.tribe]));
    const totals = new Map();
    scores.forEach((s) => {
      const tribe = s.tribe || tribeByName.get(s.player_id);
      if (tribe) totals.set(tribe, (totals.get(tribe) || 0) + s.score);
    });
    const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return { empty: true };
    const winningTribe = ranked[0][0];
    await supabase.from('players').update({ has_immunity: true }).eq('game_id', gameId).eq('tribe', winningTribe).eq('is_eliminated', false);
    return { phase: 'tribe', tribeTotals: ranked, winningTribe };
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  await supabase.from('players').update({ has_immunity: true }).eq('game_id', gameId).eq('username', winner.player_id);
  return { phase: 'individual', ranked, winner: winner.player_id };
}

export async function narrateChallengeResults(summary) {
  let board;
  if (summary.phase === 'tribe') {
    board = summary.tribeTotals.map(([t, n], i) => `${i + 1}. ${t} tribe: ${n} points`).join('\n');
  } else {
    board = summary.ranked.map((r, i) => `${i + 1}. ${r.player_id}: ${r.score} points`).join('\n');
  }
  const context = summary.phase === 'tribe'
    ? 'Two tribes just competed in a team immunity challenge. The winning tribe is safe; the losing tribe goes to Tribal Council.'
    : 'Players competed in an individual immunity challenge. Only the winner is safe.';
  const prompt = `You are Jeff Probst hosting Survivor. ${context}\n\nScores:\n${board}\n\nWrite a dramatic 2-3 sentence narration announcing who won immunity and who is vulnerable. Theatrical but concise.`;
  const winner = summary.phase === 'tribe' ? `Tribe ${summary.winningTribe}` : summary.winner;
  return narration(prompt, `${winner} wins immunity. Everyone else is vulnerable tonight.`, 200);
}

// ---------------------------------------------------------------------------
// Elimination votes. A tie is returned to Discord for a revote; nobody is
// removed by chance.
// ---------------------------------------------------------------------------
export async function tallyElimination(gameId, round) {
  const { data: votes } = await supabase.from('votes').select('*').eq('game_id', gameId).eq('round', round).eq('vote_type', 'elimination');
  return tallyVoteRows(votes);
}

export async function eliminatePlayer(gameId, discordId, { juror, placement }) {
  const { error } = await supabase.from('players')
    .update({ is_eliminated: true, has_immunity: false, is_juror: !!juror, placement })
    .eq('game_id', gameId).eq('discord_id', discordId);
  if (error) console.error('Failed to eliminate player:', error.message);
}

export async function narrateTribalCouncil(votes, playerMap, extra = {}) {
  const board = votes.map(([id, c]) => `${playerMap.get(id) || 'Unknown'}: ${c} vote${c > 1 ? 's' : ''}`).join('\n');
  const tieNote = extra.tie
    ? ` The vote tied between ${extra.tied.map((id) => playerMap.get(id) || 'Unknown').join(' and ')}.`
    : '';
  const prompt = `You are Jeff Probst at Tribal Council. The votes are tallied:\n\n${board}${tieNote}\n\nWrite a dramatic 2-3 sentence reveal of who was voted out. Build suspense, then deliver. Theatrical but concise.`;
  const eliminated = votes[0]?.[0];
  const eliminatedName = playerMap.get(eliminated) || 'The player with the most votes';
  return narration(prompt, `${eliminatedName}, the tribe has spoken.`, 220);
}

// ---------------------------------------------------------------------------
// Jury finale
// ---------------------------------------------------------------------------
export async function tallyJury(gameId, round) {
  const { data: votes } = await supabase.from('votes').select('*').eq('game_id', gameId).eq('round', round).eq('vote_type', 'jury');
  if (!votes || votes.length === 0) return null;
  const tally = new Map();
  votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) || 0) + 1));
  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][1];
  const leaders = sorted.filter(([, c]) => c === top).map(([id]) => id);
  if (leaders.length > 1) return { tie: true, tied: leaders, votes: sorted };
  return { tie: false, winner: leaders[0], votes: sorted };
}

export async function crownWinner(gameId, discordId) {
  await supabase.from('players').update({ placement: 1, is_eliminated: false }).eq('game_id', gameId).eq('discord_id', discordId);
  await updateGameState(gameId, { phase: 'ended', winner_discord_id: discordId });
}

export async function narrateWinner(winnerName, voteBoard) {
  const prompt = `You are Jeff Probst reading the final jury votes. ${winnerName} has won Survivor.\n\nFinal tally:\n${voteBoard}\n\nWrite a dramatic 2-3 sentence announcement crowning ${winnerName} as the Sole Survivor. Theatrical but concise.`;
  return narration(prompt, `${winnerName} has won the jury vote and is the Sole Survivor.`, 220);
}
