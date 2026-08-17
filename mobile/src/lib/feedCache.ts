import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Memory } from './types';

// Stale-while-revalidate cache for the default Timeline feed. We persist just the
// first page of the *unfiltered* feed (metadata only — image bytes still stream
// fresh from the authed endpoints), so a cold app launch can paint the last-seen
// memories instantly while the network refetch runs in the background.

const VERSION = 1;
const PREFIX = `osf:feed:v${VERSION}:`;
const MAX_ITEMS = 24; // one screenful; keeps the stored blob tiny

const key = (familyId: string) => `${PREFIX}${familyId}`;

interface CachedFeed {
  at: number;
  memories: Memory[];
}

/** Read the cached first page for a family, or null. Never throws. */
export async function readFeedCache(familyId: string | null): Promise<CachedFeed | null> {
  if (!familyId) return null;
  try {
    const raw = await AsyncStorage.getItem(key(familyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFeed;
    if (!parsed || !Array.isArray(parsed.memories)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the first page of the default feed. Best-effort. */
export async function writeFeedCache(familyId: string | null, memories: Memory[]): Promise<void> {
  if (!familyId || !Array.isArray(memories)) return;
  try {
    const payload = JSON.stringify({ at: Date.now(), memories: memories.slice(0, MAX_ITEMS) });
    await AsyncStorage.setItem(key(familyId), payload);
  } catch {
    // Storage failure — the cache is a nicety, so ignore.
  }
}

/** Clear every cached feed (e.g. on sign-out). */
export async function clearFeedCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
}
