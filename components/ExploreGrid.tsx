'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSocialStore } from '@/lib/social';
import { generateBuilding } from '@/lib/buildingGenerator';
import BuildingThumb from './BuildingThumb';
import FormattedNumber from './FormattedNumber';
import { formatJoinDate } from '@/lib/format';
import type { Theme, TwitterStats } from '@/lib/types';

export type ExploreFilter =
  | 'active'
  | 'followed'
  | 'verified'
  | 'newest'
  | 'oldest'
  | 'claimed';

const FILTER_LABEL: Record<ExploreFilter, string> = {
  active: 'Most Active',
  followed: 'Most Followed',
  verified: 'Verified Only',
  newest: 'Newest',
  oldest: 'Oldest',
  claimed: 'Claimed',
};

const FILTER_ORDER: ExploreFilter[] = [
  'active',
  'followed',
  'verified',
  'newest',
  'oldest',
  'claimed',
];

interface Props {
  users: TwitterStats[];
  theme: Theme;
}

export default function ExploreGrid({ users, theme }: Props) {
  const [filter, setFilter] = useState<ExploreFilter>('active');
  const claimed = useSocialStore((s) => s.claimed);
  const referralsAccepted = useSocialStore((s) => s.referralsAccepted);

  const list = useMemo<TwitterStats[]>(() => {
    const copy = [...users];
    switch (filter) {
      case 'active':
        return copy.sort((a, b) => b.tweetsLast7Days - a.tweetsLast7Days);
      case 'followed':
        return copy.sort((a, b) => b.followers - a.followers);
      case 'verified':
        return copy
          .filter((u) => u.verified)
          .sort((a, b) => b.followers - a.followers);
      case 'newest':
        return copy.sort(
          (a, b) =>
            new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime(),
        );
      case 'oldest':
        return copy.sort(
          (a, b) =>
            new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime(),
        );
      case 'claimed':
        // There's only one claimed profile per browser in this prototype;
        // we surface it + any referred handles as the set of known-claimed.
        return copy.filter(
          (u) =>
            claimed?.username === u.username ||
            referralsAccepted.includes(u.username),
        );
    }
  }, [filter, users, claimed, referralsAccepted]);

  return (
    <div>
      {/* Filter pills */}
      <div
        role="tablist"
        aria-label="Explore filters"
        className="flex flex-wrap gap-2 mb-6"
      >
        {FILTER_ORDER.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 text-[10px] uppercase tracking-widest border-[2px] transition-colors',
                active
                  ? 'border-accent-cyan text-accent-cyan bg-bg-secondary shadow-[2px_2px_0_0_#000]'
                  : 'border-text-muted/40 text-text-muted hover:text-text-primary hover:border-text-muted',
              )}
            >
              {FILTER_LABEL[f]}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="text-center text-text-muted text-xs py-16 border-[2px] border-text-muted/30">
          No buildings match this filter yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((u) => (
            <ExploreCard key={u.username} user={u} theme={theme} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreCard({
  user,
  theme,
  filter,
}: {
  user: TwitterStats;
  theme: Theme;
  filter: ExploreFilter;
}) {
  const [hover, setHover] = useState(false);
  const building = useMemo(
    () => generateBuilding(user, [0, 0, 0], theme),
    [user, theme],
  );

  return (
    <Link
      href={`/u/${user.username}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={clsx(
        'group border-[2px] border-text-muted/30 bg-bg-secondary/60 p-3 flex gap-3 items-start',
        'transition-colors duration-150',
        'hover:border-accent-cyan hover:bg-bg-secondary/90 focus-visible:border-accent-cyan',
        'focus:outline-none',
      )}
    >
      <div className="shrink-0 w-[96px] h-[96px]">
        <BuildingThumb
          building={building}
          theme={theme}
          size={96}
          rotating={hover}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate">
          @{user.username}
          {user.verified && (
            <span className="ml-1 text-accent-amber" aria-hidden>
              ★
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted mb-2 truncate">
          {user.displayName}
        </div>
        <PrimaryMetric user={user} filter={filter} />
        <div className="mt-3 text-[10px] text-accent-cyan group-hover:underline">
          View →
        </div>
      </div>
    </Link>
  );
}

function PrimaryMetric({
  user,
  filter,
}: {
  user: TwitterStats;
  filter: ExploreFilter;
}) {
  switch (filter) {
    case 'active':
      return (
        <Row label="Tweets · 7d" value={<FormattedNumber value={user.tweetsLast7Days} />} />
      );
    case 'followed':
    case 'verified':
      return (
        <Row label="Followers" value={<FormattedNumber value={user.followers} />} />
      );
    case 'newest':
    case 'oldest':
      return <Row label="Joined" value={formatJoinDate(user.joinDate)} />;
    case 'claimed':
      return (
        <Row label="Tweets" value={<FormattedNumber value={user.tweetCount} />} />
      );
  }
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between text-[11px]">
      <span className="text-text-muted uppercase tracking-wider text-[9px]">
        {label}
      </span>
      <span className="text-accent-cyan">{value}</span>
    </div>
  );
}
