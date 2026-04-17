import type { TwitterStats, BuildingProps, Theme } from './types';

/**
 * Tiny string hash → unsigned 32-bit integer.
 * Used to derive a deterministic hue per username for "colorful" buildings.
 */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Convert HSL (degrees / percent / percent) to a CSS hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const c = lN - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * c);
  };
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Lightweight hex-color mixer. `t` ranges 0..1 (0 = a, 1 = b). */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(lerp(ar, br))}${toHex(lerp(ag, bg))}${toHex(lerp(ab, bb))}`;
}

/**
 * Derive deterministic geometry/visual props for a building from a user's
 * Twitter stats. Numbers are tuned so even an account with 0 followers
 * still renders as a small visible block.
 */
export function generateBuilding(
  stats: TwitterStats,
  position: [number, number, number],
  theme: Theme,
): BuildingProps {
  const avgLikesPerTweet = stats.totalLikes / Math.max(1, stats.tweetCount);
  // Height: a bit taller max so even modest towers read against the horizon
  // from the bird's-eye camera.
  const height = Math.max(1.5, Math.log10(stats.tweetCount + 1) * 10); // 1.5..~50
  // Width: clamp both ends so megaphones don't spill into neighbouring
  // grid cells (spacing is 3.2) and no-op accounts are still visible.
  const width = Math.max(
    0.9,
    Math.min(3.0, Math.log10(stats.followers + 1) * 0.55),
  );
  const floors = Math.max(1, Math.ceil(stats.following / 500));
  const windowGlow = Math.min(1, avgLikesPerTweet / 1000);
  const isAnimated = stats.tweetsLast7Days > 5;
  const hasGoldCrown = stats.verified;
  const ageYears =
    (Date.now() - new Date(stats.joinDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);
  const weathered = ageYears > 8;
  const colorful = stats.mediaTweets / Math.max(1, stats.tweetCount) > 0.3;

  // Pick the building color.
  // Both branches stay intentionally dark — the city's visual signature
  // is thousands of near-black bodies *speckled* with cyan window dots,
  // not fields of pastel blocks. Colour-of-body is a whisper; colour-of-
  // windows is the shout.
  let color: string;
  if (colorful) {
    // Media-heavy users get a faint hue bias. Lightness stays very low
    // so they still read as dark buildings, not candy.
    const h = hashString(stats.username) % 360;
    color = hslToHex(h, 32, 14);
  } else {
    // Everyone else: mix between near-black and the theme buildingBase.
    // Follower-driven weight nudges the megaphones a hair brighter so
    // the downtown cluster still has a subtle silhouette pop.
    const followerWeight = Math.min(1, Math.log10(stats.followers + 1) / 8);
    const t = 0.05 + followerWeight * 0.15; // 0.05..0.20
    color = mixHex('#070a10', theme.buildingBase, t);
  }

  return {
    username: stats.username,
    height,
    width,
    floors,
    windowGlow,
    isAnimated,
    hasGoldCrown,
    weathered,
    colorful,
    accountAgeYears: ageYears,
    verified: stats.verified,
    position,
    color,
  };
}

/**
 * Coarse LOD bucket for a building. Distance is computed in the scene
 * (camera ↔ position). Small buildings far away get the cheapest render.
 */
export function bucketBuilding(
  b: BuildingProps,
  distance: number,
): 'near' | 'mid' | 'far' {
  if (distance < 80) return 'near';
  if (distance < 200) return 'mid';
  return 'far';
}
