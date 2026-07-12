'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_CODE_PATTERN, normalizeGameCode } from '@/lib/games';

export function GameCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeGameCode(code);
    if (!GAME_CODE_PATTERN.test(normalized)) {
      setError('Enter the code from Discord.');
      return;
    }
    router.push(`/game/${normalized}`);
  };

  return (
    <form className="game-code-form" onSubmit={submit} noValidate>
      <label htmlFor="game-code">Game code</label>
      <div>
        <input
          id="game-code"
          value={code}
          onChange={(event) => { setCode(event.target.value); setError(''); }}
          placeholder="tribe-name"
          autoComplete="off"
          spellCheck="false"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'game-code-error' : 'game-code-help'}
        />
        <button className="button button--primary" type="submit">Enter <span aria-hidden="true">→</span></button>
      </div>
      <p id={error ? 'game-code-error' : 'game-code-help'} className={error ? 'field-error' : 'field-help'}>
        {error || 'Your host shares this in Discord.'}
      </p>
    </form>
  );
}
