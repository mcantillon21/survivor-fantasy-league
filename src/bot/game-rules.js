export function tallyVoteRows(votes) {
  if (!votes?.length) return null;

  const counts = new Map();
  for (const vote of votes) counts.set(vote.target_id, (counts.get(vote.target_id) || 0) + 1);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const highest = sorted[0][1];
  const leaders = sorted.filter(([, count]) => count === highest).map(([id]) => id);

  return {
    eliminated: leaders.length === 1 ? leaders[0] : null,
    tie: leaders.length > 1,
    tied: leaders,
    votes: sorted,
  };
}
