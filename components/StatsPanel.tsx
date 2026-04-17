'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PixelButton from './PixelButton';
import KudosButton from './KudosButton';
import StatBreakdown from './StatBreakdown';
import BadgeGrid from './BadgeGrid';
import ShareCard from './ShareCard';
import BuildingShop from './BuildingShop';
import ReferralCard from './ReferralCard';
import FormattedNumber from './FormattedNumber';
import { useSocialStore } from '@/lib/social';
import { useCityStore } from '@/lib/store';
import { getAchievements } from '@/lib/achievements';
import { formatJoinDate, accountAgeYears } from '@/lib/format';
import type { BuildingProps, Theme, TwitterStats } from '@/lib/types';
import { hashString } from '@/lib/buildingGenerator';

interface StatsPanelProps {
  stats: TwitterStats;
  building: BuildingProps;
  theme: Theme;
}

/**
 * Right-hand panel on the profile page. Stacks below the 3D hero on
 * mobile via a parent grid — this component doesn't own its layout.
 */
export default function StatsPanel({ stats, building, theme }: StatsPanelProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const claimed = useSocialStore((s) => s.claimed);
  const setClaimModalOpen = useCityStore((s) => s.setClaimModalOpen);
  const setClaimModalSeed = useCityStore((s) => s.setClaimModalSeed);

  const isMine = claimed?.username === stats.username;
  const achievements = getAchievements(stats, claimed);
  const ageYears = accountAgeYears(stats.joinDate);
  const avgLikes = stats.totalLikes / Math.max(1, stats.tweetCount);

  // Deterministic avatar tint from the handle hash — matches the city's
  // "colorful" building color so the square reads the same in both places.
  const avatarHue = hashString(stats.username) % 360;
  const avatarBg = `hsl(${avatarHue}, 65%, 40%)`;

  const openClaim = () => {
    setClaimModalSeed(stats.username);
    setClaimModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 text-text-primary">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 border-[2px] border-accent-cyan/70 flex items-center justify-center shrink-0"
          style={{ background: avatarBg }}
          aria-hidden
        >
          <span className="text-lg text-white/90">
            {stats.username.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm truncate">
            {stats.displayName}
            {stats.verified && (
              <span
                className="ml-1 text-accent-cyan"
                aria-label="Verified"
                title="Verified"
              >
                ✓
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted truncate">
            @{stats.username}
          </div>
        </div>
      </div>

      {stats.bio && (
        <p className="text-[11px] text-text-muted leading-relaxed">
          {stats.bio}
        </p>
      )}

      {/* ─── Big stat grid ───────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Followers" value={<FormattedNumber value={stats.followers} />} />
        <Stat label="Following" value={<FormattedNumber value={stats.following} />} />
        <Stat label="Tweets" value={<FormattedNumber value={stats.tweetCount} />} />
        <Stat label="Likes" value={<FormattedNumber value={stats.totalLikes} />} />
        <Stat label="Joined" value={formatJoinDate(stats.joinDate)} />
        <Stat label="Age" value={`${ageYears.toFixed(1)} y`} />
        <Stat label="Avg ♥ / tweet" value={<FormattedNumber value={avgLikes} />} />
        <Stat label="Tweets · 7d" value={<FormattedNumber value={stats.tweetsLast7Days} />} />
      </dl>

      {/* ─── Breakdown + Badges ──────────────────────────────────────── */}
      <StatBreakdown building={building} stats={stats} />

      <div>
        <div className="text-[10px] uppercase tracking-widest text-accent-cyan mb-2">
          Achievements
        </div>
        <BadgeGrid achievements={achievements} />
      </div>

      {/* ─── Action row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        <KudosButton target={stats.username} />
        <PixelButton
          onClick={() => router.push(`/compare/${stats.username}`)}
        >
          Compare
        </PixelButton>
        <PixelButton onClick={() => setShareOpen(true)}>Share</PixelButton>
        {!isMine && !claimed && (
          <PixelButton variant="glow" onClick={openClaim}>
            Claim
          </PixelButton>
        )}
        <a
          href={`https://x.com/${stats.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="select-none uppercase tracking-wider outline-none border-[2px] border-text-muted/60 shadow-[2px_2px_0_0_#000] hover:border-accent-cyan hover:text-accent-cyan px-3 py-2 text-xs bg-bg-secondary text-text-primary transition-colors"
        >
          Open on X
        </a>
        {isMine && (
          <PixelButton variant="glow" onClick={() => setShopOpen(true)}>
            Customize building
          </PixelButton>
        )}
      </div>

      {/* Referral card only visible on your own claimed profile. */}
      {isMine && <ReferralCard />}

      {/* Modals ------------------------------------------------------- */}
      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stats={stats}
        building={building}
        theme={theme}
      />
      <BuildingShop open={shopOpen} onClose={() => setShopOpen(false)} />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border-[2px] border-text-muted/30 bg-bg-secondary/60 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd className="text-sm text-accent-cyan mt-1">{value}</dd>
    </div>
  );
}
