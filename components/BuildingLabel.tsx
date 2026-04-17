'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { useCityStore } from '@/lib/store';
import { findUser } from '@/lib/mockData';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface BuildingLabelProps {
  /** World position of the hovered building's top */
  position: [number, number, number];
}

/**
 * Floating tooltip rendered above the currently hovered building. Uses
 * drei's <Html> so the card stays a sharp DOM element even though it
 * tracks a 3D point. The card auto-dismisses when the parent stops
 * passing in a hovered username.
 */
export default function BuildingLabel({ position }: BuildingLabelProps) {
  const username = useCityStore((s) => s.hoveredUsername);
  const user = useMemo(
    () => (username ? findUser(username) : undefined),
    [username],
  );
  if (!username || !user) return null;

  return (
    <Html
      position={position}
      center
      distanceFactor={30}
      // Always render in front of the building geometry
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="px-2 py-1 border-[2px] border-accent-cyan bg-black/85 text-text-primary text-[10px] tracking-wider whitespace-nowrap shadow-[2px_2px_0_0_#000]"
        style={{ fontFamily: 'var(--font-silkscreen), monospace' }}
      >
        <div className="text-accent-cyan">@{user.username}</div>
        <div className="text-text-muted">
          {fmt(user.followers)} followers
          {user.verified && <span className="ml-1 text-accent-amber">★</span>}
        </div>
      </div>
    </Html>
  );
}
