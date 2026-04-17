'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import PixelButton from './PixelButton';
import SearchBar from './SearchBar';
import ThemeSwitcher from './ThemeSwitcher';
import { useCityStore } from '@/lib/store';
import { useSocialStore } from '@/lib/social';
import FormattedNumber from './FormattedNumber';

/**
 * Top-of-screen pixel chrome: wordmark · nav · search · theme · user.
 *
 * Mobile (< sm): the middle search + nav collapse into a burger.
 *
 * The `+ Add My Building` CTA is replaced by:
 *   - unclaimed viewer → opens the global ClaimModal
 *   - claimed viewer   → a small avatar chip + dropdown with "My
 *                        building", "Customize", "Unclaim", and the
 *                        current kudos balance.
 */
export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const setClaimModalOpen = useCityStore((s) => s.setClaimModalOpen);
  const setClaimModalSeed = useCityStore((s) => s.setClaimModalSeed);
  const claimed = useSocialStore((s) => s.claimed);
  const unclaim = useSocialStore((s) => s.unclaim);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Close user dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!userRef.current) return;
      if (!userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onAdd = () => {
    if (claimed) {
      router.push(`/u/${claimed.username}`);
    } else {
      setClaimModalSeed(null);
      setClaimModalOpen(true);
    }
  };

  return (
    <header
      className={clsx(
        'fixed top-0 inset-x-0 z-30 h-12',
        'bg-black/70 backdrop-blur',
        'border-b border-accent-cyan/40',
        'flex items-center px-4 gap-3',
      )}
    >
      {/* Wordmark — first and last letters cyan */}
      <Link
        href="/"
        className="select-none text-base tracking-[0.25em] text-text-primary uppercase shrink-0"
      >
        <span className="text-accent-cyan">T</span>weet{' '}
        <span className="text-accent-cyan">C</span>ity
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        <NavLink href="/" label="City" pathname={pathname} />
        <NavLink
          href="/leaderboard"
          label="Leaderboard"
          pathname={pathname}
        />
        <NavLink href="/explore" label="Explore" pathname={pathname} />
        <NavLink href="/compare" label="Compare" pathname={pathname} />
      </nav>

      {/* Mobile burger */}
      <button
        type="button"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((m) => !m)}
        className="md:hidden text-xs text-text-primary px-2 py-1 border-[2px] border-text-muted/40"
      >
        ☰
      </button>

      <div className="flex-1 hidden md:flex justify-center">
        <SearchBar />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ThemeSwitcher />

        {/* Add-my-building / claimed chip */}
        {claimed ? (
          <div ref={userRef} className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userOpen}
              aria-label={`Account menu — @${claimed.username}`}
              className={clsx(
                'flex items-center gap-2 px-2 py-1 border-[2px] border-accent-cyan',
                'bg-bg-secondary text-accent-cyan text-[10px] uppercase tracking-widest',
                'hover:bg-accent-cyan/10',
              )}
            >
              <span
                aria-hidden
                className="w-5 h-5 flex items-center justify-center bg-accent-cyan text-black text-xs"
              >
                {claimed.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">
                @{claimed.username}
              </span>
            </button>
            {userOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-full mt-1 w-48 bg-bg-primary border-[2px] border-accent-cyan shadow-[2px_2px_0_0_#000]"
              >
                <MenuItem
                  onClick={() => {
                    setUserOpen(false);
                    router.push(`/u/${claimed.username}`);
                  }}
                >
                  My building
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setUserOpen(false);
                    router.push(`/u/${claimed.username}`);
                  }}
                >
                  Customize
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setUserOpen(false);
                    unclaim();
                  }}
                >
                  Unclaim
                </MenuItem>
                <div className="px-3 py-2 border-t border-text-muted/30 text-[10px] text-text-muted flex items-center justify-between">
                  <span>Balance</span>
                  <span className="text-accent-cyan">
                    <FormattedNumber value={claimed.kudosBalance} /> ✨
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <PixelButton
            variant="glow"
            size="sm"
            onClick={onAdd}
          >
            + Add My Building
          </PixelButton>
        )}
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden absolute top-12 inset-x-0 bg-bg-primary border-b-[2px] border-accent-cyan/40 px-4 py-3 flex flex-col gap-2">
          <SearchBar />
          <NavLink href="/" label="City" pathname={pathname} onClick={() => setMenuOpen(false)} />
          <NavLink
            href="/leaderboard"
            label="Leaderboard"
            pathname={pathname}
            onClick={() => setMenuOpen(false)}
          />
          <NavLink
            href="/explore"
            label="Explore"
            pathname={pathname}
            onClick={() => setMenuOpen(false)}
          />
          <NavLink
            href="/compare"
            label="Compare"
            pathname={pathname}
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  pathname: string | null;
  onClick?: () => void;
}) {
  const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        'px-2 py-1 text-[10px] uppercase tracking-widest transition-colors',
        active
          ? 'text-accent-cyan'
          : 'text-text-muted hover:text-text-primary',
      )}
    >
      {label}
    </Link>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-[11px] text-text-primary hover:bg-accent-cyan/10 hover:text-accent-cyan uppercase tracking-wider"
    >
      {children}
    </button>
  );
}
