import type { TwitterStats } from './types';

/**
 * Tiny deterministic PRNG (Mulberry32). Same seed → same sequence,
 * which keeps the mock city stable across reloads/SSR vs. CSR.
 */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Map a 0..1 random value into a log-uniform integer range. */
function logUniformInt(rng: () => number, lo: number, hi: number): number {
  const a = Math.log10(Math.max(1, lo));
  const b = Math.log10(Math.max(1, hi));
  return Math.floor(10 ** (a + (b - a) * rng()));
}

/** Map a 0..1 random value into a uniform integer range. */
function uniformInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(lo + (hi - lo + 1) * rng());
}

/**
 * Gaussian-ish random in [0,1] centred around `mu`, spread `sigma`,
 * clamped to [0,1]. Used for media ratio.
 */
function clampedGauss(rng: () => number, mu: number, sigma: number): number {
  // Two-sample Box–Muller (cheap, good enough for mock data)
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(1, mu + g * sigma));
}

const HANDLES: string[] = [
  'elonmusk',
  'naval',
  'pmarca',
  'sama',
  'paulg',
  'balajis',
  'vitalikbuterin',
  'jack',
  'dhh',
  'patio11',
  'danabra_mov',
  'levelsio',
  'visakanv',
  'garrytan',
  'fchollet',
  'karpathy',
  'ylecun',
  'swyx',
  'kentcdodds',
  'dan_abramov',
  'rauchg',
  'theo',
  'shadcn',
  'tobi',
  'guillermorauch',
  'antonio_pm',
  'jessfraz',
  'sarahcpr',
  'tsarnick',
  'lexfridman',
  'mrbeast',
  'taylorswift13',
  'barackobama',
  'nasa',
  'spacex',
  'stripe',
  'vercel',
  'nextjs',
  'reactjs',
  'threejs',
  'mrwhosetheboss',
  'mkbhd',
  'marquesbrownlee',
  'tferriss',
  'joerogan',
  'thealexbanks',
  'shl',
  'samuelrizzondev',
  'acemagic',
  'capy_ai',
];

/**
 * Set of usernames that are *always* verified + always rendered as
 * prominent megaphones in the city (they never get skipped when grid
 * cells would land on an "avenue").
 */
export const NAMED_HANDLES: ReadonlySet<string> = new Set(HANDLES);

const ALWAYS_VERIFIED = new Set([
  'elonmusk',
  'naval',
  'pmarca',
  'jack',
  'barackobama',
  'mrbeast',
  'taylorswift13',
  'nasa',
  'spacex',
  'stripe',
  'vercel',
]);

const BIO_FRAGMENTS = [
  'building things on the internet',
  'shipping pixels & prose',
  'curious about everything',
  'thoughts are my own',
  'engineer · cat lover · coffee',
  'ex-everything, currently founder',
  'writing code, breaking prod',
  'making stuff people want',
  'open-source maintainer',
  'futurist · skeptic · optimist',
  'hot takes, cool head',
  'research / engineering / vibes',
];

const EMOJIS = ['', '', '', '🚀', '✨', '⚡', '🧠', '🛠', '🌌'];

// --- Synthetic-handle vocabulary -------------------------------------------
// Short, pronounceable fragments. Combined with optional suffixes + a
// seeded number tail, they produce handles like `pilo42`, `drifter_99`,
// `neon_bb_203`. The lists are intentionally small so handles feel like
// they came from the same universe rather than a random dictionary dump.

