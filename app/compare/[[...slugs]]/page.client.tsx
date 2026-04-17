'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import SubPageShell from '@/components/SubPageShell';
import Hero3D from '@/components/Hero3D';
import BackLink from '@/components/BackLink';
import PixelButton from '@/components/PixelButton';
import FormattedNumber from '@/components/FormattedNumber';
import { useCityStore } from '@/lib/store';
import { THEMES } from '@/lib/themes';
import { fetchUser } from '@/lib/twitterApi';
import { searchUsers } from '@/lib/mockData';
import { generateBuilding } from '@/lib/buildingGenerator';
import { accountAgeYears, formatJoinDate } from '@/lib/format';
import type { TwitterStats } from '@/lib/types';

interface Props {
  slugs: string[];
}

export default function ComparePageClient({ slugs }: Props) {
  if (slugs.length >= 2) {
    return <CompareView a={slugs[0]} b={slugs[1]} />;
  }
  return <ComparePicker initial={slugs[0]} />;
}

// ─── Picker ────────────────────────────────────────────────────────────

function ComparePicker({ initial }: { initial?: string }) {
  const router = useRouter();
  const [a, setA] = useState<string>(initial ?? '');
  const [b, setB] = useState<string>('');
  const [q, setQ] = useState('');

  const suggestions = useMemo<TwitterStats[]>(() => {
    if (!q.trim()) return [];
    return searchUsers(q.trim(), 6);
  }, [q]);

  // Most-recent list from localStorage (best-effort)
  const [mru, setMru] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tweetcity-compare-mru');
      if (raw) setMru(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  const submit = () => {
    const aa = a.replace(/^@/, '').toLowerCase().trim();
    const bb = b.replace(/^@/, '').toLowerCase().trim();
    if (!aa || !bb || aa === bb) return;
    try {
      const next = [aa, bb, ...mru.filter((x) => x !== aa && x !== bb)].slice(0, 6);
      localStorage.setItem('tweetcity-compare-mru', JSON.stringify(next));
    } catch {
      /* noop */
    }
    router.push(`/compare/${aa}/${bb}`);
  };

  return (
    <SubPageShell>
      <BackLink className="mb-4" />
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="text-accent-cyan text-sm uppercase tracking-widest mb-1">
            Compare two buildings
          </div>
          <p className="text-xs text-text-muted">
            Pick any two handles. We&apos;ll render each as its building and
            score the stat duel for you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <HandleInput label="Handle A" value={a} onChange={setA} />
          <HandleInput label="Handle B" value={b} onChange={setB} />
        </div>

        <div>
          <label
            htmlFor="compare-search"
            className="block text-[10px] uppercase tracking-widest text-text-muted mb-1"
          >
            Search
          </label>
          <input
            id="compare-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search @handle…"
            className="w-full px-3 py-2 bg-bg-secondary border-[2px] border-text-muted/40 focus:border-accent-cyan outline-none text-xs text-text-primary"
          />
          {suggestions.length > 0 && (
            <ul className="mt-2 border-[2px] border-text-muted/30 divide-y divide-text-muted/20">
              {suggestions.map((s) => (
                <li key={s.username}>
                  <div className="flex items-center justify-between px-3 py-2 text-[11px]">
                    <span className="text-text-primary truncate">
                      @{s.username}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-text-muted/40 hover:border-accent-cyan hover:text-accent-cyan"
                        onClick={() => setA(s.username)}
                      >
                        → A
                      </button>
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-text-muted/40 hover:border-accent-cyan hover:text-accent-cyan"
                        onClick={() => setB(s.username)}
                      >
                        → B
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {mru.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Recent
            </div>
            <div className="flex flex-wrap gap-2">
              {mru.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() =>
                    a ? (b ? null : setB(u)) : setA(u)
                  }
                  className="px-2 py-1 text-[10px] uppercase tracking-widest border-[2px] border-text-muted/40 hover:border-accent-cyan hover:text-accent-cyan"
                >
                  @{u}
                </button>
              ))}
            </div>
          </div>
        )}

        <PixelButton
          variant="glow"
          onClick={submit}
          disabled={!a || !b || a === b}
          className="w-full"
        >
          Compare
        </PixelButton>
      </div>
    </SubPageShell>
  );
}

function HandleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
        {label}
      </div>
      <div className="flex">
        <span className="px-3 py-2 border-[2px] border-r-0 border-accent-cyan bg-black text-accent-cyan text-xs">
          @
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="handle"
          className="flex-1 px-3 py-2 bg-bg-secondary border-[2px] border-accent-cyan outline-none text-xs text-text-primary"
        />
      </div>
    </label>
  );
}

