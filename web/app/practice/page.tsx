import Link from 'next/link';
import { CHALLENGES } from '@/lib/challenges/catalog';

export const metadata = { title: 'Practice Arena — Survivor Challenges' };

// Public demo gallery: every challenge in the catalog, playable in practice
// mode. No scores are recorded — official runs only happen through a game's
// /game/[code]/challenge page.
export default function PracticePage() {
  return (
    <div className="minimal-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell" aria-labelledby="practice-title">
        <header className="minimal-heading minimal-heading--center">
          <p>Practice arena</p>
          <h1 id="practice-title">Try every challenge.</h1>
        </header>
        <div className="central-pane glass-panel state-pane">
          <p>Practice runs only — nothing here is scored or counts toward a season.</p>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.25rem' }}>
            {CHALLENGES.filter((c) => !c.archived).map((c) => (
              <Link
                key={c.slug}
                className="button button--ghost"
                href={`/practice/${c.slug}`}
                style={{ textAlign: 'left' }}
              >
                <span>{c.number} · <strong>{c.name}</strong></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
