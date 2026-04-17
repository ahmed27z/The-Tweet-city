'use client';

import { useEffect, useState } from 'react';
import PixelButton from './PixelButton';
import { useSocialStore } from '@/lib/social';

/**
 * Shown inside the StatsPanel when the viewer is looking at their OWN
 * claimed profile. Builds a shareable invite URL (includes the
 * deterministic referral code) and keeps a running tally of who
 * accepted.
 *
 * Mounting this on the server is safe — we only touch `window` inside
 * an effect, so the SSR snapshot renders a stable placeholder URL.
 */
export default function ReferralCard() {
  const claimed = useSocialStore((s) => s.claimed);
  const referrals = useSocialStore((s) => s.referralsAccepted);
  const [origin, setOrigin] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrigin(window.location.origin);
  }, []);

  if (!claimed) return null;

  const url = `${origin || 'https://tweetcity.example'}/u/${claimed.username}?ref=${claimed.referralCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail on insecure contexts — fall back to selection.
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="border-[2px] border-text-muted/40 bg-bg-secondary/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-accent-cyan mb-2">
        Invite friends
      </div>
      <div className="text-[10px] text-text-muted mb-2 leading-snug">
        Share this URL. When your friend claims, both buildings glow for 24h.
      </div>
      <code className="block text-[10px] text-text-primary break-all bg-black/50 border-[2px] border-text-muted/30 px-2 py-1 mb-2">
        {url}
      </code>
      <div className="flex gap-2">
        <PixelButton size="sm" variant="glow" onClick={copy} className="flex-1">
          {copied ? 'Copied ✓' : 'Copy invite'}
        </PixelButton>
      </div>
      {referrals.length > 0 && (
        <div className="mt-3 pt-2 border-t border-text-muted/20">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Accepted ({referrals.length})
          </div>
          <ul className="space-y-1">
            {referrals.map((u) => (
              <li
                key={u}
                className="text-[11px] text-accent-cyan"
              >
                @{u}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
