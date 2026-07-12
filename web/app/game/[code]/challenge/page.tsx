import { redirect } from 'next/navigation';
import { ChallengeVault } from '@/app/challenge/components/challenge-vault';
import { getGameByCode } from '@/lib/games';

export const dynamic = 'force-dynamic';

export default async function GameChallengePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);
  if (!game || game.status !== 'live') redirect(`/game/${code}`);

  return <ChallengeVault basePath={`/game/${game.code}/challenge`} officialSlug={game.official_challenge_slug} />;
}
