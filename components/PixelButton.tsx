'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'ghost' | 'glow';
  size?: 'sm' | 'md';
}

/**
 * Reusable pixel-art button. 4-px sharp outline + Silkscreen uppercase
 * label + cyan hover glow. Use for nav, theme toggles, and CTAs that
 * should feel native to the city.
 */
export default function PixelButton({
  children,
  className,
  variant = 'default',
  size = 'md',
  ...rest
}: PixelButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        'select-none uppercase tracking-wider transition-colors duration-150 outline-none',
        'border-[2px] border-text-muted/60',
        'shadow-[2px_2px_0_0_#000]',
        'hover:border-accent-cyan hover:text-accent-cyan hover:shadow-[2px_2px_0_0_#00d4ff]',
        'active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        'focus-visible:ring-1 focus-visible:ring-accent-cyan',
        size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs',
        variant === 'ghost' && 'bg-transparent text-text-muted',
        variant === 'default' && 'bg-bg-secondary text-text-primary',
        variant === 'glow' &&
          'bg-bg-secondary text-accent-cyan border-accent-cyan tweet-glow',
        className,
      )}
    >
      {children}
    </button>
  );
}
