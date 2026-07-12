import Link from 'next/link';

export default function Home() {
  return (
    <div className="home-page page-enter">
      <div className="ambient-fire ambient-fire--home" aria-hidden="true" />
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="eyebrow"><span /> Challenge night</p>
          <h1 id="home-title" className="display-title">
            Your game is<br />about to change.
          </h1>
          <p className="hero-copy">
            Step into tonight&apos;s immunity challenge. Ten decisions stand between
            you and safety at Tribal Council.
          </p>
          <div className="hero-actions">
            <Link href="/challenge" className="button button--primary">
              Enter the arena <span aria-hidden="true">→</span>
            </Link>
            <Link href="/standings" className="button button--ghost">
              View standings
            </Link>
          </div>
        </div>

        <aside className="challenge-brief glass-panel" aria-label="Tonight's challenge briefing">
          <div className="challenge-brief__topline">
            <span className="live-indicator"><i /> Arena open</span>
            <span className="challenge-brief__number">01</span>
          </div>
          <div className="challenge-brief__body">
            <p className="section-kicker">Tonight&apos;s challenge</p>
            <h2>Outthink<br />the island.</h2>
            <p>
              Survivor strategy trivia. Accuracy builds your base score. Fast
              answers earn the edge.
            </p>
          </div>
          <dl className="challenge-facts">
            <div><dt>Questions</dt><dd>10</dd></div>
            <div><dt>Clock</dt><dd>60s</dd></div>
            <div><dt>Format</dt><dd>Solo</dd></div>
          </dl>
        </aside>
      </section>

      <section className="field-notes" aria-label="How challenge night works">
        <p className="field-notes__label">Field notes / 001</p>
        <div className="field-notes__rule" />
        <div className="field-notes__item">
          <span>01</span>
          <p>Register in Discord with <strong>/register</strong> before entering.</p>
        </div>
        <div className="field-notes__item">
          <span>02</span>
          <p>Use the same Discord username so your result reaches the right player.</p>
        </div>
        <div className="field-notes__item">
          <span>03</span>
          <p>Once the clock starts, trust your read. Speed and accuracy both count.</p>
        </div>
      </section>
    </div>
  );
}
