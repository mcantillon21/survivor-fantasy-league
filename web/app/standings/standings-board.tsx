'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase';

interface Player {
  id: string;
  discord_id: string;
  username: string;
  tribe: string | null;
  is_eliminated: boolean;
  has_immunity: boolean;
  is_juror: boolean;
  avatar_url: string | null;
  created_at: string;
}

interface GameState {
  phase: string;
  current_round: number;
  winner_discord_id: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  tribe: 'Tribe phase',
  individual: 'Individual · merged',
  final: 'Final · jury vote',
  ended: 'Game over',
};

type StandingsState = 'loading' | 'ready' | 'error';

export function StandingsBoard({ gameId, gameName }: { gameId: string; gameName: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [state, setState] = useState<StandingsState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPlayers = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMessage('Standings are not connected.');
      setState('error');
      return;
    }

    try {
      const [{ data, error }, { data: stateData }] = await Promise.all([
        supabase.from('players').select('*').eq('game_id', gameId).order('created_at', { ascending: true }),
        supabase.from('game_state').select('phase, current_round, winner_discord_id').eq('game_id', gameId).maybeSingle(),
      ]);

      if (error) throw error;
      setPlayers(data || []);
      setGameState(stateData || null);
      setState('ready');
    } catch (error) {
      console.error('Failed to fetch players:', error);
      setErrorMessage('Could not reach this season.');
      setState('error');
    }
  }, [gameId]);

  useEffect(() => {
    const request = window.setTimeout(() => void fetchPlayers(), 0);
    return () => window.clearTimeout(request);
  }, [fetchPlayers]);

  const alive = players.filter((player) => !player.is_eliminated);
  const jurors = players.filter((player) => player.is_eliminated && player.is_juror);
  const eliminated = players.filter((player) => player.is_eliminated && !player.is_juror);
  const winner = gameState?.winner_discord_id ? players.find((p) => p.discord_id === gameState.winner_discord_id) : null;
  const phaseLabel = gameState ? PHASE_LABELS[gameState.phase] ?? gameState.phase : null;
  const avatar = (player: Player) => player.avatar_url ? (
    <Image className="cast-player__avatar" src={player.avatar_url} alt="" width={44} height={44} />
  ) : (
    <span className="cast-player__avatar cast-player__avatar--fallback" aria-hidden="true">
      {player.username.trim().slice(0, 2).toUpperCase()}
    </span>
  );

  return (
    <div className="minimal-page standings-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell minimal-shell--wide" aria-labelledby="standings-title">
        <header className="minimal-heading"><p>{gameName}{phaseLabel ? ` · ${phaseLabel} · Round ${gameState?.current_round}` : ''}</p><h1 id="standings-title">Standings.</h1></header>

        {state === 'ready' && winner && (
          <section className="standings-state glass-panel" style={{ textAlign: 'center' }} aria-label="Winner">
            <p className="section-kicker">👑 Sole Survivor</p><h2>{winner.username} wins.</h2>
          </section>
        )}

        {state === 'loading' && (
          <div className="cast-pane glass-panel" aria-label="Loading standings" aria-busy="true">
            <div className="cast-board__heading"><span>Players</span><span>Loading…</span></div>
            <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
          </div>
        )}

        {state === 'error' && (
          <section className="standings-state glass-panel" role="alert">
            <h2>Couldn&apos;t load standings.</h2><p>{errorMessage}</p>
            <button type="button" className="button button--primary" onClick={() => void fetchPlayers()}>Try again</button>
          </section>
        )}

        {state === 'ready' && players.length === 0 && (
          <section className="standings-state glass-panel"><h2>No players yet.</h2><p>Register with <strong>/register</strong> in Discord.</p></section>
        )}

        {state === 'ready' && players.length > 0 && (
          <div className="cast-sections cast-pane glass-panel">
            <section className="cast-board" aria-labelledby="active-cast-title">
              <div className="cast-board__heading"><h2 id="active-cast-title">Active</h2><span>{alive.length}</span></div>
              <ol className="cast-list">
                {alive.map((player, index) => (
                  <li key={player.id} className="cast-player">
                    <span className="cast-player__number">{String(index + 1).padStart(2, '0')}</span>
                    {avatar(player)}
                    <div className="cast-player__identity"><strong>{player.username}</strong><span>{player.tribe || 'Unassigned'}</span></div>
                    <div className="cast-player__status">{player.has_immunity && <span className="status-badge status-badge--immunity"><i /> Immunity</span>}</div>
                  </li>
                ))}
              </ol>
            </section>

            {jurors.length > 0 && (
              <section className="cast-board cast-board--eliminated" aria-labelledby="jury-cast-title">
                <div className="cast-board__heading"><h2 id="jury-cast-title">Jury</h2><span>{jurors.length}</span></div>
                <ol className="cast-list">
                  {jurors.map((player, index) => (
                    <li key={player.id} className="cast-player cast-player--eliminated">
                      <span className="cast-player__number">{String(index + 1).padStart(2, '0')}</span>
                      {avatar(player)}
                      <div className="cast-player__identity"><strong>{player.username}</strong><span>{player.tribe || 'Juror'}</span></div>
                      <span className="status-badge">Juror</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {eliminated.length > 0 && (
              <section className="cast-board cast-board--eliminated" aria-labelledby="eliminated-cast-title">
                <div className="cast-board__heading"><h2 id="eliminated-cast-title">Pre-merge boots</h2><span>{eliminated.length}</span></div>
                <ol className="cast-list">
                  {eliminated.map((player, index) => (
                    <li key={player.id} className="cast-player cast-player--eliminated">
                      <span className="cast-player__number">{String(index + 1).padStart(2, '0')}</span>
                      {avatar(player)}
                      <div className="cast-player__identity"><strong>{player.username}</strong><span>{player.tribe || 'Former player'}</span></div>
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
