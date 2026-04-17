import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActivityEvent, ThemeId } from './types';
import { DEFAULT_THEME, THEMES } from './themes';
import { MOCK_USERS } from './mockData';

/**
 * Slice surface for the city store. Kept intentionally narrow so the
 * rest of the app can `useCityStore(s => s.field)` with shallow-equal
 * selectors without churning on unrelated changes.
 *
 * Phase 2 added:
 *   - `claimed` / `referral` activity kinds (see makeMessage below)
 *   - A `claimModalOpen` / `setClaimModalOpen` slice so any component
 *     (TopBar avatar chip, profile "CLAIM" CTA, etc.) can open the
 *     single global ClaimModal rendered once in app/layout.tsx.
 */
interface CityStore {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  hoveredUsername: string | null;
  setHovered: (u: string | null) => void;
  selectedUsername: string | null;
  setSelected: (u: string | null) => void;
  activity: ActivityEvent[];
  pushActivity: (e: ActivityEvent) => void;
  /** Global claim-modal state (UI-only; not persisted). */
  claimModalOpen: boolean;
  setClaimModalOpen: (open: boolean) => void;
  /**
   * Pre-fill the claim modal with a handle. When the profile page
   * triggers the modal we want the input seeded with whichever handle
   * the viewer was looking at.
   */
  claimModalSeed: string | null;
  setClaimModalSeed: (handle: string | null) => void;
}

const KINDS: ActivityEvent['kind'][] = [
  'joined',
  'grew',
  'kudos',
  'verified',
  'streak',
];

const KIND_PREFIX: Record<ActivityEvent['kind'], string> = {
  joined: '🏗',
  grew: '🔥',
  kudos: '👏',
  verified: '⭐',
  streak: '💥',
  claimed: '🏗',
  referral: '🤝',
};

export function makeMessage(
  kind: ActivityEvent['kind'],
  username: string,
  target?: string,
): string {
  const prefix = KIND_PREFIX[kind];
  switch (kind) {
    case 'joined':
      return `${prefix} @${username} broke ground`;
    case 'grew':
      return `${prefix} @${username} added a new floor`;
    case 'kudos':
      return `${prefix} @${username} clapped @${target ?? 'someone'}`;
    case 'verified':
      return `${prefix} @${username} earned a gold crown`;
    case 'streak':
      return `${prefix} @${username} is on a 7-day streak`;
    case 'claimed':
      return `${prefix} @${username} claimed their building`;
    case 'referral':
      return `${prefix} @${username} accepted @${target ?? 'someone'}'s invite — both buildings glow tonight`;
    default:
      return `${prefix} @${username}`;
  }
}

/** Build a starter feed of 20 synthetic events spread across the last hour. */
function seedActivity(): ActivityEvent[] {
  const now = Date.now();
  const events: ActivityEvent[] = [];
  for (let i = 0; i < 20; i += 1) {
    const u = MOCK_USERS[(i * 7) % MOCK_USERS.length];
    const kind = KINDS[i % KINDS.length];
    const target =
      kind === 'kudos'
        ? MOCK_USERS[(i * 13 + 3) % MOCK_USERS.length].username
        : undefined;
    events.push({
      id: `seed-${i}`,
      kind,
      username: u.username,
      target,
      timestamp: now - i * 60_000 - Math.floor(Math.random() * 30_000),
      message: makeMessage(kind, u.username, target),
    });
  }
  return events;
}

export const useCityStore = create<CityStore>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (t) => set({ theme: t }),
      hoveredUsername: null,
      setHovered: (u) => set({ hoveredUsername: u }),
      selectedUsername: null,
      setSelected: (u) => set({ selectedUsername: u }),
      activity: seedActivity(),
      pushActivity: (e) =>
        set((s) => ({ activity: [e, ...s.activity].slice(0, 40) })),
      claimModalOpen: false,
      setClaimModalOpen: (open) => set({ claimModalOpen: open }),
      claimModalSeed: null,
      setClaimModalSeed: (handle) => set({ claimModalSeed: handle }),
    }),
    {
      name: 'tweetcity-store',
      // Only persist the theme; activity & hovered/selected/modal state
      // stay ephemeral so each session feels alive.
      partialize: (s) => ({ theme: s.theme }),
      version: 1,
      // If localStorage hands us a theme id we don't recognise (e.g.
      // a future version removed the theme, or the value is corrupt),
      // fall back to DEFAULT_THEME so `THEMES[state.theme]` is always
      // defined downstream.
      onRehydrateStorage: () => (state) => {
        if (state && !(state.theme in THEMES)) {
          state.theme = DEFAULT_THEME;
        }
      },
    },
  ),
);
