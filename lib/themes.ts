import type { Theme, ThemeId } from './types';

/**
 * Six pixel-art themes for the city. Each theme retints background, fog,
 * grid, building base/accent, window glow and the gold crown for verified
 * skyscrapers. Hex strings are consumed directly by Three.js (which will
 * parse them via THREE.Color).
 *
 * Design note: bodies are deliberately very dark across every theme —
 * the city's visual signature is *thousands of dark buildings speckled
 * with glowing windows*, not fields of saturated colour. Each theme's
 * personality lives in the `windowGlow` (plus background/sky tints).
 */
export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: 'neon',
    label: 'Neon',
    background: '#0d1117',
    fog: '#0d1117',
    ground: '#05070d',
    gridLine: '#141a28',
    buildingBase: '#0e1420',
    buildingAccent: '#0f1a3a',
    windowGlow: '#59e0ff',
    crown: '#ffd700',
    skyTop: '#0a0e13',
    skyBottom: '#1a0f2e',
  },
  matrix: {
    id: 'matrix',
    label: 'Matrix',
    background: '#000000',
    fog: '#000000',
    ground: '#02080a',
    gridLine: '#081a08',
    buildingBase: '#050f05',
    buildingAccent: '#0a1f0a',
    windowGlow: '#5aff85',
    crown: '#9fff9f',
    skyTop: '#000000',
    skyBottom: '#001a00',
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    background: '#0a0a0a',
    fog: '#0a0a0a',
    ground: '#030303',
    gridLine: '#181818',
    buildingBase: '#0a0a0a',
    buildingAccent: '#141414',
    windowGlow: '#ffffff',
    crown: '#ffffff',
    skyTop: '#000000',
    skyBottom: '#1a1a1a',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    background: '#1a0f0a',
    fog: '#2a150a',
    ground: '#0a0402',
    gridLine: '#1a0e06',
    buildingBase: '#120804',
    buildingAccent: '#2a1006',
    windowGlow: '#ffb070',
    crown: '#ffcc00',
    skyTop: '#2a0e1a',
    skyBottom: '#ff6b35',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    background: '#031724',
    fog: '#052033',
    ground: '#010a14',
    gridLine: '#0b2336',
    buildingBase: '#031420',
    buildingAccent: '#07243a',
    windowGlow: '#6ee0ff',
    crown: '#aaf6ff',
    skyTop: '#020e1b',
    skyBottom: '#063c5a',
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    background: '#1a1405',
    fog: '#1a1405',
    ground: '#0a0702',
    gridLine: '#201508',
    buildingBase: '#120a03',
    buildingAccent: '#1f1405',
    windowGlow: '#ffe66b',
    crown: '#ffe066',
    skyTop: '#0e0a03',
    skyBottom: '#3a2a08',
  },
};

export const DEFAULT_THEME: ThemeId = 'neon';

export const THEME_ORDER: ThemeId[] = [
  'neon',
  'matrix',
  'noir',
  'sunset',
  'ocean',
  'gold',
];