const SYN_PREFIXES = [
  'pilo', 'drift', 'neon', 'void', 'pixel', 'glim', 'astra', 'ember',
  'frost', 'lunar', 'orbit', 'quartz', 'rune', 'saber', 'tango', 'umbra',
  'vex', 'wisp', 'zen', 'nova', 'ion', 'halo', 'cobra', 'delta',
  'echo', 'flux', 'gale', 'hex', 'indigo', 'jett', 'kite', 'lark',
  'mako', 'nyx', 'onyx', 'perl', 'quill', 'rogue', 'silk', 'tide',
  'vega', 'wren', 'xen', 'yarn', 'zero', 'arc', 'bolt', 'clip',
  'dune', 'ebb', 'flare', 'gist', 'hush', 'iris', 'jinx', 'knot',
  'loop', 'mist', 'nook', 'oath', 'pine', 'quip', 'rift', 'sage',
  'tyro', 'urge', 'vine', 'warp', 'xyl', 'yule', 'zim', 'bit',
  'byte', 'crux', 'dash', 'eon', 'fog', 'glyph', 'huff', 'inky',
];

const SYN_SUFFIXES = [
  '', '', '', '', // bias toward no suffix
  '_bb', '_hq', '_ink', '_ai', '_dev', '_pro', '_ex',
  '_lab', '_xyz', '_io', '_oss', '_sol', '_42', '_jp',
];

const SYN_CONNECTORS = ['', '', '_', '']; // mostly no connector

/** Build a pronounceable synthetic handle, deterministic from `seed`. */
function makeSyntheticHandle(seed: number): string {
  const rng = seededRandom(seed);
  const pre = SYN_PREFIXES[Math.floor(rng() * SYN_PREFIXES.length)];
  // ~25% of handles are two-fragment compounds (drifter_pilo, ionwren, …)
  const compound = rng() < 0.25;
  const pre2 = compound
    ? SYN_PREFIXES[Math.floor(rng() * SYN_PREFIXES.length)]
    : '';
  const connector = compound
    ? SYN_CONNECTORS[Math.floor(rng() * SYN_CONNECTORS.length)]
    : '';
  const suffix = SYN_SUFFIXES[Math.floor(rng() * SYN_SUFFIXES.length)];
  // Small numeric tail. Biased toward 2-3 digits so handles feel like
  // @something_99, not a UUID. Occasionally no tail at all.
  const tailRoll = rng();
  let tail = '';
  if (tailRoll < 0.15) tail = '';
  else if (tailRoll < 0.55) tail = String(Math.floor(rng() * 99) + 1);
  else tail = String(Math.floor(rng() * 900) + 100);

  return `${pre}${connector}${pre2}${suffix}${tail}`;
}

