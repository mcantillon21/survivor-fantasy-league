'use client';

import { useEffect, useState } from 'react';
import { CHALLENGES, getChallenge, type ChallengeDefinition } from '@/lib/challenges/catalog';
import { ChallengeRunner } from './components/challenge-runner';

// The camp page. Players never see the full list of challenges — one is picked
// for them and run immediately. The pick is locked in sessionStorage so a
// reload can't reshuffle to an easier game. A host can force a specific
// challenge for everyone by sharing a link with ?c=<slug>.
const PICK_KEY = 'sfl:camp:pick';

export default function CampChallengePage() {
  const [challenge, setChallenge] = useState<ChallengeDefinition | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('c');
    if (override) {
      const forced = getChallenge(override);
      if (forced) {
        setChallenge(forced);
        return;
      }
    }

    try {
      const stored = window.sessionStorage.getItem(PICK_KEY);
      const existing = stored ? getChallenge(stored) : undefined;
      if (existing) {
        setChallenge(existing);
        return;
      }
    } catch {
      // sessionStorage unavailable — fall through to a fresh pick
    }

    const picked = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    try {
      window.sessionStorage.setItem(PICK_KEY, picked.slug);
    } catch {
      // ignore persistence failures
    }
    setChallenge(picked);
  }, []);

  if (!challenge) {
    return (
      <div className="minimal-page game-page page-enter">
        <div className="minimal-scene" aria-hidden="true" />
        <div className="runner-shell">
          <p style={{ textAlign: 'center', opacity: 0.7 }}>Drawing tonight&apos;s challenge…</p>
        </div>
      </div>
    );
  }

  return <ChallengeRunner challenge={challenge} forceOfficial />;
}
