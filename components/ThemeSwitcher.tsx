'use client';

import { clsx } from 'clsx';
import { useCityStore } from '@/lib/store';
import { THEMES, THEME_ORDER } from '@/lib/themes';

/**
 * Six small pixel-art swatches, one per theme. The active swatch gets a
 * glowing cyan outline. Clicking a swatch updates zustand which the
 * scene + UI re-read on the next render.
 */
export default function ThemeSwitcher() {
  const theme = useCityStore((s) => s.theme);
  const setTheme = useCityStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-1.5">
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            title={t.label}
            aria-label={`Theme: ${t.label}`}
            onClick={() => setTheme(id)}
            className={clsx(
              'relative w-6 h-6 border-[2px] transition-all duration-150',
              active
                ? 'border-accent-cyan shadow-[0_0_8px_#00d4ff]'
                : 'border-text-muted/40 hover:border-text-muted',
            )}
            style={{ background: t.background }}
          >
            {/* Tiny accent square in the bottom-right corner — gives each
                swatch a clear theme identity even at this size. */}
            <span
              aria-hidden
              className="absolute right-[2px] bottom-[2px] w-2 h-2"
              style={{ background: t.buildingAccent }}
            />
            {/* Window-glow dot in the top-left */}
            <span
              aria-hidden
              className="absolute left-[2px] top-[2px] w-1.5 h-1.5"
              style={{ background: t.windowGlow }}
            />
          </button>
        );
      })}
    </div>
  );
}
