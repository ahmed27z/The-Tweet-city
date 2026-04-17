import type { Metadata } from 'next';
import { Suspense } from 'react';
import UserPageClient from './page.client';

export function generateMetadata({
  params,
}: {
  params: { username: string };
}): Metadata {
  return {
    title: `@${params.username} · TweetCity`,
    description: `${params.username}'s 3D pixel-art building in TweetCity.`,
  };
}

export default function UserPage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <Suspense fallback={null}>
      <UserPageClient username={params.username} />
    </Suspense>
  );
}
