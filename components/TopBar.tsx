'use client';

import { clsx } from 'clsx';
import PixelButton from './PixelButton';
import SearchBar from './SearchBar';
import ThemeSwitcher from './ThemeSwitcher';

/**
 * Top-of-screen pixel chrome: wordmark on the left, search in the
 * middle, theme switcher + "add my building" CTA on the right.
 */
export default function TopBar() {
  return (
    <header
      className={clsx(
        'fixed top-0 inset-x-0 z-20 h-12',
        'bg-black/60 backdrop-blur',
        'border-b border-accent-cyan/40',
        'flex items-center px-4 gap-4',
      )}
    >
      {/* wordmark — first and last letters cyan */}
      <a
        href="/"
        className="select-none text-base tracking-[0.25em] text-text-primary uppercase shrink-0"
      >
        <span className="text-accent-cyan">T</span>weet{' '}
        <span className="text-accent-cyan">C</span>ity
      </a>

      <div className="flex-1 flex justify-center">
        <SearchBar />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ThemeSwitcher />
        <PixelButton
          variant="glow"
          size="sm"
          onClick={() => {
            // Placeholder — wired up in Task 2 (auth).
            // eslint-disable-next-line no-console
            console.log('[TweetCity] add-my-building clicked');
          }}
        >
          + Add My Building
        </PixelButton>
      </div>
    </header>
  );
}
