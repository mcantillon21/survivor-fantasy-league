import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ChallengeRunner } from '@/app/challenge/components/challenge-runner';
import { getChallenge } from '@/lib/challenges/catalog';
import { getGameByCode } from '@/lib/games';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ code: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  return challenge ? { title: challenge.name, description: challenge.description } : { title: 'Challenge not found' };
}

export default async function GameChallengeRunnerPage({ params }: { params: Promise<{ code: string; slug: string }> }) {
  const { code, slug } = await params;
  const [game, challenge] = await Promise.all([getGameByCode(code), Promise.resolve(getChallenge(slug))]);
  if (!challenge) notFound();
  if (!game || game.status !== 'live') redirect(`/game/${code}`);

  return <ChallengeRunner challenge={challenge} game={game} official={slug === game.official_challenge_slug} />;
}