// ─── Compare view ──────────────────────────────────────────────────────

function CompareView({ a, b }: { a: string; b: string }) {
  const themeId = useCityStore((s) => s.theme);
  const theme = THEMES[themeId];
  const [sa, setSa] = useState<TwitterStats | null | undefined>(undefined);
  const [sb, setSb] = useState<TwitterStats | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchUser(a), fetchUser(b)]).then(([ra, rb]) => {
      if (cancelled) return;
      setSa(ra);
      setSb(rb);
    });
    return () => {
      cancelled = true;
    };
  }, [a, b]);

  if (sa === undefined || sb === undefined) {
    return (
      <SubPageShell>
        <BackLink className="mb-6" />
        <div className="text-center text-text-muted text-xs py-24">
          Loading…
        </div>
      </SubPageShell>
    );
  }

  if (!sa || !sb) {
    return (
      <SubPageShell>
        <BackLink className="mb-6" />
        <div className="text-center py-24 space-y-3">
          <div className="text-accent-cyan text-2xl tracking-widest">
            Missing building
          </div>
          <p className="text-text-muted text-xs">
            {!sa && (
              <>
                <span className="text-accent-cyan">@{a}</span> not found.{' '}
              </>
            )}
            {!sb && (
              <>
                <span className="text-accent-cyan">@{b}</span> not found.
              </>
            )}
          </p>
          <Link
            href="/compare"
            className="inline-block text-[10px] uppercase tracking-widest text-accent-cyan hover:underline"
          >
            ← pick different handles
          </Link>
        </div>
      </SubPageShell>
    );
  }

  const buildingA = generateBuilding(sa, [0, 0, 0], theme);
  const buildingB = generateBuilding(sb, [0, 0, 0], theme);

  return (
    <SubPageShell>
      <BackLink className="mb-4" />
      <h1 className="text-accent-cyan text-xl sm:text-2xl tracking-widest mb-6">
        @{sa.username}{' '}
        <span className="text-text-muted">vs</span>{' '}
        @{sb.username}
      </h1>

      {/* Two hero canvases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <CompareHero stats={sa} building={buildingA} theme={theme} />
        <CompareHero stats={sb} building={buildingB} theme={theme} />
      </div>

      {/* Stat table */}
      <CompareStatTable sa={sa} sb={sb} buildingA={buildingA} buildingB={buildingB} />

      <WhoWins sa={sa} sb={sb} />
    </SubPageShell>
  );
}

