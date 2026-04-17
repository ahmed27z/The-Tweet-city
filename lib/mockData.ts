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

function titleCase(name: string): string {
  return name
    .split(/[_\d]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function makeUser(username: string): TwitterStats {
  const seed = hashSeed(username);
  const rng = seededRandom(seed);

  const followers = logUniformInt(rng, 100, 50_000_000);
  const tweetCount = logUniformInt(rng, 10, 150_000);
  const following = uniformInt(rng, 10, 20_000);
  const totalLikes = uniformInt(rng, 10, Math.max(10, followers * 50));
  const tweetsLast7Days = uniformInt(rng, 0, 200);
  const mediaTweets = uniformInt(rng, 0, Math.floor(tweetCount * 0.7));
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

export const MOCK_USERS: TwitterStats[] = HANDLES.map(makeUser);

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
