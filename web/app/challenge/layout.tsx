import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Immunity Challenge',
  description: 'Enter the live Survivor Fantasy League immunity challenge.',
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
