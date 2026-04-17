import type { TwitterStats } from './types';
import type { ClaimedProfile } from './social';
import { accountAgeYears } from './format';

export interface Achievement {
  id: string;
  label: string;
  description: string;
  emoji: string;
  /** Whether the current viewer has unlocked this badge. */
  unlocked: boolean;
}

/**
 * Compute the ordered achievement list for a user. `unlocked=false`
 * rows are still returned so the grid can show locked silhouettes.
 *
 * Order matches the visual priority the product spec calls for
 * (veteran → elder → verified → megaphone → …). We keep the returned
 * shape stable so the UI can memoize cleanly.
 */
export function getAchievements(
  stats: TwitterStats,
  claimed: ClaimedProfile | null,
): Achievement[] {
  const age = accountAgeYears(stats.joinDate);
  const mediaShare = stats.mediaTweets / Math.max(1, stats.tweetCount);

  const all: Achievement[] = [
    {
      id: 'veteran',
      label: 'Veteran',
      description: 'Over 5 years on the platform',
      emoji: '🏛',
      unlocked: age > 5,
    },
    {
      id: 'elder',
      label: 'Elder',
      description: 'Over 10 years on the platform',
      emoji: '🗿',
      unlocked: age > 10,
    },
    {
      id: 'verified',
      label: 'Verified',
      description: 'Has a verified checkmark',
      emoji: '⭐',
      unlocked: stats.verified,
    },
    {
      id: 'megaphone',
      label: 'Megaphone',
      description: '1M+ followers',
      emoji: '📢',
      unlocked: stats.followers >= 1_000_000,
    },
    {
      id: 'influencer',
      label: 'Influencer',
      description: '10K+ followers',
      emoji: '🎯',
      unlocked: stats.followers >= 10_000,
    },
    {
      id: 'prolific',
      label: 'Prolific',
      description: '50K+ tweets',
      emoji: '✍️',
      unlocked: stats.tweetCount >= 50_000,
    },
    {
      id: 'shitposter',
      label: 'Shitposter',
      description: '100K+ tweets',
      emoji: '🔥',
      unlocked: stats.tweetCount >= 100_000,
    },
    {
      id: 'active-weekly',
      label: 'Active Weekly',
      description: '10+ tweets in the last 7 days',
      emoji: '⚡',
      unlocked: stats.tweetsLast7Days >= 10,
    },
    {
      id: 'media-heavy',
      label: 'Media Heavy',
      description: '30%+ of tweets contain media',
      emoji: '🎞',
      unlocked: mediaShare > 0.3,
    },
    {
      id: 'claimed',
      label: 'Claimed',
      description: 'The owner has claimed this building',
      emoji: '🏗',
      unlocked: claimed?.username === stats.username,
    },
  ];

  return all;
}
