import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChallengeRunner } from '../components/challenge-runner';
import { CHALLENGES, getChallenge } from '@/lib/challenges/catalog';

export function generateStaticParams() {
  return CHALLENGES.map((challenge) => ({ slug: challenge.slug }));
}

export async function generateMetadata({ params }: PageProps<'/challenge/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  return challenge
    ? { title: challenge.name, description: challenge.description }
    : { title: 'Challenge not found' };
}

export default async function ChallengeGamePage({ params }: PageProps<'/challenge/[slug]'>) {
  const { slug } = await params;
  const challenge = getChallenge(slug);
  if (!challenge) notFound();
  return <ChallengeRunner challenge={challenge} />;
}
