// Stale-while-revalidate cache for the default Timeline feed. We persist just the
// first page of the *unfiltered* feed (metadata only — the image bytes are still
// fetched fresh through the authed blob endpoints), so a browser refresh can paint
// the last-seen memories instantly while the network refetch runs in the background.

const VERSION = 1;
const PREFIX = 'osf:feed:v' + VERSION + ':';
const MAX_ITEMS = 24; // one screenful; keeps the stored blob tiny

const key = (familyId) => `${PREFIX}${familyId}`;

/** Read the cached first page for a family, or null. Never throws. */
export function readFeedCache(familyId) {
  if (!familyId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(familyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.memories)) return null;
    return parsed; // { at, memories }
  } catch {
    return null;
  }
}

/** Persist the first page of the default feed. Best-effort (quota/serialize safe). */
export function writeFeedCache(familyId, memories) {
  if (!familyId || typeof localStorage === 'undefined' || !Array.isArray(memories)) return;
  try {
    const payload = JSON.stringify({ at: Date.now(), memories: memories.slice(0, MAX_ITEMS) });
    localStorage.setItem(key(familyId), payload);
  } catch {
    // Quota or serialization failure — the cache is a nicety, so ignore.
  }
}

/** Clear every cached feed (e.g. on sign-out, so nothing lingers on a shared machine). */
export function clearFeedCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
