import Link from 'next/link';
import { CHALLENGES, OFFICIAL_CHALLENGE_SLUG } from '@/lib/challenges/catalog';

export default function ChallengeVaultPage() {
  const official = CHALLENGES.find((challenge) => challenge.slug === OFFICIAL_CHALLENGE_SLUG)!;
  const practice = CHALLENGES.filter((challenge) => challenge.slug !== OFFICIAL_CHALLENGE_SLUG);

  return (
    <div className="minimal-page vault-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell minimal-shell--wide" aria-labelledby="vault-title">
        <header className="minimal-heading">
          <p>Challenge vault</p>
          <h1 id="vault-title">Choose your game.</h1>
        </header>

        <div className="vault-pane glass-panel">
          <Link href={`/challenge/${official.slug}`} className="vault-official">
            <span className="vault-number">{official.number}</span>
            <span><small>Official</small><strong>{official.name}</strong></span>
            <span className="vault-meta">{official.difficulty} · {official.duration}</span>
            <span aria-hidden="true">→</span>
          </Link>

          <div className="vault-list" aria-label="Practice challenges">
            {practice.map((challenge) => (
              <Link key={challenge.slug} href={`/challenge/${challenge.slug}`} className="vault-row">
                <span className="vault-number">{challenge.number}</span>
                <strong>{challenge.name}</strong>
                <span className="vault-meta">{challenge.category} · {challenge.duration}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
