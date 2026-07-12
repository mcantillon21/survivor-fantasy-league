'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { ChallengeDefinition } from '@/lib/challenges/catalog';
import { isOfficialChallenge } from '@/lib/challenges/catalog';
import { normalizeScore } from '@/lib/challenges/logic';
import { getSupabaseClient } from '@/lib/supabase';
import { GameEngine } from './game-engine';
import type { EngineResult } from './engine-types';

type RunnerPhase = 'briefing' | 'playing' | 'complete';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'unavailable' | 'error';

interface StoredAttempt {
  startedAt: number;
  completed: boolean;
  score?: number;
}

export function ChallengeRunner({ challenge, forceOfficial = false }: { challenge: ChallengeDefinition; forceOfficial?: boolean }) {
  const official = forceOfficial || isOfficialChallenge(challenge.slug);
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

  useEffect(() => {
    if (phase !== 'playing' || !startedAt) return;
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  const startChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const player = username.trim();
    if (official && !player) {
      setError('Enter your registered Discord username for the official challenge.');
      return;
    }

    const playerSeed = official ? player.toLowerCase() : `practice-${Date.now()}`;
    const attemptKey = `sfl:attempt:${challenge.slug}:${playerSeed}`;
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

    const attemptKey = `sfl:attempt:${challenge.slug}:${username.trim().toLowerCase()}`;
    window.localStorage.setItem(attemptKey, JSON.stringify({ startedAt, completed: true, score: finalScore }));
    setSaveStatus('saving');
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSaveStatus('unavailable');
      return;
    }

    try {
      // Tag the submission with the player's tribe and the current round so the
      // referee can score per round and, in the tribe phase, sum by tribe.
      let tribe: string | null = null;
      let round = 1;
      try {
        const { data: gs } = await supabase.from('game_state').select('current_round').eq('id', 1).single();
        if (gs?.current_round) round = gs.current_round;
        const { data: playerRow } = await supabase.from('players').select('tribe').eq('username', username.trim()).single();
        if (playerRow?.tribe) tribe = playerRow.tribe;
      } catch (lookupError) {
        console.error('Failed to look up tribe/round:', lookupError);
      }

      const { error: saveError } = await supabase.from('challenges').insert({
        challenge_type: challenge.slug,
        player_id: username.trim(),
        tribe,
        round,
        score: finalScore,
      });
      if (saveError) {
        console.error('Failed to save official challenge score:', saveError.message);
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
      }
    } catch (saveError) {
      console.error('Failed to save official challenge score:', saveError);
      setSaveStatus('error');
    }
  }, [challenge.slug, challenge.speedWeight, official, persistenceKey, startedAt, username]);

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
              <Link href="/challenge" className="back-link">← Challenges</Link>
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
                {saveStatus === 'unavailable' && 'Save unavailable. Screenshot this.'}
                {saveStatus === 'error' && 'Save failed. Screenshot this.'}
              </p>
            )}
            <div className="result-actions">
              <Link href="/challenge" className="button button--primary">Challenges</Link>
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
            <Link href="/challenge" className="back-link">← Challenges</Link>
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
          <button type="submit" className="button button--primary button--full">
            {official ? 'Begin' : 'Practice'} <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </div>
  );
}
