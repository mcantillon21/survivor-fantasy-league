'use client';

import { useEffect, useState } from 'react';
import { getChallenge, type ChallengeDefinition } from '@/lib/challenges/catalog';
import { getSupabaseClient } from '@/lib/supabase';
import { ChallengeRunner } from './components/challenge-runner';

// The camp page. The host picks ONE challenge for the round (stored in
// game_state.active_challenge by the Discord bot's /challenge command), and
// every player runs that same challenge here. Players never see the full list.
export default function CampChallengePage() {
  const [challenge, setChallenge] = useState<ChallengeDefinition | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'none'>('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      // Host testing override: /challenge?c=<slug>
      const override = new URLSearchParams(window.location.search).get('c');
      if (override) {
        const forced = getChallenge(override);
        if (forced && active) { setChallenge(forced); setStatus('ready'); return; }
      }

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('game_state').select('active_challenge').eq('id', 1).single();
          const picked = data?.active_challenge ? getChallenge(data.active_challenge) : undefined;
          if (picked && active) { setChallenge(picked); setStatus('ready'); return; }
        } catch (error) {
          console.error('Failed to read active challenge:', error);
        }
      }
      if (active) setStatus('none');
    })();
    return () => { active = false; };
  }, []);

  if (status === 'loading') {
    return (
      <div className="minimal-page game-page page-enter">
        <div className="minimal-scene" aria-hidden="true" />
        <div className="runner-shell"><p style={{ textAlign: 'center', opacity: 0.7 }}>Loading tonight&apos;s challenge…</p></div>
      </div>
    );
  }

  if (status === 'none' || !challenge) {
    return (
      <div className="minimal-page challenge-entry page-enter">
        <div className="minimal-scene" aria-hidden="true" />
        <section className="runner-shell runner-shell--entry">
          <div className="entry-card glass-panel" style={{ textAlign: 'center' }}>
            <h1>No challenge yet.</h1>
            <p>The host hasn&apos;t started a challenge. Watch <strong>#challenge-lobby</strong> in Discord — when the host runs <strong>/challenge</strong>, come back here and the same challenge will be waiting for everyone.</p>
          </div>
        </section>
      </div>
    );
  }

  return <ChallengeRunner challenge={challenge} forceOfficial />;
}
