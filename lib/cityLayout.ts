import type { TwitterStats } from './types';
import { NAMED_HANDLES } from './mockData';

/** Tiny string hash → unsigned 32-bit integer. Mirrors hashString in
 * buildingGenerator but lives here too so the layout has no dependency
 * on the renderer side. Keeping it local avoids a cycle. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const SPACING = 3.2;
const JITTER = 0.4;
const AVENUE_EVERY = 12;

/**
 * Generate ordered `(cellX, cellZ)` pairs sweeping outward from the
 * origin in increasing-distance order. We produce enough cells to
 * comfortably seat every user plus the ~8 % of cells that will be
 * skipped by the avenue rule.
 *
 * The sweep is implemented as a ring-by-ring BFS with deterministic
 * tie-breaking so two users with identical follower counts always get
 * the same pair of cells.
 */
function enumerateCells(target: number): Array<[number, number]> {
  const cells: Array<[number, number, number]> = []; // [x, z, dist²]
  // The city is square-bounded; pick a radius big enough to hold
  // `target` cells even after avenue skips (≈ √(target × 1.2)/2).
  const R = Math.ceil(Math.sqrt(target * 1.3) / 2) + 2;
  for (let x = -R; x <= R; x += 1) {
    for (let z = -R; z <= R; z += 1) {
      cells.push([x, z, x * x + z * z]);
    }
  }
  cells.sort((a, b) => {
    if (a[2] !== b[2]) return a[2] - b[2];
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  return cells.map(([x, z]) => [x, z]);
}

/**
 * Lay out users on a dense, near-circular block grid:
 *
 *   - Sort users by followers (descending) so the biggest megaphones
 *     land near the origin — produces the Manhattan-from-afar effect
 *     where the tallest silhouettes cluster downtown.
 *   - Walk grid cells in order of distance-from-origin, placing one
 *     user per cell. Every 12th row / column is an avenue (no
 *     buildings) unless skipping that cell would displace a named-list
 *     megaphone (elonmusk, naval, …). Named users never get skipped.
 *   - Nudge each placed cell by ±0.4 world units in both axes, seeded
 *     from `hashString(username)`, so the skyline isn't mechanically
 *     aligned.
 *
 * Return positions in the **original** input order: `positions[i]`
 * corresponds to `users[i]`, not to the sorted order we used
 * internally.
 */
export function layoutCity(
  users: TwitterStats[],
): [number, number, number][] {
  const sorted = [...users].sort((a, b) => b.followers - a.followers);

  // Pre-compute a generous list of candidate cells.
  const cells = enumerateCells(sorted.length * 2 + 64);

  const positionByUser = new Map<string, [number, number, number]>();
  let ci = 0;

  for (const u of sorted) {
    const isNamed = NAMED_HANDLES.has(u.username);

    // Find the next usable cell. Skip avenue cells for non-named users.
    let picked: [number, number] | null = null;
    while (ci < cells.length && picked === null) {
      const [cx, cz] = cells[ci];
      ci += 1;
      const onAvenue =
        cx % AVENUE_EVERY === 0 || cz % AVENUE_EVERY === 0;
      if (onAvenue && !isNamed) continue; // leave the avenue open
      picked = [cx, cz];
    }

    // Safety fallback: if we somehow exhaust the candidate list, drop
    // at the origin + growing spiral. Shouldn't happen for 2000 users
    // with R ≈ 26 (2809 cells).
    if (!picked) picked = [0, 0];

    const [cx, cz] = picked;
    const h = hashString(u.username);
    const jx = ((h & 0xffff) / 0xffff - 0.5) * 2 * JITTER;
    const jz = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 2 * JITTER;
    positionByUser.set(u.username, [
      cx * SPACING + jx,
      0,
      cz * SPACING + jz,
    ]);
  }

  // Remap to original order
  return users.map(
    (u) => positionByUser.get(u.username) ?? [0, 0, 0],
  );
}

/**
 * World-units half-extent of the city. Used as Three.js fog-far and
 * to cull buildings that are clearly off-screen.
 *
 * With 2000 users at 3.2-unit spacing, the footprint radius is
 * sqrt(2000) * 3.2 / 2 ≈ 71. 220 leaves ample margin for fog, grid
 * fade-out and a starfield backdrop.
 */
export const CITY_BOUNDS = 220;
