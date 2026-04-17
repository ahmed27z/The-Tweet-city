'use client';

import type { BuildingProps, TwitterStats } from '@/lib/types';
import FormattedNumber from './FormattedNumber';

interface Props {
  building: BuildingProps;
  stats: TwitterStats;
}

/**
 * Pixel-art `WHY THIS LOOKS LIKE THIS` legend — explains the mapping
 * from Twitter stats to 3D geometry. Non-interactive, fully static,
 * reads the same formulas the buildingGenerator actually uses.
 */
export default function StatBreakdown({ building, stats }: Props) {
  const avgLikesPerTweet = stats.totalLikes / Math.max(1, stats.tweetCount);
  const glowPct = Math.round(Math.min(1, avgLikesPerTweet / 1000) * 100);

  return (
    <div className="border-[2px] border-text-muted/40 bg-bg-secondary/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-accent-cyan mb-2">
        Why this looks like this
      </div>
      <ul className="space-y-1.5 text-[11px] font-mono text-text-primary leading-snug">
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">
            Height → max(2, log₁₀(tweets + 1) × 8)
          </span>
          <span>
            ≈{' '}
            <span className="text-accent-cyan">
              {building.height.toFixed(1)}
            </span>
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">
            Width → max(1.2, log₁₀(followers + 1) × 1.1)
          </span>
          <span>
            ≈{' '}
            <span className="text-accent-cyan">
              {building.width.toFixed(2)}
            </span>
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">
            Floors → max(1, ⌈following / 500⌉)
          </span>
          <span>
            ={' '}
            <span className="text-accent-cyan">{building.floors}</span>
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">
            Window glow → min(likes/tweet / 1000, 1)
          </span>
          <span>
            ={' '}
            <span className="text-accent-cyan">{glowPct}%</span>
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">Crown (verified?)</span>
          <span
            className={
              building.hasGoldCrown
                ? 'text-accent-amber'
                : 'text-text-muted'
            }
          >
            {building.hasGoldCrown ? 'yes' : 'no'}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">Weathered (age &gt; 8y?)</span>
          <span
            className={
              building.weathered ? 'text-accent-amber' : 'text-text-muted'
            }
          >
            {building.weathered ? 'yes' : 'no'}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-text-muted">Avg likes / tweet</span>
          <span>
            <FormattedNumber
              value={avgLikesPerTweet}
              className="text-accent-cyan"
            />
          </span>
        </li>
      </ul>
    </div>
  );
}
