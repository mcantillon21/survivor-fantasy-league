'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface Player {
  id: string;
  discord_id: string;
  username: string;
  tribe: string | null;
  is_eliminated: boolean;
  has_immunity: boolean;
  created_at: string;
}

type StandingsState = 'loading' | 'ready' | 'error';

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<StandingsState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPlayers = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMessage('Standings are not connected yet. Ask the host to configure the league database.');
      setState('error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
      setState('ready');
    } catch (error) {
      console.error('Failed to fetch players:', error);
      setErrorMessage('We could not reach the cast board. Check your connection and try again.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => void fetchPlayers(), 0);
    return () => window.clearTimeout(request);
  }, [fetchPlayers]);

  const alive = players.filter((player) => !player.is_eliminated);
  const eliminated = players.filter((player) => player.is_eliminated);

  return (
    <div className="standings-page page-enter">
      <div className="ambient-fire ambient-fire--standings" aria-hidden="true" />
      <header className="standings-heading">
        <div>
          <p className="eyebrow"><span /> Cast board</p>
          <h1 className="display-title">Still in<br />the game.</h1>
        </div>
        <p>
          Immunity changes the vote. Alliances change everything else. See who
          remains before the tribe heads to council.
        </p>
      </header>

      {state === 'loading' && (
        <section className="cast-board" aria-label="Loading standings" aria-busy="true">
          <div className="cast-board__heading"><span>In the game</span><span>Loading cast…</span></div>
          <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
        </section>
      )}

      {state === 'error' && (
        <section className="standings-state glass-panel" role="alert">
          <p className="section-kicker">Signal lost</p>
          <h2>The cast board went dark.</h2>
          <p>{errorMessage}</p>
          <button type="button" className="button button--primary" onClick={() => void fetchPlayers()}>
            Try standings again
          </button>
        </section>
      )}

      {state === 'ready' && players.length === 0 && (
        <section className="standings-state glass-panel">
          <p className="section-kicker">Camp is quiet</p>
          <h2>No players have arrived.</h2>
          <p>Register with <strong>/register</strong> in Discord to take the first spot on the cast board.</p>
        </section>
      )}

      {state === 'ready' && players.length > 0 && (
        <div className="cast-sections">
          <section className="cast-board" aria-labelledby="active-cast-title">
            <div className="cast-board__heading">
              <h2 id="active-cast-title">In the game</h2>
              <span>{alive.length} remaining</span>
            </div>
            <ol className="cast-list">
              {alive.map((player, index) => (
                <li key={player.id} className="cast-player">
                  <span className="cast-player__number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="cast-player__identity">
                    <strong>{player.username}</strong>
                    <span>{player.tribe || 'Tribe unassigned'}</span>
                  </div>
                  <div className="cast-player__status">
                    {player.has_immunity && <span className="status-badge status-badge--immunity"><i /> Immunity</span>}
                    <span className="status-badge">Active</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {eliminated.length > 0 && (
            <section className="cast-board cast-board--eliminated" aria-labelledby="eliminated-cast-title">
              <div className="cast-board__heading">
                <h2 id="eliminated-cast-title">Torch snuffed</h2>
                <span>{eliminated.length} eliminated</span>
              </div>
              <ol className="cast-list">
                {eliminated.map((player, index) => (
                  <li key={player.id} className="cast-player cast-player--eliminated">
                    <span className="cast-player__number">{String(index + 1).padStart(2, '0')}</span>
                    <div className="cast-player__identity">
                      <strong>{player.username}</strong>
                      <span>{player.tribe || 'Former player'}</span>
                    </div>
                    <span className="status-badge">Eliminated</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
