import { MOCK_USERS, findUser, searchUsers } from './mockData';
import type { TwitterStats } from './types';

/**
 * Twitter API wrapper — currently returns mock data.
 * Replace with real X API v2 calls when credentials are configured
 * in the next task. The function signatures here are the contract
 * downstream code (search bar, profile pages) depends on.
 */
export async function fetchUser(
  username: string,
): Promise<TwitterStats | null> {
  await new Promise((r) => setTimeout(r, 120)); // simulate latency
  return findUser(username) ?? null;
}

export async function searchUser(query: string): Promise<TwitterStats[]> {
  await new Promise((r) => setTimeout(r, 80));
  return searchUsers(query, 10);
}

export async function fetchAllUsers(): Promise<TwitterStats[]> {
  return MOCK_USERS;
}
