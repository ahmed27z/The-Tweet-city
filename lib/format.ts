import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Shared formatters used across profile, compare, leaderboard & explore.
 * Kept intentionally tiny — prefer these over inline number.toFixed() so
 * we only have one place to tweak the thousands-separator style.
 */

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toLocaleString();
}

export function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

export function relativeTime(ts: number): string {
  return formatDistanceToNowStrict(ts, { addSuffix: true })
    .replace('minute', 'min')
    .replace(' seconds', 's')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd');
}

/** Years since an ISO date string. Keeps the compare math consistent. */
export function accountAgeYears(iso: string): number {
  return (
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
}
