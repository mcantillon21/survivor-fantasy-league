import Link from 'next/link';
import { getGameByCode } from '@/lib/games';
import { getSupabaseClient } from '@/lib/supabase';

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
  let challengeOpen = false;
  if (live) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase
        .from('game_state')
        .select('active_challenge')
        .eq('game_id', game.id)
        .maybeSingle();
      challengeOpen = Boolean(data?.active_challenge);
    }
  }

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
          <p>{ended ? 'Review the final cast.' : challengeOpen ? 'Tonight’s challenge is open.' : live ? 'Waiting for the host’s next challenge.' : 'The Challenge tab appears when the season starts.'}</p>
          <div className="state-pane__actions">
            {challengeOpen && <Link className="button button--primary" href={`/game/${game.code}/challenge`}>Challenge <span aria-hidden="true">→</span></Link>}
            <Link className="button button--ghost" href={`/game/${game.code}/standings`}>Standings</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
