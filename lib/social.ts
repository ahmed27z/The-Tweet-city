import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CosmeticCategory } from './cosmetics';
import { getCosmetic } from './cosmetics';
import { MOCK_USERS, seededRandom } from './mockData';
import { useCityStore, makeMessage } from './store';
import type { ActivityEvent } from './types';

/**
 * Second zustand store dedicated to **social state** — everything that
 * a future Supabase migration will need to own. Splitting this out
 * from `useCityStore` keeps responsibilities clean: the city store is
 * presentation/theme/live feed; this one is player data.
 *
 * Persistence
 * -----------
 * Persisted under `tweetcity-social-v1` so a future `v2` migration can
 * coexist with an older tab. Only stable fields are persisted
 * (obvious next step: swap `persist` for Supabase queries keyed by
 * Twitter id).
 */

export interface ClaimedProfile {
  /** Twitter handle being claimed (lowercased, no @). */
  username: string;
  claimedAt: number;
  /** Balance of ✨ kudos owned by this profile. */
  kudosBalance: number;
  /** Cosmetic ids the player has purchased. */
  ownedCosmetics: string[];
  /** Cosmetic id currently equipped per slot (empty = nothing). */
  equipped: Partial<Record<CosmeticCategory, string>>;
  /** Deterministic referral code derived from the username. */
  referralCode: string;
  /** Unix day-number of the last free drop, so the daily bonus doesn't double-tap. */
  lastDailyDropDay: number;
}

export interface KudosEvent {
  from: string;
  to: string;
  ts: number;
}

interface SocialStore {
  claimed: ClaimedProfile | null;
  /** username → total kudos given to them (by anyone in this browser) */
  kudosGiven: Record<string, number>;
  recentKudos: KudosEvent[];
  /** Usernames that accepted YOUR invite */
  referralsAccepted: string[];

  claim: (username: string) => void;
  unclaim: () => void;
  /**
   * Give 1 kudos to `toUsername`. Returns true if it actually happened,
   * false if blocked (not claimed, same-as-you, zero-balance).
   */
  giveKudos: (toUsername: string) => boolean;
  /** Add the welcome-bonus kudos (used by the claim modal). */
  addKudos: (amount: number) => void;
  /** Buy a cosmetic; returns true on success. */
  buyCosmetic: (id: string) => boolean;
  /** Equip a cosmetic into its category slot. No-op if not owned. */
  equip: (id: string) => void;
  /** Register a referral acceptance (dedupes). */
  addReferral: (username: string) => void;
}

/** Unix day number — used to rate-limit the daily free drop. */
function todayDay(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24));
}

/** Deterministic 6-char base36 code from the handle. */
export function referralCodeFor(username: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < username.length; i += 1) {
    h ^= username.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(6, '0').slice(0, 6).toUpperCase();
}

/**
 * Seeded initial kudos sprinkled across mock users so a fresh install
 * feels populated. Uses the same PRNG as the mock data generator so
 * runs are deterministic.
 */
function seedKudos(): Record<string, number> {
  const rng = seededRandom(0xfeed);
  const out: Record<string, number> = {};
  for (const u of MOCK_USERS) {
    // 60% get between 1..30, 40% stay at 0 for realism.
    if (rng() < 0.6) out[u.username] = Math.floor(rng() * 30) + 1;
  }
  return out;
}

function seedRecent(): KudosEvent[] {
  const rng = seededRandom(0xbeef);
  const now = Date.now();
  const list: KudosEvent[] = [];
  for (let i = 0; i < 15; i += 1) {
    const from = MOCK_USERS[Math.floor(rng() * MOCK_USERS.length)].username;
    const to = MOCK_USERS[Math.floor(rng() * MOCK_USERS.length)].username;
    if (from === to) continue;
    list.push({
      from,
      to,
      ts: now - Math.floor(rng() * 60 * 60 * 1000),
    });
  }
  return list.sort((a, b) => b.ts - a.ts);
}

/**
 * Push a kudos event into the CITY store's activity feed so the live
 * ticker reflects social actions. Wrapped to avoid importing the city
 * store at module load (which would create a circular dep: social →
 * city → social).
 */
