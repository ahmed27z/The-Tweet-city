'use client';

import { clsx } from 'clsx';
import { useId } from 'react';
import type { Achievement } from '@/lib/achievements';

interface Props {
  achievements: Achievement[];
}

/**
 * 3-column grid of achievement chips. Unlocked badges render in full
 * color; locked ones stay greyed with a lock glyph overlay.
 *
 * Each chip is a focusable button so screen-reader users can tab
 * through them; tooltips are exposed via aria-describedby.
 */
export default function BadgeGrid({ achievements }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {achievements.map((a) => (
        <BadgeChip key={a.id} a={a} />
      ))}
    </div>
  );
}

function BadgeChip({ a }: { a: Achievement }) {
  const tipId = useId();
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={`${a.label} — ${a.description}${a.unlocked ? '' : ' (locked)'}`}
        aria-describedby={tipId}
        className={clsx(
          'w-full aspect-square flex flex-col items-center justify-center',
          'border-[2px] text-center text-[9px] uppercase tracking-wider',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan',
          a.unlocked
            ? 'border-accent-cyan/70 bg-bg-secondary text-text-primary hover:bg-accent-cyan/10'
            : 'border-text-muted/30 bg-bg-secondary/40 text-text-muted/60',
        )}
      >
        <span
          className={clsx(
            'text-xl leading-none mb-1 select-none',
            !a.unlocked && 'opacity-40 grayscale',
          )}
          aria-hidden
        >
          {a.unlocked ? a.emoji : '🔒'}
        </span>
        <span className="truncate w-full px-1">{a.label}</span>
      </button>
      {/* Tooltip */}
      <div
        id={tipId}
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute z-10 left-1/2 -translate-x-1/2 top-full mt-1',
          'w-48 px-2 py-1 bg-black border-[2px] border-accent-cyan',
          'text-[10px] text-text-primary leading-snug text-center',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity',
        )}
      >
        {a.description}
      </div>
    </div>
  );
}
