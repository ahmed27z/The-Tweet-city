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
 *
 * Per-username state
 * ------------------
 * `welcomeBonusGranted[username]` records whether the 500 ✨ welcome
 * bonus has ever been paid out to that username **in this browser**,
 * so unclaim/reclaim cycles can't farm the bonus repeatedly.
 *
 * `kudosBalanceByUser[username]` remembers each username's kudos
 * balance independently of the `claimed` snapshot. It is updated on
 * every balance change, so unclaiming and reclaiming restores the
 * exact balance instead of resetting to the 50 seed.
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
  /** Usernames that have already received the 500 ✨ welcome bonus. */
  welcomeBonusGranted: Record<string, boolean>;
  /** Persisted per-username kudos balance, survives unclaim/reclaim. */
  kudosBalanceByUser: Record<string, number>;

  claim: (username: string) => void;
  unclaim: () => void;
  /**
   * Give 1 kudos to `toUsername`. Returns true if it actually happened,
   * false if blocked (not claimed, same-as-you, zero-balance without
   * an available daily drop).
   */
  giveKudos: (toUsername: string) => boolean;
  /** Add an arbitrary kudos delta to the claimed profile. Used for misc
   *  bookkeeping — **do not use for the welcome bonus**; call
   *  `grantWelcomeBonus` instead, which is idempotent per username. */
  addKudos: (amount: number) => void;
  /**
   * Credit the 500 ✨ welcome bonus for `username`, exactly once per
   * username per browser. Returns true if the credit happened, false
   * if it was already granted (or the username doesn't match the
   * current claim).
   */
  grantWelcomeBonus: (username: string) => boolean;
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

/** Normalize a user-supplied handle: strip leading @, lowercase, trim. */
function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, '').toLowerCase().trim();
}

