'use client';

import { formatNumber } from '@/lib/format';

interface Props {
  value: number;
  /** Shown before the number, e.g. "$" or "+". */
  prefix?: string;
  /** Extra class names on the wrapping span. */
  className?: string;
}

/**
 * Renders a number with the shared `1.2K / 4.5M / 1.3B` formatter,
 * exposing the full value to screen-readers via aria-label and the
 * precise locale-string in the title attribute.
 */
export default function FormattedNumber({ value, prefix, className }: Props) {
  const full = Math.round(value).toLocaleString();
  return (
    <span
      className={className}
      title={full}
      aria-label={`${prefix ?? ''}${full}`}
    >
      {prefix}
      {formatNumber(value)}
    </span>
  );
}
