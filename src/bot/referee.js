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

const NARRATION_MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export async function getGameState() {
  const { data } = await supabase
    .from('game_state')
    .select('*')
    .eq('id', 1)
    .single();
  return data;
}

export async function updateGameState(patch) {
  const { error } = await supabase
    .from('game_state')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) console.error('Failed to update game_state:', error);
}

// Flip the game to the individual (post-merge) phase and clear all immunity.
// Called automatically when 12 players remain, and by the manual /merge command.
export async function mergeGameState() {
  await supabase.from('players').update({ has_immunity: false }).eq('is_eliminated', false);
  await updateGameState({ phase: 'individual' });
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function getPlayers() {
  const { data } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: true });
  return data || [];
}

export function alivePlayers(players) {
  return players.filter((p) => !p.is_eliminated);
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assign registered players into the two tribes and reset game state to round 1.
export async function startGame() {
  const state = await getGameState();
  const players = await getPlayers();

  if (players.length < 2) {
    return { error: 'Need at least 2 registered players to start.' };
  }

  const [tribeA, tribeB] = state.tribe_names;
  const shuffled = shuffle(players);
  const half = Math.ceil(shuffled.length / 2);

  for (let i = 0; i < shuffled.length; i++) {
    const tribe = i < half ? tribeA : tribeB;
    await supabase
      .from('players')
      .update({
        tribe,
        is_eliminated: false,
        has_immunity: false,
        is_juror: false,
        placement: null,
      })
      .eq('id', shuffled[i].id);
  }

  await updateGameState({
    phase: 'tribe',
    current_round: 1,
    finalist_pool: null,
    winner_discord_id: null,
  });

  const rosters = {
    [tribeA]: shuffled.slice(0, half).map((p) => p.username),
    [tribeB]: shuffled.slice(half).map((p) => p.username),
  };

  return { rosters, count: shuffled.length };
}

// ---------------------------------------------------------------------------
// Challenge results & immunity
// ---------------------------------------------------------------------------

// Best score per player for a given round.
async function bestScoresForRound(round) {
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .eq('round', round);

  const best = new Map();
  (challenges || []).forEach((c) => {
    const prev = best.get(c.player_id);
    if (!prev || c.score > prev.score) best.set(c.player_id, c);
  });
  return Array.from(best.values());
}

async function clearImmunity() {
  await supabase
    .from('players')
    .update({ has_immunity: false })
    .eq('is_eliminated', false);
}

// Phase-aware immunity resolution. Returns a summary for narration/display.
export async function resolveImmunity() {
  const state = await getGameState();
  const round = state.current_round;
  const scores = await bestScoresForRound(round);

  if (scores.length === 0) return { empty: true };

  await clearImmunity();

  if (state.phase === 'tribe') {
    // Aggregate each tribe's collaborative score (sum of members' best scores).
    const players = await getPlayers();
    const tribeByName = new Map(); // username -> tribe (challenges submit usernames)
    players.forEach((p) => tribeByName.set(p.username, p.tribe));

    const tribeTotals = new Map(); // tribe -> total
    scores.forEach((s) => {
      const tribe = s.tribe || tribeByName.get(s.player_id);
      if (!tribe) return;
      tribeTotals.set(tribe, (tribeTotals.get(tribe) || 0) + s.score);
    });

    const ranked = Array.from(tribeTotals.entries()).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) return { empty: true };

    const winningTribe = ranked[0][0];
    // Grant immunity to every surviving member of the winning tribe.
    await supabase
      .from('players')
      .update({ has_immunity: true })
      .eq('tribe', winningTribe)
      .eq('is_eliminated', false);

    return {
      phase: 'tribe',
      tribeTotals: ranked,
      winningTribe,
    };
  }

  // Individual phase (individual / final): only the top scorer is safe.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  await supabase
    .from('players')
    .update({ has_immunity: true })
    .eq('discord_id', winner.player_id);
  // Fall back to matching by username if discord_id lookup missed nothing changed.
  await supabase
    .from('players')
    .update({ has_immunity: true })
    .eq('username', winner.player_id);

  return {
    phase: 'individual',
    ranked,
    winner: winner.player_id,
  };
}

