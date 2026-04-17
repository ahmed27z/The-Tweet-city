import Link from 'next/link';

interface ComingSoonProps {
  title: string;
  hint?: string;
}

/**
 * Shared placeholder for the routes that ship in Phase 2 (profile,
 * compare, leaderboard, explore). The page renders so the routing
 * layer is exercisable today without 404s.
 */
export default function ComingSoon({ title, hint }: ComingSoonProps) {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-bg-primary px-6">
      <div className="text-center">
        <div className="text-text-muted text-[11px] tracking-[0.4em] uppercase mb-3">
          {title}
        </div>
        <div className="text-accent-cyan text-3xl md:text-5xl tracking-widest mb-2">
          COMING IN PHASE 2
        </div>
        {hint && (
          <p className="text-text-muted text-xs mb-6 max-w-md mx-auto leading-relaxed">
            {hint}
          </p>
        )}
        <Link
          href="/"
          className="inline-block mt-4 px-3 py-2 border-[2px] border-text-muted/60 hover:border-accent-cyan hover:text-accent-cyan text-xs uppercase tracking-widest text-text-primary transition-colors"
        >
          ← back to the city
        </Link>
      </div>
    </main>
  );
}
