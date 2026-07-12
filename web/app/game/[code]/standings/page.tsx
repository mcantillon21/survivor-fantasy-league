import { redirect } from 'next/navigation';
import { StandingsBoard } from '@/app/standings/standings-board';
import { getGameByCode } from '@/lib/games';

export const dynamic = 'force-dynamic';

export default async function GameStandingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);
  if (!game) redirect('/');
  return <StandingsBoard gameId={game.id} gameName={game.name} />;
}
