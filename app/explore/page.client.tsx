'use client';

import Link from 'next/link';
import SubPageShell from '@/components/SubPageShell';
import BackLink from '@/components/BackLink';
import ExploreGrid from '@/components/ExploreGrid';
import { useCityStore } from '@/lib/store';
import { THEMES } from '@/lib/themes';
import { MOCK_USERS } from '@/lib/mockData';

export default function ExplorePageClient() {
  const themeId = useCityStore((s) => s.theme);
  const theme = THEMES[themeId];

  return (
    <SubPageShell>
      <BackLink className="mb-4" />
      <h1 className="text-accent-cyan text-xl sm:text-2xl tracking-widest mb-1">
        Explore
      </h1>
      <p className="text-text-muted text-xs mb-6">
        Neighbourhoods of the city, filtered by vibe.
      </p>

      <ExploreGrid users={MOCK_USERS} theme={theme} />

      <footer className="mt-16 text-center">
        <Link
          href="/"
          className="inline-block px-4 py-2 text-[10px] uppercase tracking-widest border-[2px] border-accent-cyan text-accent-cyan bg-bg-secondary hover:bg-accent-cyan/10 transition-colors"
        >
          Fly back to the city →
        </Link>
      </footer>
    </SubPageShell>
  );
}
