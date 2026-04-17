/**
 * Catalog of cosmetic items available in the building shop.
 *
 * Categories mirror the four building "slots" we let players customize:
 *   - antenna : tip of the roof (small rod/shape)
 *   - flag    : banner near the top of the building
 *   - windows : override tint for the window glow
 *   - aura    : glow ring at the building's base
 *
 * `preview` is a hex string consumed by both the shop swatch DOM and
 * the Hero3D overlay to tint the corresponding Three.js primitive. Keep
 * it a simple `#rrggbb` — no CSS functions.
 */

export type CosmeticCategory = 'antenna' | 'flag' | 'windows' | 'aura';

export interface Cosmetic {
  id: string;
  label: string;
  category: CosmeticCategory;
  price: number;
  preview: string;
  description: string;
}

export const COSMETICS: readonly Cosmetic[] = [
  // ─── Antennas ────────────────────────────────────────────────────────
  {
    id: 'antenna-broadcast',
    label: 'Broadcast',
    category: 'antenna',
    price: 200,
    preview: '#00d4ff',
    description: 'Classic cyan broadcast tower.',
  },
  {
    id: 'antenna-lightning',
    label: 'Lightning',
    category: 'antenna',
    price: 600,
    preview: '#f0ff00',
    description: 'Zig-zag antenna, cracks the sky.',
  },
  {
    id: 'antenna-ham',
    label: 'Ham Radio',
    category: 'antenna',
    price: 100,
    preview: '#aaa8a3',
    description: 'Vintage long-range dish.',
  },
  {
    id: 'antenna-satellite',
    label: 'Satellite',
    category: 'antenna',
    price: 1200,
    preview: '#ffffff',
    description: 'Angled dish pointing at space.',
  },

  // ─── Flags ───────────────────────────────────────────────────────────
  {
    id: 'flag-pride',
    label: 'Pride',
    category: 'flag',
    price: 800,
    preview: '#ff3fa4',
    description: 'Full rainbow banner.',
  },
  {
    id: 'flag-bitcoin',
    label: 'Bitcoin',
    category: 'flag',
    price: 1500,
    preview: '#f7931a',
    description: 'Orange B flag for the maxis.',
  },
  {
    id: 'flag-verified',
    label: 'Verified',
    category: 'flag',
    price: 400,
    preview: '#1ecbe1',
    description: 'Tiny blue checkmark banner.',
  },
  {
    id: 'flag-anon',
    label: 'Anon',
    category: 'flag',
    price: 250,
    preview: '#222222',
    description: 'Plain black flag, very cool, trust me.',
  },

  // ─── Window patterns ─────────────────────────────────────────────────
  {
    id: 'windows-grid',
    label: 'Grid',
    category: 'windows',
    price: 150,
    preview: '#66e0ff',
    description: 'Even soft-blue grid glow.',
  },
  {
    id: 'windows-checker',
    label: 'Checker',
    category: 'windows',
    price: 300,
    preview: '#ffa500',
    description: 'Alternating amber/dark checker.',
  },
  {
    id: 'windows-marquee',
    label: 'Marquee',
    category: 'windows',
    price: 500,
    preview: '#ffd700',
    description: 'Scrolling gold marquee glow.',
  },
  {
    id: 'windows-pulse',
    label: 'Pulse',
    category: 'windows',
    price: 700,
    preview: '#ff3fa4',
    description: 'Slow hot-pink pulse, gym-at-3am energy.',
  },

  // ─── Auras ───────────────────────────────────────────────────────────
  {
    id: 'aura-cyan-pulse',
    label: 'Cyan Pulse',
    category: 'aura',
    price: 1000,
    preview: '#00d4ff',
    description: 'Pulsing cyan halo at the base.',
  },
  {
    id: 'aura-gold-shimmer',
    label: 'Gold Shimmer',
    category: 'aura',
    price: 2500,
    preview: '#ffd700',
    description: 'The most obnoxious glow in the city.',
  },
  {
    id: 'aura-matrix-green',
    label: 'Matrix Green',
    category: 'aura',
    price: 800,
    preview: '#00ff41',
    description: 'Downer-green haze. You know what you did.',
  },
  {
    id: 'aura-sunset',
    label: 'Sunset',
    category: 'aura',
    price: 1200,
    preview: '#ff6b35',
    description: 'Warm orange aura at dusk.',
  },
] as const;

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: string): Cosmetic | undefined {
  return BY_ID.get(id);
}

/**
 * Grouped view for the shop: `{ antenna: [...], flag: [...], ... }`.
 * Order within each category mirrors the declaration order above.
 */
export function cosmeticsByCategory(): Record<CosmeticCategory, Cosmetic[]> {
  const out: Record<CosmeticCategory, Cosmetic[]> = {
    antenna: [],
    flag: [],
    windows: [],
    aura: [],
  };
  for (const c of COSMETICS) out[c.category].push(c);
  return out;
}

export const CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  antenna: 'Antenna',
  flag: 'Flag',
  windows: 'Windows',
  aura: 'Aura',
};

export const CATEGORY_ORDER: CosmeticCategory[] = [
  'antenna',
  'flag',
  'windows',
  'aura',
];
