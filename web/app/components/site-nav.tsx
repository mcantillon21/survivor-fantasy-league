'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { GameStatus } from '@/lib/games';

export function SiteNav() {
  const pathname = usePathname();
  const gameCode = useMemo(() => pathname.match(/^\/game\/([^/]+)/)?.[1] ?? null, [pathname]);
  const [gameState, setGameState] = useState<{ code: string; status: GameStatus | null } | null>(null);
  const gameResolved = gameState?.code === gameCode;
  const status = gameResolved ? gameState?.status ?? null : null;

  useEffect(() => {
    let active = true;
    if (!gameCode) return () => { active = false; };

    const supabase = getSupabaseClient();
    if (!supabase) return () => { active = false; };

    void supabase
      .from('games')
      .select('status')
      .eq('code', gameCode)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setGameState({ code: gameCode, status: (data?.status as GameStatus | undefined) ?? null });
      });

    return () => { active = false; };
  }, [gameCode]);

  if (!gameCode) {
    return (
      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/" className="site-nav__link" aria-current="page">Enter game</Link>
      </nav>
    );
  }

  if (!gameResolved) return <nav className="site-nav" aria-label="Season navigation" />;
  if (!status) {
    return <nav className="site-nav" aria-label="Primary navigation"><Link href="/" className="site-nav__link">Enter game</Link></nav>;
  }

  const base = `/game/${gameCode}`;
  const links = [
    { href: base, label: 'Camp', current: pathname === base },
    ...(status === 'live' ? [{ href: `${base}/challenge`, label: 'Challenge', current: pathname.startsWith(`${base}/challenge`) }] : []),
    { href: `${base}/standings`, label: 'Standings', current: pathname.startsWith(`${base}/standings`) },
  ];

  return (
    <nav className="site-nav" aria-label="Season navigation">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="site-nav__link" aria-current={link.current ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
