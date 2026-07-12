import Link from 'next/link';
import { getGameByCode } from '@/lib/games';

export const dynamic = 'force-dynamic';

export default async function GameHomePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGameByCode(code);

  if (!game) {
    return (
      <div className="minimal-page page-enter">
        <div className="minimal-scene" aria-hidden="true" />
        <section className="minimal-shell">
          <header className="minimal-heading minimal-heading--center"><p>Unknown game</p><h1>Code not found.</h1></header>
          <div className="central-pane glass-panel state-pane"><p>Check the code from Discord.</p><Link className="button button--primary button--full" href="/">Try another code</Link></div>
        </section>
      </div>
    );
  }

  const live = game.status === 'live';
  const ended = game.status === 'ended';

  return (
    <div className="minimal-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell" aria-labelledby="game-title">
        <header className="minimal-heading minimal-heading--center">
          <p>{ended ? 'Season complete' : live ? 'Season live' : 'Season setup'}</p>
          <h1 id="game-title">{game.name}</h1>
        </header>
        <div className="central-pane glass-panel state-pane">
          <h2>{ended ? 'The votes are final.' : live ? 'The game is on.' : 'Waiting for the host.'}</h2>
          <p>{ended ? 'Review the final cast.' : live ? 'Challenges and standings are open.' : 'The Challenge tab appears when the season starts.'}</p>
          <div className="state-pane__actions">
            {live && <Link className="button button--primary" href={`/game/${game.code}/challenge`}>Challenges <span aria-hidden="true">→</span></Link>}
            <Link className="button button--ghost" href={`/game/${game.code}/standings`}>Standings</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
