'use client';

import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useKudosCount, useSocialStore } from '@/lib/social';
import FormattedNumber from './FormattedNumber';

interface KudosButtonProps {
  target: string;
  /** Variant for different placements — compact for table rows, default for panels. */
  compact?: boolean;
}

/**
 * 2D pixel button that shows the target's current kudos count. Clicking
 * calls `giveKudos(target)`:
 *
 *   - Disabled if the viewer hasn't claimed yet (tooltip tells them to).
 *   - Rejects a self-clap with a small shake animation.
 *   - Briefly scales the button via CSS on successful click.
 */
export default function KudosButton({ target, compact }: KudosButtonProps) {
  const count = useKudosCount(target);
  const claimed = useSocialStore((s) => s.claimed);
  const giveKudos = useSocialStore((s) => s.giveKudos);

  const [pulse, setPulse] = useState(0);
  const [shake, setShake] = useState(0);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
  }, []);

  const isSelf = claimed?.username === target;
  const unclaimed = !claimed;
  const disabled = unclaimed;

  const onClick = () => {
    if (unclaimed) return;
    if (isSelf) {
      setShake((s) => s + 1);
      return;
    }
    const ok = giveKudos(target);
    if (ok) {
      setPulse((p) => p + 1);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Give kudos to @${target}. Current count ${count}.`}
      title={
        unclaimed
          ? 'Claim your building to give kudos'
          : isSelf
          ? 'Nice try — you can\'t clap your own building'
          : `Give @${target} a kudos`
      }
      className={clsx(
        'select-none uppercase tracking-widest border-[2px]',
        'shadow-[2px_2px_0_0_#000] transition-all duration-150',
        compact
          ? 'px-2 py-1 text-[10px]'
          : 'px-3 py-2 text-xs',
        disabled
          ? 'border-text-muted/40 text-text-muted/60 cursor-not-allowed bg-bg-secondary/50'
          : isSelf
          ? 'border-text-muted/60 text-text-muted bg-bg-secondary'
          : 'border-accent-cyan text-accent-cyan bg-bg-secondary hover:bg-accent-cyan/10 hover:shadow-[2px_2px_0_0_#00d4ff]',
        pulse > 0 && 'animate-[kudos-pulse_0.4s_ease]',
        shake > 0 && 'animate-[shake_0.3s_ease]',
      )}
      // Keyed animation: bumping the data-attr retriggers the keyframes.
      data-pulse={pulse}
      data-shake={shake}
    >
      <span aria-hidden>✨</span>{' '}
      <span className="text-text-primary">
        <FormattedNumber value={count} />
      </span>
    </button>
  );
}
