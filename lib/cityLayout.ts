import type { TwitterStats } from './types';

/**
 * Lay out users on a roughly circular grid (golden-angle spiral),
 * sorted by followers so the most-followed accounts cluster near the
 * origin. The returned positions are returned in the **original** user
 * order (i.e. positions[i] corresponds to users[i]).
 */
export function layoutCity(
  users: TwitterStats[],
): [number, number, number][] {
  const sorted = [...users].sort((a, b) => b.followers - a.followers);
  const positions: [number, number, number][] = [];

  // Spiral outward from origin using golden-angle placement
  const spacing = 14;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  sorted.forEach((_, i) => {
    const radius = spacing * Math.sqrt(i);
    const angle = i * goldenAngle;
    positions.push([
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    ]);
  });

  // Map back to the ORIGINAL user order
  const idxByUser = new Map(sorted.map((u, i) => [u.username, i]));
  return users.map((u) => positions[idxByUser.get(u.username)!]);
}

/**
 * World-units half-extent of the city. Used as Three.js fog-far and
 * to cull buildings that are clearly off-screen.
 */
export const CITY_BOUNDS = 300;
