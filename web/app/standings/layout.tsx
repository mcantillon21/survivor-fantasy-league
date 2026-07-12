import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Standings',
  description: 'See who remains, who holds immunity, and who has left the game.',
};

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