function titleCase(name: string): string {
  return name
    .split(/[_\d]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Pick a follower-tier count from the distribution described in the
 * task:   60% → 100..10k, 30% → 10k..250k, 8% → 250k..5M, 2% → 5M..50M.
 */
function tieredFollowers(rng: () => number): number {
  const roll = rng();
  if (roll < 0.6) return logUniformInt(rng, 100, 10_000);
  if (roll < 0.9) return logUniformInt(rng, 10_000, 250_000);
  if (roll < 0.98) return logUniformInt(rng, 250_000, 5_000_000);
  return logUniformInt(rng, 5_000_000, 50_000_000);
}

/** Named-list user: stats dialed up so they always read as megaphones. */
function makeNamedUser(username: string): TwitterStats {
  const seed = hashSeed(username);
  const rng = seededRandom(seed);

  const followers = logUniformInt(rng, 50_000, 50_000_000);
  const tweetCount = logUniformInt(rng, 500, 150_000);
  const following = uniformInt(rng, 50, 20_000);
  const totalLikes = uniformInt(rng, 100, Math.max(100, followers * 50));
  const tweetsLast7Days = uniformInt(rng, 5, 200);
  const mediaTweets = Math.floor(
    tweetCount * clampedGauss(rng, 0.15, 0.15),
  );
  const verified = ALWAYS_VERIFIED.has(username) || rng() < 0.3;

  const startMs = Date.UTC(2008, 0, 1);
  const endMs = Date.UTC(2024, 0, 1);
  const joinDate = new Date(
    startMs + Math.floor(rng() * (endMs - startMs)),
  ).toISOString();

  const baseDisplay = titleCase(username) || username;
  const emoji = EMOJIS[Math.floor(rng() * EMOJIS.length)];
  const displayName = emoji ? `${baseDisplay} ${emoji}`.trim() : baseDisplay;
  const bio = BIO_FRAGMENTS[Math.floor(rng() * BIO_FRAGMENTS.length)];

  return {
    username,
    displayName,
    followers,
    following,
    tweetCount,
    totalLikes,
    tweetsLast7Days,
    mediaTweets,
    verified,
    joinDate,
    bio,
  };
}

/** Synthetic user — log-uniform follower tiers, ~3% verified. */
function makeSyntheticUser(username: string): TwitterStats {
  const seed = hashSeed(username);
  const rng = seededRandom(seed);

  const followers = tieredFollowers(rng);
  // Tweets loosely correlated with followers — heavier accounts tweet
  // more on average, but with plenty of noise so the city still varies.
  const followerTierFrac = Math.min(
    1,
    Math.log10(followers + 1) / Math.log10(50_000_000),
  );
  const tweetLo = Math.max(10, Math.floor(10 ** (1 + followerTierFrac * 2.5)));
  const tweetHi = Math.max(
    tweetLo + 10,
    Math.floor(10 ** (2 + followerTierFrac * 3.5)),
  );
  const tweetCount = logUniformInt(rng, tweetLo, Math.min(150_000, tweetHi));

  const following = uniformInt(rng, 10, 20_000);
  const totalLikes = uniformInt(rng, 10, Math.max(10, followers * 50));
  // Active-this-week, loosely tied to tweetCount
  const activeMax = Math.max(
    1,
    Math.min(150, Math.floor(tweetCount / 200) + 20),
  );
  const tweetsLast7Days = uniformInt(rng, 0, activeMax);
  const mediaTweets = Math.floor(
    tweetCount * clampedGauss(rng, 0.15, 0.18),
  );
  const verified = rng() < 0.03;

  const startMs = Date.UTC(2008, 0, 1);
  const endMs = Date.UTC(2024, 0, 1);
  const joinDate = new Date(
    startMs + Math.floor(rng() * (endMs - startMs)),
  ).toISOString();

  const baseDisplay = titleCase(username) || username;
  const emoji = EMOJIS[Math.floor(rng() * EMOJIS.length)];
  const displayName = emoji ? `${baseDisplay} ${emoji}`.trim() : baseDisplay;
  const bio = BIO_FRAGMENTS[Math.floor(rng() * BIO_FRAGMENTS.length)];

  return {
    username,
    displayName,
    followers,
    following,
    tweetCount,
    totalLikes,
    tweetsLast7Days,
    mediaTweets,
    verified,
    joinDate,
    bio,
  };
}

/**
 * Generate the full 2000-user city. First 50 entries are the named
 * handles (preserves findUser behaviour); the remaining 1950 are
 * deterministically-generated pronounceable synthetic handles.
 */
function buildMockCity(): TwitterStats[] {
  const out: TwitterStats[] = HANDLES.map(makeNamedUser);
  const used = new Set(HANDLES);

  const target = 2000;
  let attempt = 0;
  // Hard cap on retries so a pathological vocabulary doesn't loop
  // forever — plenty of headroom given the ~80×80×(suffix×tail)
  // combinatorial space.
  while (out.length < target && attempt < 50_000) {
    const h = makeSyntheticHandle(0xdeadbeef + attempt);
    attempt += 1;
    if (used.has(h)) continue;
    used.add(h);
    out.push(makeSyntheticUser(h));
  }

  return out;
}

export const MOCK_USERS: TwitterStats[] = buildMockCity();

export function findUser(username: string): TwitterStats | undefined {
  const u = username.replace(/^@/, '').toLowerCase();
  return MOCK_USERS.find((m) => m.username.toLowerCase() === u);
}

export function searchUsers(query: string, limit = 10): TwitterStats[] {
  const q = query.replace(/^@/, '').toLowerCase().trim();
  if (!q) return [];
  return MOCK_USERS.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q),
  )
    .sort((a, b) => b.followers - a.followers)
    .slice(0, limit);
}
