import Link from 'next/link';
import { clsx } from 'clsx';

interface Props {
  href?: string;
  label?: string;
  className?: string;
}

/**
 * `← back to the city` link used at the top of every sub-page.
 * Keeps visual consistency without needing a full breadcrumb system.
 */
export default function BackLink({
  href = '/',
  label = '← back to the city',
  className,
}: Props) {
  return (
    <Link
      href={href}
      className={clsx(
        'inline-block text-[10px] uppercase tracking-widest',
        'text-text-muted hover:text-accent-cyan transition-colors',
        className,
      )}
    >
      {label}
    </Link>
  );
}
