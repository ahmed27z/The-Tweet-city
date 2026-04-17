'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
  /** How much of the target needs to intersect before we call it "in view". */
  threshold?: number;
  /** If true, disconnect after the first time it enters view — useful for lazy mounts. */
  once?: boolean;
  /** Root margin to pre-mount just before scroll arrives. */
  rootMargin?: string;
}

/**
 * `useInView(ref)` — simple IntersectionObserver hook.
 *
 * Used by leaderboard/explore thumbnails to defer mounting their R3F
 * canvases until the row scrolls into the viewport. Saves both GPU
 * and JS main-thread cost on long lists.
 *
 * `once=true`  → mount on first visible & stay mounted forever.
 * `once=false` → toggle with visibility so off-screen elements tear
 *                down (useful for freeing WebGL contexts).
 */
export function useInView<T extends Element = HTMLDivElement>(
  options: Options = {},
): [React.RefObject<T>, boolean] {
  const { threshold = 0, once = true, rootMargin = '200px' } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Older browsers: just render immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  return [ref, inView];
}
