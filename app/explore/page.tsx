import type { Metadata } from 'next';
import ExplorePageClient from './page.client';

export const metadata: Metadata = {
  title: 'Explore · TweetCity',
  description:
    'Browse neighbourhoods of the city — most active, most followed, verified, newest, and claimed.',
};

export default function ExplorePage() {
  return <ExplorePageClient />;
}
