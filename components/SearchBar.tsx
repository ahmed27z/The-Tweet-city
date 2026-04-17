'use client';

import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { searchUser } from '@/lib/twitterApi';
import type { TwitterStats } from '@/lib/types';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Debounced search box (200 ms) that queries the (mock) Twitter API.
 * Selecting a result navigates to /u/[username]. Keyboard nav covers
 * ↑/↓/Enter/Esc — clicking outside also closes the dropdown.
 */
export default function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [results, setResults] = useState<TwitterStats[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setResults([]);
      setOpen(false);
      return;
    }
    const id = window.setTimeout(async () => {
      const r = await searchUser(v);
      setResults(r);
      setHighlight(0);
      setOpen(true);
    }, 200);
    return () => window.clearTimeout(id);
  }, [value]);

  // Click-outside closes
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const select = useCallback(
    (u: TwitterStats) => {
      setOpen(false);
      setValue('');
      router.push(`/u/${u.username}`);
    },
    [router],
  );

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const list = useMemo(() => results, [results]);

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKey}
        placeholder="search @handle…"
        className={clsx(
          'w-full px-3 py-1.5 bg-bg-secondary/80 border-[2px] border-text-muted/40',
          'text-xs text-text-primary placeholder:text-text-muted/60',
          'focus:outline-none focus:border-accent-cyan focus:shadow-[0_0_6px_#00d4ff]',
          'transition-colors',
        )}
      />
      {open && list.length > 0 && (
        <div
          className={clsx(
            'absolute left-0 right-0 top-full mt-1 z-30',
            'bg-bg-primary/95 backdrop-blur border-[2px] border-accent-cyan',
            'shadow-[2px_2px_0_0_#000] max-h-72 overflow-auto',
          )}
        >
          {list.map((u, i) => (
            <button
              type="button"
              key={u.username}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                // mouseDown so the input blur doesn't close us first
                e.preventDefault();
                select(u);
              }}
              className={clsx(
                'w-full text-left px-3 py-2 flex items-center justify-between gap-3',
                'text-xs',
                i === highlight
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-text-primary hover:bg-bg-secondary',
              )}
            >
              <span className="truncate">
                @{u.username}
                {u.verified && (
                  <span className="ml-1 text-accent-amber">★</span>
                )}
              </span>
              <span className="text-text-muted shrink-0">
                {formatCount(u.followers)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
