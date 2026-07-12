import Link from 'next/link';
import { CHALLENGES, getChallenge } from '@/lib/challenges/catalog';

export function ChallengeVault({ basePath, officialSlug }: { basePath: string; officialSlug: string }) {
  const official = getChallenge(officialSlug) ?? CHALLENGES[0];
  const practice = CHALLENGES.filter((challenge) => challenge.slug !== official.slug);

  return (
    <div className="minimal-page vault-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell minimal-shell--wide" aria-labelledby="vault-title">
        <header className="minimal-heading">
          <p>Challenge vault</p>
          <h1 id="vault-title">Choose your game.</h1>
        </header>

        <div className="vault-pane glass-panel">
          <Link href={`${basePath}/${official.slug}`} className="vault-official">
            <span className="vault-number">{official.number}</span>
            <span><small>Official</small><strong>{official.name}</strong></span>
            <span className="vault-meta">{official.difficulty} · {official.duration}</span>
            <span aria-hidden="true">→</span>
          </Link>

          <div className="vault-list" aria-label="Practice challenges">
            {practice.map((challenge) => (
              <Link key={challenge.slug} href={`${basePath}/${challenge.slug}`} className="vault-row">
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
