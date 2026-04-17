import type { Metadata } from 'next';
import ComparePageClient from './page.client';

export function generateMetadata({
  params,
}: {
  params: { slugs?: string[] };
}): Metadata {
  const slugs = params.slugs ?? [];
  const title =
    slugs.length >= 2
      ? `${slugs[0]} vs ${slugs[1]} · TweetCity`
      : 'Compare · TweetCity';
  return {
    title,
    description:
      slugs.length >= 2
        ? `Side-by-side comparison of @${slugs[0]} and @${slugs[1]} buildings in TweetCity.`
        : 'Pick two TweetCity buildings to compare side by side.',
  };
}

export default function ComparePage({
  params,
}: {
  params: { slugs?: string[] };
}) {
  return <ComparePageClient slugs={params.slugs ?? []} />;
}
