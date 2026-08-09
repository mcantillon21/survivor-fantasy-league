import { redirect } from 'next/navigation';
import { getChallenge } from '@/lib/challenges/catalog';
import { ChallengeRunner } from '@/app/challenge/components/challenge-runner';
import type { Game } from '@/lib/games';

// Placeholder game so ChallengeRunner can run outside a real season.
// official={false} means no player lookup and no score writes.
const PRACTICE_GAME: Game = {
  id: 'practice',
  code: 'practice',
  name: 'Practice Arena',
  discord_guild_id: null,
  status: 'live',
  official_challenge_slug: '',
  created_at: '',
  started_at: null,
  ended_at: null,
};

export default async function PracticeChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  if (!challenge) redirect('/practice');
  return <ChallengeRunner challenge={challenge} game={PRACTICE_GAME} official={false} />;
}
