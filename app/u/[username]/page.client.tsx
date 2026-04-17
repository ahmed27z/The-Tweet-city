'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SubPageShell from '@/components/SubPageShell';
import Hero3D, { type Hero3DEquippedCosmetics } from '@/components/Hero3D';
import StatsPanel from '@/components/StatsPanel';
import BackLink from '@/components/BackLink';
import PixelButton from '@/components/PixelButton';
import { useCityStore } from '@/lib/store';
import { THEMES } from '@/lib/themes';
import { fetchUser } from '@/lib/twitterApi';
import { generateBuilding } from '@/lib/buildingGenerator';
import {
  referralCodeFor,
  useSocialStore,
  useKudosCount,
} from '@/lib/social';
import type { TwitterStats } from '@/lib/types';

interface Props {
  username: string;
}

/**
 * Profile page body. Kept in a separate file (page.client.tsx) so
 * metadata can live in the server page.tsx entry.
 */
export default function UserPageClient({ username }: Props) {
  const [stats, setStats] = useState<TwitterStats | null | undefined>(undefined);
  const themeId = useCityStore((s) => s.theme);
  const theme = THEMES[themeId];
  const claimed = useSocialStore((s) => s.claimed);
  const addReferral = useSocialStore((s) => s.addReferral);
  const giveKudos = useSocialStore((s) => s.giveKudos);
  const kudosCount = useKudosCount(username);
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    fetchUser(username).then((u) => {
      if (!cancelled) setStats(u);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // ?ref=<code> handling: if a claimed viewer opens a profile via a
  // referral link and the ref-owner isn't them, credit the owner once.
  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (!ref || !claimed) return;
    // The ref code is deterministic from the owning handle; we don't
    // know the handle directly — but we do know the profile being
    // viewed is almost always the owner (the invite URL /u/<owner>?ref=
    // convention). Be defensive: only credit if the ref code matches
    // what we'd compute for `username`.
    const expected = referralCodeFor(username);
    if (ref.toUpperCase() !== expected) return;
    if (claimed.username === username) return; // can't self-refer
    addReferral(username);
    // Also fire a kudos-adjacent signal: both buildings "glow tonight".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, claimed, username, addReferral]);

  const building = useMemo(() => {
    if (!stats) return null;
    return generateBuilding(stats, [0, 0, 0], theme);
  }, [stats, theme]);

  const onClap = () => giveKudos(username);

  // Loading state
  if (stats === undefined) {
    return (
      <SubPageShell>
        <BackLink className="mb-6" />
        <div className="text-center text-text-muted text-xs py-24">
          Loading @{username}…
        </div>
      </SubPageShell>
    );
  }

  // Not-found state
  if (stats === null) {
    return (
      <SubPageShell>
        <BackLink className="mb-6" />
        <div className="text-center py-24 space-y-4">
          <div className="text-accent-cyan text-3xl md:text-5xl tracking-widest">
            No such building
          </div>
          <p className="text-text-muted text-xs leading-relaxed max-w-md mx-auto">
            We couldn&apos;t find <span className="text-accent-cyan">@{username}</span> in
            the mock city. In production we&apos;d hit the real Twitter API
            here.
          </p>
          <div className="flex gap-2 justify-center">
            <PixelButton onClick={() => history.back()}>← Back</PixelButton>
          </div>
        </div>
      </SubPageShell>
    );
  }

  if (!building) return null;

  return (
    <SubPageShell>
      <BackLink className="mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
        {/* Hero canvas */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[560px] aspect-square">
            <HeroSquare
              building={building}
              theme={theme}
              cosmetics={
                claimed?.username === username ? claimed?.equipped : undefined
              }
              onClap={onClap}
              kudosCount={kudosCount}
              claimed={!!claimed}
              isSelf={claimed?.username === username}
            />
          </div>
        </div>

        {/* Stats */}
        <div>
          <StatsPanel stats={stats} building={building} theme={theme} />
        </div>
      </div>
    </SubPageShell>
  );
}

/** Wrapper that sizes Hero3D to its parent box. */
function HeroSquare({
  building,
  theme,
  cosmetics,
  onClap,
  kudosCount,
  claimed,
  isSelf,
}: {
  building: ReturnType<typeof generateBuilding>;
  theme: (typeof THEMES)[keyof typeof THEMES];
  cosmetics: Hero3DEquippedCosmetics | undefined;
  onClap: () => void;
  kudosCount: number;
  claimed: boolean;
  isSelf: boolean;
}) {
  // Fixed 560 visual size on desktop — Hero3D uses a square canvas so
  // we match it. Tailwind's aspect-square keeps the wrapper proportional
  // on mobile (full width → square).
  const [size, setSize] = useState(520);
  useEffect(() => {
    const resize = () => {
      const w = Math.min(560, window.innerWidth - 32);
      setSize(w);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const disabled = !claimed || isSelf;
  const reason = !claimed
    ? 'Claim your building to give kudos'
    : isSelf
    ? 'You can\'t clap your own building'
    : undefined;

  return (
    <Hero3D
      building={building}
      theme={theme}
      size={size}
      cosmetics={cosmetics}
      onKudos={onClap}
      kudosCount={kudosCount}
      clapDisabled={disabled}
      clapDisabledReason={reason}
    />
  );
}

/** Re-implement `referralCodeFor` locally to avoid a needless import
 * churn cycle — the social module uses the same hash. We keep a thin
 * guard here so a manually-typed ?ref=ABC won't incorrectly credit. */
// (exported from lib/social.ts; no local shadow needed)