function CompareHero({
  stats,
  building,
  theme,
}: {
  stats: TwitterStats;
  building: ReturnType<typeof generateBuilding>;
  theme: (typeof THEMES)[keyof typeof THEMES];
}) {
  const [size, setSize] = useState(420);
  useEffect(() => {
    const resize = () => {
      const w = Math.min(520, (window.innerWidth - 48) / (window.innerWidth >= 768 ? 2 : 1));
      setSize(w);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <Hero3D building={building} theme={theme} size={size} showParticles={false} />
      <Link
        href={`/u/${stats.username}`}
        className="text-accent-cyan text-sm uppercase tracking-widest hover:underline"
      >
        @{stats.username}
      </Link>
    </div>
  );
}

function CompareStatTable({
  sa,
  sb,
  buildingA,
  buildingB,
}: {
  sa: TwitterStats;
  sb: TwitterStats;
  buildingA: ReturnType<typeof generateBuilding>;
  buildingB: ReturnType<typeof generateBuilding>;
}) {
  const rows: Array<{
    label: string;
    a: number;
    b: number;
    format?: (n: number) => React.ReactNode;
    /** When false, higher is better. When true, compare absolute age. */
    bool?: boolean;
  }> = [
    { label: 'Followers', a: sa.followers, b: sb.followers },
    { label: 'Following', a: sa.following, b: sb.following },
    { label: 'Tweets', a: sa.tweetCount, b: sb.tweetCount },
    { label: 'Total likes', a: sa.totalLikes, b: sb.totalLikes },
    {
      label: 'Account age (y)',
      a: accountAgeYears(sa.joinDate),
      b: accountAgeYears(sb.joinDate),
      format: (n) => n.toFixed(1),
    },
    {
      label: 'Avg likes / tweet',
      a: sa.totalLikes / Math.max(1, sa.tweetCount),
      b: sb.totalLikes / Math.max(1, sb.tweetCount),
    },
    { label: 'Tweets · 7d', a: sa.tweetsLast7Days, b: sb.tweetsLast7Days },
    {
      label: 'Verified',
      a: sa.verified ? 1 : 0,
      b: sb.verified ? 1 : 0,
      format: (n) => (n ? 'yes' : 'no'),
      bool: true,
    },
    {
      label: 'Building height',
      a: buildingA.height,
      b: buildingB.height,
      format: (n) => n.toFixed(1),
    },
    {
      label: 'Building width',
      a: buildingA.width,
      b: buildingB.width,
      format: (n) => n.toFixed(2),
    },
  ];

  return (
    <div className="border-[2px] border-accent-cyan/40 mb-6 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-text-muted border-b border-accent-cyan/30">
            <th className="text-left px-3 py-2">Stat</th>
            <th className="text-right px-3 py-2">@{sa.username}</th>
            <th className="text-right px-3 py-2">@{sb.username}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const aWins = r.a > r.b;
            const bWins = r.b > r.a;
            const fmt = r.format ?? ((n: number) => <FormattedNumber value={n} />);
            return (
              <tr
                key={r.label}
                className="border-b border-grid-line/40 last:border-b-0"
              >
                <td className="px-3 py-2 text-text-muted">{r.label}</td>
                <td
                  className={clsx(
                    'px-3 py-2 text-right font-mono',
                    aWins
                      ? 'text-accent-cyan'
                      : bWins
                      ? 'text-text-muted'
                      : 'text-text-primary',
                  )}
                >
                  {fmt(r.a)}
                </td>
                <td
                  className={clsx(
                    'px-3 py-2 text-right font-mono',
                    bWins
                      ? 'text-accent-cyan'
                      : aWins
                      ? 'text-text-muted'
                      : 'text-text-primary',
                  )}
                >
                  {fmt(r.b)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WhoWins({ sa, sb }: { sa: TwitterStats; sb: TwitterStats }) {
  const stats: Array<[number, number]> = [
    [sa.followers, sb.followers],
    [sa.following, sb.following],
    [sa.tweetCount, sb.tweetCount],
    [sa.totalLikes, sb.totalLikes],
    [accountAgeYears(sa.joinDate), accountAgeYears(sb.joinDate)],
    [
      sa.totalLikes / Math.max(1, sa.tweetCount),
      sb.totalLikes / Math.max(1, sb.tweetCount),
    ],
    [sa.tweetsLast7Days, sb.tweetsLast7Days],
    [sa.verified ? 1 : 0, sb.verified ? 1 : 0],
  ];

  let aPoints = 0;
  let bPoints = 0;
  for (const [av, bv] of stats) {
    if (av > bv) aPoints += 1;
    else if (bv > av) bPoints += 1;
  }

  let verdict: string;
  if (aPoints > bPoints) verdict = `@${sa.username} wins`;
  else if (bPoints > aPoints) verdict = `@${sb.username} wins`;
  else verdict = 'Draw';

  const ageA = accountAgeYears(sa.joinDate);
  const ageB = accountAgeYears(sb.joinDate);
  const older = ageA > ageB ? sa : sb;
  const tweeter = sa.tweetsLast7Days > sb.tweetsLast7Days ? sa : sb;
  const tagline =
    older.username === tweeter.username
      ? `@${older.username} is older and tweets more.`
      : `@${older.username} is older but @${tweeter.username} tweets more.`;

  return (
    <div className="border-[2px] border-accent-cyan bg-bg-secondary/60 p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
        Who wins?
      </div>
      <div className="text-accent-cyan text-lg sm:text-2xl tracking-widest">
        {verdict} ({aPoints}–{bPoints})
      </div>
      <div className="text-text-muted text-xs mt-2">
        <span suppressHydrationWarning>{formatJoinDate(sa.joinDate)}</span> vs{' '}
        <span suppressHydrationWarning>{formatJoinDate(sb.joinDate)}</span> —{' '}
        {tagline}
      </div>
    </div>
  );
}
