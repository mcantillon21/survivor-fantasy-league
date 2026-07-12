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
    <div className="minimal-page standings-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell minimal-shell--wide" aria-labelledby="standings-title">
        <header className="minimal-heading">
          <p>League</p>
          <h1 id="standings-title">Standings.</h1>
        </header>

      {state === 'loading' && (
        <div className="cast-pane glass-panel" aria-label="Loading standings" aria-busy="true">
          <div className="cast-board__heading"><span>Players</span><span>Loading…</span></div>
          <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
        </div>
      )}

      {state === 'error' && (
        <section className="standings-state glass-panel" role="alert">
          <h2>Couldn&apos;t load standings.</h2>
          <p>{errorMessage}</p>
          <button type="button" className="button button--primary" onClick={() => void fetchPlayers()}>
            Try again
          </button>
        </section>
      )}

      {state === 'ready' && players.length === 0 && (
        <section className="standings-state glass-panel">
          <h2>No players yet.</h2>
          <p>Register with <strong>/register</strong> in Discord.</p>
        </section>
      )}

      {state === 'ready' && players.length > 0 && (
        <div className="cast-sections cast-pane glass-panel">
          <section className="cast-board" aria-labelledby="active-cast-title">
            <div className="cast-board__heading">
              <h2 id="active-cast-title">Active</h2>
              <span>{alive.length}</span>
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
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {eliminated.length > 0 && (
            <section className="cast-board cast-board--eliminated" aria-labelledby="eliminated-cast-title">
              <div className="cast-board__heading">
                <h2 id="eliminated-cast-title">Eliminated</h2>
                <span>{eliminated.length}</span>
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
      </section>
    </div>
  );
}
