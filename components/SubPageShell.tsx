'use client';

import { useEffect } from 'react';
import TopBar from './TopBar';

/**
 * Sub-page shell: renders the TopBar and flips <body> to `sub-page`
 * mode while mounted. Pages like /u/:handle, /compare, /leaderboard
 * and /explore are normal scrolling documents, unlike the full-screen
 * city homepage.
 *
 * Keeping this in one place means the TopBar (and its ClaimModal
 * portal) is consistent across all four sub-pages without each page
 * having to plumb its own effects.
 */
export default function SubPageShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('sub-page');
    return () => {
      document.body.classList.remove('sub-page');
    };
  }, []);

  return (
    <>
      <TopBar />
      <main className="min-h-screen pt-16 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </>
  );
}
