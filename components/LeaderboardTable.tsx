'use client';

import { clsx } from 'clsx';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { BuildingProps, Theme, TwitterStats } from '@/lib/types';
import { generateBuilding } from '@/lib/buildingGenerator';
import BuildingThumb from './BuildingThumb';
import FormattedNumber from './FormattedNumber';

export type LeaderboardMetric = 'tallest' | 'widest' | 'brightest' | 'active';

interface LeaderboardTableProps {
  users: TwitterStats[];
  metric: LeaderboardMetric;
  theme: Theme;
}

/**
 * Ranked list used on /leaderboard. Renders the top 100 rows, each
 * with a BuildingThumb (lazily mounted via IntersectionObserver), the
 * primary metric, and three secondary stats.
 *
 * Layouts
 * -------
 *  - Mobile (< sm, 640 px): a stacked card grid — rank · thumb · handle
 *    · metric stacked vertically per row, no horizontal scroll.
 *  - Desktop (≥ sm): the full 7-column grid with followers / tweets /
 *    7-day as secondary stats.
 *
 * Rows are keyboard-navigable: Tab focuses a row, Enter opens it.
 */
export default function LeaderboardTable({
  users,
  metric,
  theme,
}: LeaderboardTableProps) {
  const router = useRouter();

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
    return copy.slice(0, 100);
  }, [users, metric]);

  const buildings = useMemo<BuildingProps[]>(() => {
    return sorted.map((u) => generateBuilding(u, [0, 0, 0], theme));
  }, [sorted, theme]);

  return (
    <>
      {/* ── Desktop ≥ sm: 7-column grid ────────────────────────────── */}
      <div className="hidden sm:block border-[2px] border-accent-cyan/40 bg-black/40">
        <div
          className={clsx(
            'grid items-center gap-2 px-3 py-2 border-b border-accent-cyan/30',
            'text-[10px] uppercase tracking-widest text-text-muted',
            'grid-cols-[40px_90px_1fr_120px_80px_80px_80px]',
          )}
        >
          <div>#</div>
          <div>Building</div>
          <div>Handle</div>
          <div className="text-accent-cyan">{primaryLabel(metric)}</div>
          <div>Followers</div>
          <div>Tweets</div>
          <div>7d</div>
        </div>

        <ul>
          {sorted.map((u, i) => (
            <LeaderboardRowDesktop
              key={u.username}
              rank={i + 1}
              user={u}
              building={buildings[i]}
              theme={theme}
              metric={metric}
              onOpen={() => router.push(`/u/${u.username}`)}
            />
          ))}
        </ul>
      </div>

      {/* ── Mobile < sm: stacked cards ────────────────────────────── */}
      <ul
        className="sm:hidden flex flex-col gap-2"
        aria-label={`${primaryLabel(metric)} leaderboard`}
      >
        {sorted.map((u, i) => (
          <LeaderboardCardMobile
            key={u.username}
            rank={i + 1}
            user={u}
            building={buildings[i]}
            theme={theme}
            metric={metric}
            onOpen={() => router.push(`/u/${u.username}`)}
          />
        ))}
      </ul>
    </>
  );
}

function LeaderboardRowDesktop({
  rank,
  user,
  building,
  theme,
  metric,
  onOpen,
}: {
  rank: number;
  user: TwitterStats;
  building: BuildingProps;
  theme: Theme;
  metric: LeaderboardMetric;
  onOpen: () => void;
}) {
  return (
    <li
      tabIndex={0}
      role="link"
      aria-label={`${rank}. @${user.username}, open profile`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        'grid items-center gap-2 px-3 py-2 cursor-pointer',
        'grid-cols-[40px_90px_1fr_120px_80px_80px_80px]',
        'border-b border-grid-line/40 last:border-b-0',
        'hover:bg-accent-cyan/5 focus:bg-accent-cyan/10 focus:outline-none',
      )}
    >
      <div className="text-text-muted text-xs">{rank}</div>
      <div className="w-[80px] h-[80px]">
        <BuildingThumb building={building} theme={theme} size={80} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-text-primary truncate">
          @{user.username}
          {user.verified && (
            <span className="ml-1 text-accent-amber" aria-hidden>
              ★
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted truncate">
          {user.displayName}
        </div>
      </div>
      <div className="text-accent-cyan text-sm">
        <FormattedNumber value={metricValue(user, metric)} />
      </div>
      <div className="text-text-muted text-xs">
        <FormattedNumber value={user.followers} />
      </div>
      <div className="text-text-muted text-xs">
        <FormattedNumber value={user.tweetCount} />
      </div>
      <div className="text-text-muted text-xs">
        <FormattedNumber value={user.tweetsLast7Days} />
      </div>
    </li>
  );
}

function LeaderboardCardMobile({
  rank,
  user,
  building,
  theme,
  metric,
  onOpen,
}: {
  rank: number;
  user: TwitterStats;
  building: BuildingProps;
  theme: Theme;
  metric: LeaderboardMetric;
  onOpen: () => void;
}) {
  return (
    <li
      tabIndex={0}
      role="link"
      aria-label={`${rank}. @${user.username}, open profile`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 cursor-pointer',
        'border-[2px] border-accent-cyan/40 bg-black/40',
        'hover:bg-accent-cyan/5 focus:bg-accent-cyan/10 focus:outline-none',
      )}
    >
      <div className="w-8 shrink-0 text-text-muted text-xs text-center">
        {rank}
      </div>
      <div className="w-[56px] h-[56px] shrink-0">
        <BuildingThumb building={building} theme={theme} size={56} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-text-primary truncate">
          @{user.username}
          {user.verified && (
            <span className="ml-1 text-accent-amber" aria-hidden>
              ★
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted truncate">
          {user.displayName}
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">
          <FormattedNumber value={user.followers} /> followers ·{' '}
          <FormattedNumber value={user.tweetsLast7Days} /> / 7d
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[9px] uppercase tracking-widest text-text-muted">
          {primaryLabel(metric)}
        </div>
        <div className="text-accent-cyan text-sm">
          <FormattedNumber value={metricValue(user, metric)} />
        </div>
      </div>
    </li>
  );
}

function metricValue(u: TwitterStats, m: LeaderboardMetric): number {
  switch (m) {
    case 'tallest':
      return u.tweetCount;
    case 'widest':
      return u.followers;
    case 'brightest':
      return u.totalLikes / Math.max(1, u.tweetCount);
    case 'active':
      return u.tweetsLast7Days;
  }
}

function primaryLabel(m: LeaderboardMetric): string {
  switch (m) {
    case 'tallest':
      return 'Tweets';
    case 'widest':
      return 'Followers';
    case 'brightest':
      return 'Avg ♥';
    case 'active':
      return 'Tweets 7d';
  }
}
