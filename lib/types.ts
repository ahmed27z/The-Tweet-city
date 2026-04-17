/**
 * Core domain types for TweetCity.
 *
 * These shapes are shared across mock data generation, the Three.js scene,
 * and UI components. Keep them stable — downstream code in the next task
 * (real Twitter API + Supabase) will implement the same interfaces.
 */

export interface TwitterStats {
  username: string; // no leading @
  displayName: string;
  followers: number;
  following: number;
  tweetCount: number;
  totalLikes: number; // lifetime likes received
  tweetsLast7Days: number;
  mediaTweets: number;
  verified: boolean;
  joinDate: string; // ISO
  bio?: string;
  avatarUrl?: string;
}

export interface BuildingProps {
  username: string;
  height: number; // y-scale units (world)
  width: number; // x & z base (world)
  floors: number;
  windowGlow: number; // 0..1
  isAnimated: boolean;
  hasGoldCrown: boolean;
  weathered: boolean;
  colorful: boolean;
  accountAgeYears: number;
  verified: boolean;
  // derived placement
  position: [number, number, number];
  color: string; // base hex, theme-tinted downstream
}

export type ThemeId = 'neon' | 'matrix' | 'noir' | 'sunset' | 'ocean' | 'gold';

export interface Theme {
  id: ThemeId;
  label: string;
  background: string;
  fog: string;
  ground: string;
  gridLine: string;
  buildingBase: string;
  buildingAccent: string;
  windowGlow: string;
  crown: string;
  skyTop: string;
  skyBottom: string;
}

export interface ActivityEvent {
  id: string;
  kind: 'joined' | 'grew' | 'kudos' | 'verified' | 'streak';
  username: string;
  target?: string; // for kudos
  timestamp: number;
  message: string; // prebuilt pretty string
}
