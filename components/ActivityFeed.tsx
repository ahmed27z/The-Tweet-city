'use client';

import { clsx } from 'clsx';
import { useEffect } from 'react';
import { useCityStore, makeMessage } from '@/lib/store';
import { MOCK_USERS } from '@/lib/mockData';
import type { ActivityEvent } from '@/lib/types';

const KIND_PREFIX: Record<ActivityEvent['kind'], string> = {
  joined: '🏗',
  grew: '🔥',
  kudos: '👏',
  verified: '⭐',
  streak: '💥',
};

const KINDS: ActivityEvent['kind'][] = [
  'joined',
  'grew',
  'kudos',
  'verified',
  'streak',
];

function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Right-edge "LIVE" feed. Synthesises a new event every 4–8s by
 * picking a random mock user + kind. Renders the 40 most recent.
 */
export default function ActivityFeed() {
  const activity = useCityStore((s) => s.activity);
  const push = useCityStore((s) => s.pushActivity);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const u = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      const target =
        kind === 'kudos'
          ? MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)].username
          : undefined;
      const ev: ActivityEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        username: u.username,
        target,
        timestamp: Date.now(),
        message: makeMessage(kind, u.username, target),
      };
      push(ev);
      const next = 4000 + Math.random() * 4000;
      window.setTimeout(tick, next);
    };
    const id = window.setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [push]);

  // We render `relTime` from a fixed `now` snapshot to keep React
  // happy. A 1Hz re-tick would also work, but feels noisy.
  const now = Date.now();

  return (
    <aside
      className={clsx(
        'fixed top-16 right-3 z-20',
        'w-[300px] max-h-[70vh] flex flex-col',
        'bg-black/60 backdrop-blur',
        'border-[2px] border-accent-cyan/40',
        'shadow-[2px_2px_0_0_#000]',
      )}
    >
      <div className="px-3 py-2 border-b border-accent-cyan/30 flex items-center gap-2">
        <span className="relative inline-flex w-2 h-2">
          <span className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
          <span className="relative w-2 h-2 bg-green-400 rounded-full" />
        </span>
        <span className="text-[10px] uppercase tracking-widest text-text-primary">
          Live Activity
        </span>
      </div>

      <ul className="overflow-auto py-1">
        {activity.map((ev) => (
          <li
            key={ev.id}
            className="px-3 py-1.5 text-[11px] text-text-primary leading-snug flex items-center justify-between gap-2 border-b border-grid-line/40"
          >
            <span className="truncate">
              <span className="mr-1">{KIND_PREFIX[ev.kind]}</span>
              <span className="text-text-muted">
                {ev.message.replace(`${KIND_PREFIX[ev.kind]} `, '')}
              </span>
            </span>
            <span className="text-[10px] text-text-muted shrink-0">
              {relTime(ev.timestamp, now)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