export async function narrateChallengeResults(summary) {
  let scoreboard;
  if (summary.phase === 'tribe') {
    scoreboard = summary.tribeTotals
      .map(([tribe, total], i) => `${i + 1}. ${tribe} tribe: ${total} points`)
      .join('\n');
  } else {
    scoreboard = summary.ranked
      .map((r, i) => `${i + 1}. ${r.player_id}: ${r.score} points`)
      .join('\n');
  }

  const context =
    summary.phase === 'tribe'
      ? `Two tribes just competed in a team immunity challenge. The winning tribe is safe; the losing tribe must go to Tribal Council.`
      : `Players competed in an individual immunity challenge. Only the winner is safe; everyone else is vulnerable at Tribal Council.`;

  const prompt = `You are Jeff Probst hosting Survivor. ${context}

Scores:
${scoreboard}

Write a dramatic 2-3 sentence narration announcing who won immunity and who is vulnerable at Tribal Council. Be theatrical but concise.`;

  const message = await anthropic.messages.create({
    model: NARRATION_MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

// ---------------------------------------------------------------------------
// Tribal council — elimination votes
// ---------------------------------------------------------------------------

// Tally elimination votes for a round. Ties are broken by random draw.
export async function tallyElimination(round) {
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('round', round)
    .eq('vote_type', 'elimination');

  if (!votes || votes.length === 0) return null;

  const tally = new Map();
  votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) || 0) + 1));

  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0][1];
  const tied = sorted.filter(([, c]) => c === topCount).map(([id]) => id);

  const eliminated =
    tied.length > 1 ? tied[Math.floor(Math.random() * tied.length)] : tied[0];

  return { eliminated, votes: sorted, tie: tied.length > 1, tied };
}

// Eliminate a player. Post-merge eliminees become jurors.
export async function eliminatePlayer(discordId, { juror, placement }) {
  const { error } = await supabase
    .from('players')
    .update({
      is_eliminated: true,
      has_immunity: false,
      is_juror: !!juror,
      placement,
    })
    .eq('discord_id', discordId);
  if (error) console.error('Failed to eliminate player:', error);
}

export async function narrateTribalCouncil(votes, playerMap, extra = {}) {
  const board = votes
    .map(([id, count]) => `${playerMap.get(id) || 'Unknown'}: ${count} vote${count > 1 ? 's' : ''}`)
    .join('\n');

  const tieNote = extra.tie
    ? ` The vote ended in a TIE between ${extra.tied
        .map((id) => playerMap.get(id) || 'Unknown')
        .join(' and ')}, broken by a random draw of rocks.`
    : '';

  const prompt = `You are Jeff Probst at Tribal Council on Survivor. The votes have been tallied:

${board}
${tieNote}

Write a dramatic 2-3 sentence reveal of who was voted out. Build suspense, then deliver the result. Be theatrical but concise.`;

  const message = await anthropic.messages.create({
    model: NARRATION_MODEL,
    max_tokens: 220,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

// ---------------------------------------------------------------------------
// Jury vote — the finale
// ---------------------------------------------------------------------------

// Tally jury votes. Returns a winner, or a tie among the leaders (revote needed).
export async function tallyJury(round) {
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('round', round)
    .eq('vote_type', 'jury');

  if (!votes || votes.length === 0) return null;

  const tally = new Map();
  votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) || 0) + 1));

  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0][1];
  const leaders = sorted.filter(([, c]) => c === topCount).map(([id]) => id);

  if (leaders.length > 1) {
    return { tie: true, tied: leaders, votes: sorted };
  }
  return { tie: false, winner: leaders[0], votes: sorted };
}

export async function crownWinner(discordId) {
  await supabase
    .from('players')
    .update({ placement: 1, is_eliminated: false })
    .eq('discord_id', discordId);
  await updateGameState({ phase: 'ended', winner_discord_id: discordId });
}

export async function narrateWinner(winnerName, voteBoard) {
  const prompt = `You are Jeff Probst reading the final jury votes on Survivor. ${winnerName} has won the game.

Final jury tally:
${voteBoard}

Write a dramatic 2-3 sentence announcement crowning ${winnerName} as the Sole Survivor. Be theatrical but concise.`;

  const message = await anthropic.messages.create({
    model: NARRATION_MODEL,
    max_tokens: 220,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

export { supabase };
