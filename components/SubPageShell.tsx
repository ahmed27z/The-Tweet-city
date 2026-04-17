'use client';

import TopBar from './TopBar';

/**
 * Sub-page shell: renders the TopBar and a scrollable `<main>`. Used by
 * /u/:handle, /compare, /leaderboard and /explore.
 *
 * The homepage applies its own overflow lock imperatively in
 * <City3D>, so sub-pages don't need to opt-out of a global lock here
 * — the document already scrolls on first paint.
 */
export default function SubPageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="min-h-screen pt-16 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </>
  );
}
