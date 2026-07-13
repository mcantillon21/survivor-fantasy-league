import { redirect } from 'next/navigation';
import { getGameByCode } from '@/lib/games';
import { getSupabaseClient } from '@/lib/supabase';
import { getChallenge } from '@/lib/challenges/catalog';
import { ChallengeRunner } from '@/app/challenge/components/challenge-runner';

export const dynamic = 'force-dynamic';

// The camp challenge page. The host picks ONE challenge for the round with the
// Discord /challenge command (stored in game_state.active_challenge); every
// player runs that same challenge here. Players never see the full list.
export default async function GameChallengePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);
  if (!game || game.status !== 'live') redirect(`/game/${code}`);

  let slug: string | null = null;
  let round = 1;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from('game_state')
      .select('active_challenge, current_round')
      .eq('game_id', game.id)
      .maybeSingle();
    if (data?.active_challenge) slug = data.active_challenge;
    if (data?.current_round) round = data.current_round;
  }

  if (!slug) redirect(`/game/${code}`);
  const challenge = getChallenge(slug);
  if (!challenge) redirect(`/game/${code}`);

  return <ChallengeRunner challenge={challenge} game={game} official round={round} />;
}
