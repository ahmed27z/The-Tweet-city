'use client';

import { clsx } from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import SubPageShell from '@/components/SubPageShell';
import BackLink from '@/components/BackLink';
import LeaderboardTable, {
  type LeaderboardMetric,
} from '@/components/LeaderboardTable';
import { useCityStore } from '@/lib/store';
import { THEMES } from '@/lib/themes';
import { MOCK_USERS } from '@/lib/mockData';

const TAB_ORDER: LeaderboardMetric[] = ['tallest', 'widest', 'brightest', 'active'];
const TAB_LABEL: Record<LeaderboardMetric, string> = {
  tallest: 'Tallest',
  widest: 'Widest',
  brightest: 'Brightest',
  active: 'Most Active',
};

export default function LeaderboardPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const themeId = useCityStore((s) => s.theme);
  const theme = THEMES[themeId];

  const metric = useMemo<LeaderboardMetric>(() => {
    const q = params?.get('tab');
    if (q && (TAB_ORDER as string[]).includes(q)) return q as LeaderboardMetric;
    return 'tallest';
  }, [params]);

  const setTab = (t: LeaderboardMetric) => {
    const search = new URLSearchParams(params?.toString() ?? '');
    search.set('tab', t);
    router.replace(`/leaderboard?${search.toString()}`);
  };

  return (
    <SubPageShell>
      <BackLink className="mb-4" />
      <h1 className="text-accent-cyan text-xl sm:text-2xl tracking-widest mb-1">
        Leaderboard
      </h1>
      <p className="text-text-muted text-xs mb-6">
        Who owns the city right now.
      </p>

      <div
        role="tablist"
        aria-label="Leaderboard metrics"
        className="flex flex-wrap gap-2 mb-4"
      >
        {TAB_ORDER.map((t) => {
          const active = t === metric;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 text-[10px] uppercase tracking-widest border-[2px] transition-colors',
                active
                  ? 'border-accent-cyan text-accent-cyan bg-bg-secondary shadow-[2px_2px_0_0_#000]'
                  : 'border-text-muted/40 text-text-muted hover:text-text-primary',
              )}
            >
              {TAB_LABEL[t]}
            </button>
          );
        })}
      </div>

      <LeaderboardTable users={MOCK_USERS} metric={metric} theme={theme} />
    </SubPageShell>
  );
}
