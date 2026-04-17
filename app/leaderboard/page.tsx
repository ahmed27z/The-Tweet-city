import type { Metadata } from 'next';
import { Suspense } from 'react';
import LeaderboardPageClient from './page.client';

export const metadata: Metadata = {
  title: 'Leaderboard · TweetCity',
  description:
    'Tallest, widest, brightest and most-active buildings in TweetCity.',
};

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardPageClient />
    </Suspense>
  );
}
