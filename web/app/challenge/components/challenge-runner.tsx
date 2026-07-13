'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { ChallengeDefinition } from '@/lib/challenges/catalog';
import { normalizeScore } from '@/lib/challenges/logic';
import type { Game } from '@/lib/games';
import { getSupabaseClient } from '@/lib/supabase';
import { GameEngine } from './game-engine';
import type { EngineResult } from './engine-types';

type RunnerPhase = 'briefing' | 'playing' | 'complete';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'unavailable' | 'error';

interface StoredAttempt {
  startedAt: number;
  completed: boolean;
  score?: number;
}

export function ChallengeRunner({ challenge, game, official, round = 0 }: { challenge: ChallengeDefinition; game: Game; official: boolean; round?: number }) {
  const [phase, setPhase] = useState<RunnerPhase>('briefing');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [persistenceKey, setPersistenceKey] = useState('');
  const [seed, setSeed] = useState('');
  const [score, setScore] = useState(0);
  const [summary, setSummary] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lockedScore, setLockedScore] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (phase !== 'playing' || !startedAt) return;
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  const startChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let player = username.trim();
    if (official && !player) {
      setError('Enter your registered Discord username for the official challenge.');
      return;
    }

    if (official) {
      setIsStarting(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Official play is temporarily unavailable. Try again shortly.');
        setIsStarting(false);
        return;
      }
      const { data: players, error: lookupError } = await supabase
        .from('players')
        .select('username')
        .eq('game_id', game.id)
        .eq('is_eliminated', false);
      if (lookupError) {
        setError('Could not verify your registration. Try again.');
        setIsStarting(false);
        return;
      }
      const registered = players?.find((entry) => entry.username.toLowerCase() === player.toLowerCase());
      if (!registered) {
        setError('That Discord name is not an active player in this game.');
        setIsStarting(false);
        return;
      }
      player = registered.username;
      setUsername(player);
    }

    const playerSeed = official ? player.toLowerCase() : `practice-${Date.now()}`;
    const attemptKey = `sfl:attempt:${game.code}:${round}:${challenge.slug}:${playerSeed}`;
    const progressKey = `${attemptKey}:progress`;
    let attempt: StoredAttempt | null = null;

    if (official) {
      try {
        const stored = window.localStorage.getItem(attemptKey);
        attempt = stored ? JSON.parse(stored) as StoredAttempt : null;
      } catch {
        attempt = null;
      }

      if (attempt?.completed) {
        setLockedScore(attempt.score ?? 0);
        setError('This browser has already submitted an official attempt for that player.');
        setIsStarting(false);
        return;
      }
    } else {
      window.localStorage.removeItem(progressKey);
    }

    const runStartedAt = attempt?.startedAt ?? Date.now();
    if (official && !attempt) {
      window.localStorage.setItem(attemptKey, JSON.stringify({ startedAt: runStartedAt, completed: false }));
    }

    setError('');
    setLockedScore(null);
    setStartedAt(runStartedAt);
    setElapsedSeconds(Math.floor((Date.now() - runStartedAt) / 1000));
    setPersistenceKey(progressKey);
    setSeed(`${challenge.slug}:${playerSeed}`);
    setPhase('playing');
    setIsStarting(false);
  };

  const finishChallenge = useCallback(async (result: EngineResult) => {
    const finalElapsed = Math.floor((Date.now() - startedAt) / 1000);
    const finalScore = normalizeScore(result.rawScore, finalElapsed, challenge.speedWeight);
    setElapsedSeconds(finalElapsed);
    setScore(finalScore);
    setSummary(result.summary);
    setPhase('complete');
    window.localStorage.removeItem(persistenceKey);

    if (!official) return;

    const attemptKey = `sfl:attempt:${game.code}:${round}:${challenge.slug}:${username.trim().toLowerCase()}`;
    setSaveStatus('saving');
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSaveStatus('unavailable');
      return;
    }

    try {
      const { error: saveError } = await supabase.rpc('submit_challenge_attempt', {
        p_game_id: game.id,
        p_challenge_type: challenge.slug,
        p_username: username.trim(),
        p_score: finalScore,
      });
      if (saveError) {
        console.error('Failed to save official challenge score:', saveError.message);
        if (saveError.message.includes('ATTEMPT_ALREADY_SUBMITTED')) {
          window.localStorage.setItem(attemptKey, JSON.stringify({ startedAt, completed: true, score: finalScore }));
          setSaveStatus('duplicate');
        } else {
          setSaveStatus('error');
        }
      } else {
        window.localStorage.setItem(attemptKey, JSON.stringify({ startedAt, completed: true, score: finalScore }));
        setSaveStatus('saved');
      }
    } catch (saveError) {
      console.error('Failed to save official challenge score:', saveError);
      setSaveStatus('error');
    }
  }, [challenge.slug, challenge.speedWeight, game.code, game.id, official, persistenceKey, round, startedAt, username]);

  const restartPractice = () => {
    window.localStorage.removeItem(persistenceKey);
    setPhase('briefing');
    setStartedAt(0);
    setElapsedSeconds(0);
    setPersistenceKey('');
    setSeed('');
    setScore(0);
    setSummary('');
    setSaveStatus('idle');
  };

  if (phase === 'playing') {
    return (
      <div className="minimal-page game-page page-enter" data-challenge={challenge.slug}>
        <div className="minimal-scene" aria-hidden="true" />
        <div className="runner-shell">
          <header className="runner-heading">
            <div>
              <Link href={`/game/${game.code}/challenge`} className="back-link">← Challenges</Link>
              <h1>{challenge.name}</h1>
            </div>
            <div className="run-clock" role="timer" aria-label={`${elapsedSeconds} seconds elapsed`}>
              <strong>{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}</strong>
            </div>
          </header>
          <div className="game-stage glass-panel">
            <GameEngine
              slug={challenge.slug}
              seed={seed}
              persistenceKey={persistenceKey}
              onComplete={finishChallenge}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="minimal-page game-page game-page--complete page-enter">
        <div className="minimal-scene" aria-hidden="true" />
        <section className="runner-shell runner-shell--result">
          <header className="minimal-heading minimal-heading--center">
            <p>{official ? 'Official result' : 'Practice complete'}</p>
            <h1>Complete.</h1>
          </header>
          <div className="challenge-result glass-panel">
            <div className="result-score"><strong>{score}</strong><span>/ 1000</span></div>
            <p className="result-message">{summary}</p>
            <p className="result-time">{Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</p>
            {official && (
              <p className={`save-status save-status--${saveStatus}`} aria-live="polite">
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved' && 'Score saved.'}
                {saveStatus === 'duplicate' && 'Official attempt already submitted.'}
                {saveStatus === 'unavailable' && 'Save unavailable. Screenshot this.'}
                {saveStatus === 'error' && 'Save failed. Screenshot this.'}
              </p>
            )}
            <div className="result-actions">
              <Link href={`/game/${game.code}/challenge`} className="button button--primary">Challenges</Link>
              {!official && <button type="button" className="button button--ghost" onClick={restartPractice}>Again</button>}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="minimal-page challenge-entry page-enter" data-challenge={challenge.slug}>
      <div className="minimal-scene" aria-hidden="true" />
      <section className="runner-shell runner-shell--entry">
        <header className="runner-heading runner-heading--entry">
          <div>
            <Link href={`/game/${game.code}/challenge`} className="back-link">← Challenges</Link>
            <p>{official ? 'Official' : 'Practice'} · {challenge.duration}</p>
            <h1>{challenge.name}</h1>
          </div>
        </header>
        <form className="entry-card glass-panel" onSubmit={startChallenge} noValidate>
          <ol className="challenge-rules">
            {challenge.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
          {official && (
            <div className="field-group">
              <label htmlFor="challenge-username">Discord name</label>
              <input
                id="challenge-username"
                type="text"
                autoComplete="username"
                spellCheck="false"
                placeholder="ParvatiFan"
                value={username}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'challenge-entry-error' : 'challenge-entry-help'}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (error) setError('');
                }}
              />
              <p id="challenge-entry-help" className="field-help">Timer starts on entry.</p>
            </div>
          )}
          {error && <p id="challenge-entry-error" className="field-error" role="alert">{error}{lockedScore !== null ? ` Previous score: ${lockedScore}.` : ''}</p>}
          <button type="submit" className="button button--primary button--full" disabled={isStarting}>
            {isStarting ? 'Checking…' : official ? 'Begin' : 'Practice'} {!isStarting && <span aria-hidden="true">→</span>}
          </button>
        </form>
      </section>
    </div>
  );
}
