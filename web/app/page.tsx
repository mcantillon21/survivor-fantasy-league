import Link from 'next/link';
import { CHALLENGES, OFFICIAL_CHALLENGE_SLUG } from '@/lib/challenges/catalog';

export default function Home() {
  const official = CHALLENGES.find((challenge) => challenge.slug === OFFICIAL_CHALLENGE_SLUG)!;

  return (
    <div className="minimal-page home-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell" aria-labelledby="home-title">
        <header className="minimal-heading minimal-heading--center">
          <p>Challenge night</p>
          <h1 id="home-title">Tonight&apos;s game.</h1>
        </header>

        <div className="central-pane glass-panel">
          <div className="pane-status"><span><i /> Official</span><span>{official.duration}</span></div>
          <h2>{official.name}</h2>
          <p>{official.tagline}</p>
          <Link href={`/challenge/${official.slug}`} className="button button--primary button--full">
            Play now <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="minimal-links">
          <Link href="/challenge">All challenges</Link>
          <Link href="/standings">Standings</Link>
        </div>
      </section>
    </div>
  );
}
