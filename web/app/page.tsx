import Link from 'next/link';

export default function Home() {
  return (
    <div className="minimal-page home-page page-enter">
      <div className="minimal-scene" aria-hidden="true" />
      <section className="minimal-shell" aria-labelledby="home-title">
        <header className="minimal-heading minimal-heading--center">
          <p>Challenge night</p>
          <h1 id="home-title">Tonight&apos;s game.</h1>
        </header>

        <div className="central-pane glass-panel">
          <div className="pane-status"><span><i /> Immunity challenge</span><span>Live</span></div>
          <h2>The tribe is waiting.</h2>
          <p>Your challenge is drawn at random when you enter. You won&apos;t know which one until you begin.</p>
          <Link href="/challenge" className="button button--primary button--full">
            Enter the challenge <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="minimal-links">
          <Link href="/standings">Standings</Link>
        </div>
      </section>
    </div>
  );
}