/** Deterministic 6-char base36 code from the handle. */
export function referralCodeFor(username: string): string {
  const normalized = normalizeUsername(username);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i);
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
      welcomeBonusGranted: {},
      kudosBalanceByUser: {},

      claim: (usernameRaw) => {
        const username = normalizeUsername(usernameRaw);
        if (!username) return;
        const state = get();
        const existing = state.claimed;
        const persistedBalance = state.kudosBalanceByUser[username];
        const previouslyGranted =
          state.welcomeBonusGranted[username] === true;

        // Starting balance resolution:
        //  1. Mid-session re-claim of the same username → preserve.
        //  2. Persisted balance for this username exists → restore it
        //     (this is how unclaim/reclaim keeps kudos intact).
        //  3. Bonus was already granted once (edge case: no persisted
        //     balance) → start at 0, never again at the 50 seed.
        //  4. Fresh username → 50 so the player can try kudos before
        //     clicking the welcome-bonus CTA.
        const startingBalance =
          existing && existing.username === username
            ? existing.kudosBalance
            : persistedBalance !== undefined
            ? persistedBalance
            : previouslyGranted
            ? 0
            : 50;

        set({
          claimed: {
            username,
            claimedAt: Date.now(),
            kudosBalance: startingBalance,
            ownedCosmetics:
              existing?.username === username ? existing.ownedCosmetics : [],
            equipped:
              existing?.username === username ? existing.equipped : {},
            referralCode: referralCodeFor(username),
            lastDailyDropDay: 0,
          },
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [username]: startingBalance,
          },
        });
        pushActivity('claimed', username);
      },

      unclaim: () => {
        const state = get();
        const c = state.claimed;
        if (!c) {
          set({ claimed: null });
          return;
        }
        // Snapshot the current balance so a later re-claim can restore
        // it instead of starting from 50.
        set({
          claimed: null,
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [c.username]: c.kudosBalance,
          },
        });
      },

      addKudos: (amount) => {
        const state = get();
        const c = state.claimed;
        if (!c) return;
        const newBalance = Math.max(0, c.kudosBalance + amount);
        set({
          claimed: { ...c, kudosBalance: newBalance },
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [c.username]: newBalance,
          },
        });
      },

      grantWelcomeBonus: (usernameRaw) => {
        const username = normalizeUsername(usernameRaw);
        if (!username) return false;
        const state = get();
        const c = state.claimed;
        // Only credit the currently-claimed profile, and only if the
        // bonus has never been granted for this username.
        if (!c || c.username !== username) return false;
        if (state.welcomeBonusGranted[username] === true) return false;
        const newBalance = c.kudosBalance + 500;
        set({
          claimed: { ...c, kudosBalance: newBalance },
          welcomeBonusGranted: {
            ...state.welcomeBonusGranted,
            [username]: true,
          },
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [username]: newBalance,
          },
        });
        return true;
      },

      giveKudos: (toRaw) => {
        const to = normalizeUsername(toRaw);
        const state = get();
        const c = state.claimed;
        if (!c) return false;
        if (!to) return false;
        if (c.username === to) return false; // self-kudos not allowed

        // Daily free drop: first kudos of the UTC day grants +5 bonus.
        // When the player is empty and no drop is owed today, refuse —
        // otherwise the kudos counter would increment forever.
        const day = todayDay();
        const isFirstOfDay = c.lastDailyDropDay !== day;
        if (c.kudosBalance < 1 && !isFirstOfDay) return false;

        const bonus = isFirstOfDay ? 5 : 0;
        const newBalance = Math.max(0, c.kudosBalance - 1) + bonus;

        const given = { ...state.kudosGiven };
        given[to] = (given[to] ?? 0) + 1;

        set({
          kudosGiven: given,
          claimed: {
            ...c,
            kudosBalance: newBalance,
            lastDailyDropDay: day,
          },
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [c.username]: newBalance,
          },
          recentKudos: [
            { from: c.username, to, ts: Date.now() },
            ...state.recentKudos,
          ].slice(0, 40),
        });

        pushActivityFromKudos(c.username, to);
        return true;
      },

      buyCosmetic: (id) => {
        const cos = getCosmetic(id);
        const state = get();
        const c = state.claimed;
        if (!cos || !c) return false;
        if (c.ownedCosmetics.includes(id)) return true; // already owned
        if (c.kudosBalance < cos.price) return false;

        const newBalance = c.kudosBalance - cos.price;
        set({
          claimed: {
            ...c,
            kudosBalance: newBalance,
            ownedCosmetics: [...c.ownedCosmetics, id],
          },
          kudosBalanceByUser: {
            ...state.kudosBalanceByUser,
            [c.username]: newBalance,
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
        const username = normalizeUsername(usernameRaw);
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
      // `welcomeBonusGranted` and `kudosBalanceByUser` MUST be persisted
      // — otherwise a reload would re-enable the 500 ✨ exploit.
      partialize: (s) => ({
        claimed: s.claimed,
        kudosGiven: s.kudosGiven,
        recentKudos: s.recentKudos,
        referralsAccepted: s.referralsAccepted,
        welcomeBonusGranted: s.welcomeBonusGranted,
        kudosBalanceByUser: s.kudosBalanceByUser,
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
  const normalized = normalizeUsername(username);
  return useSocialStore((s) => s.kudosGiven[normalized] ?? 0);
}

/** Convenience hook: is this username the currently claimed profile? */
export function useIsClaimedBy(username: string): boolean {
  const normalized = normalizeUsername(username);
  return useSocialStore((s) => s.claimed?.username === normalized);
}

/**
 * Whether the viewer can give kudos right now: claimed, not a
 * self-clap, and either has a positive balance or is owed the daily
 * drop. The button consumer uses this to grey out and tooltip.
 *
 * Returns a stable discriminated tuple (boolean + string reason) that
 * we convert back into an object on the consumer side — this avoids
 * creating a new object reference inside the zustand selector, which
 * would otherwise trip the default `Object.is` equality check and
 * force every subscriber to re-render on every store write.
 */
type KudosReason = 'unclaimed' | 'self' | 'empty' | 'ok';

export function useCanGiveKudos(target: string): {
  allowed: boolean;
  reason?: 'unclaimed' | 'self' | 'empty';
} {
  const normalized = normalizeUsername(target);
  const reason = useSocialStore<KudosReason>((s) => {
    const c = s.claimed;
    if (!c) return 'unclaimed';
    if (c.username === normalized) return 'self';
    const isFirstOfDay = c.lastDailyDropDay !== todayDay();
    if (c.kudosBalance < 1 && !isFirstOfDay) return 'empty';
    return 'ok';
  });
  return reason === 'ok'
    ? { allowed: true }
    : { allowed: false, reason };
}