function pushActivityFromKudos(from: string, to: string): void {
  const ev: ActivityEvent = {
    id: `kudos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'kudos',
    username: from,
    target: to,
    timestamp: Date.now(),
    message: makeMessage('kudos', from, to),
  };
  useCityStore.getState().pushActivity(ev);
}

function pushActivity(
  kind: ActivityEvent['kind'],
  username: string,
  target?: string,
): void {
  const ev: ActivityEvent = {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    username,
    target,
    timestamp: Date.now(),
    message: makeMessage(kind, username, target),
  };
  useCityStore.getState().pushActivity(ev);
}

export const useSocialStore = create<SocialStore>()(
  persist(
    (set, get) => ({
      claimed: null,
      kudosGiven: seedKudos(),
      recentKudos: seedRecent(),
      referralsAccepted: [],

      claim: (usernameRaw) => {
        const username = usernameRaw.replace(/^@/, '').toLowerCase().trim();
        if (!username) return;
        const existing = get().claimed;
        // Starting balance: 50 ✨ so first-time players can try kudos
        // before anything else. The claim modal adds the 500 ✨ welcome
        // bonus via `addKudos` on Continue.
        const startingBalance =
          existing && existing.username === username
            ? existing.kudosBalance
            : 50;
        set({
          claimed: {
            username,
            claimedAt: Date.now(),
            kudosBalance: startingBalance,
            ownedCosmetics: existing?.username === username ? existing.ownedCosmetics : [],
            equipped: existing?.username === username ? existing.equipped : {},
            referralCode: referralCodeFor(username),
            lastDailyDropDay: 0,
          },
        });
        pushActivity('claimed', username);
      },

      unclaim: () => set({ claimed: null }),

      addKudos: (amount) => {
        const c = get().claimed;
        if (!c) return;
        set({
          claimed: { ...c, kudosBalance: Math.max(0, c.kudosBalance + amount) },
        });
      },

      giveKudos: (toRaw) => {
        const to = toRaw.replace(/^@/, '').toLowerCase().trim();
        const c = get().claimed;
        if (!c) return false;
        if (c.username === to) return false; // self-kudos not allowed

        const given = { ...get().kudosGiven };
        given[to] = (given[to] ?? 0) + 1;

        // Daily free drop: first kudos of the UTC day grants +5 bonus
        const day = todayDay();
        const isFirstOfDay = c.lastDailyDropDay !== day;
        const bonus = isFirstOfDay ? 5 : 0;
        const newBalance = Math.max(0, c.kudosBalance - 1) + bonus;

        set({
          kudosGiven: given,
          claimed: {
            ...c,
            kudosBalance: newBalance,
            lastDailyDropDay: day,
          },
          recentKudos: [
            { from: c.username, to, ts: Date.now() },
            ...get().recentKudos,
          ].slice(0, 40),
        });

        pushActivityFromKudos(c.username, to);
        return true;
      },

      buyCosmetic: (id) => {
        const cos = getCosmetic(id);
        const c = get().claimed;
        if (!cos || !c) return false;
        if (c.ownedCosmetics.includes(id)) return true; // already owned
        if (c.kudosBalance < cos.price) return false;

        set({
          claimed: {
            ...c,
            kudosBalance: c.kudosBalance - cos.price,
            ownedCosmetics: [...c.ownedCosmetics, id],
          },
        });
        return true;
      },

      equip: (id) => {
        const cos = getCosmetic(id);
        const c = get().claimed;
        if (!cos || !c) return;
        if (!c.ownedCosmetics.includes(id)) return;
        set({
          claimed: {
            ...c,
            equipped: { ...c.equipped, [cos.category]: id },
          },
        });
      },

      addReferral: (usernameRaw) => {
        const username = usernameRaw.replace(/^@/, '').toLowerCase().trim();
        if (!username) return;
        const list = get().referralsAccepted;
        if (list.includes(username)) return; // dedup
        const c = get().claimed;
        if (c && c.username === username) return; // don't self-refer
        set({ referralsAccepted: [username, ...list] });
        if (c) pushActivity('referral', c.username, username);
      },
    }),
    {
      name: 'tweetcity-social-v1',
      // Keep only player-owned data. Recent kudos + referrals survive.
      partialize: (s) => ({
        claimed: s.claimed,
        kudosGiven: s.kudosGiven,
        recentKudos: s.recentKudos,
        referralsAccepted: s.referralsAccepted,
      }),
      version: 1,
    },
  ),
);

/**
 * Selector hook — isolates the `kudosGiven[username]` read so a
 * component only re-renders when the target's count changes.
 */
export function useKudosCount(username: string): number {
  return useSocialStore((s) => s.kudosGiven[username] ?? 0);
}

/** Convenience hook: is this username the currently claimed profile? */
export function useIsClaimedBy(username: string): boolean {
  return useSocialStore((s) => s.claimed?.username === username);
}
