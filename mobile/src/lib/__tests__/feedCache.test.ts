jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __reset: () => {
      store = {};
    },
    getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((k) => delete store[k]);
    }),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFeedCache, writeFeedCache, clearFeedCache } from '../feedCache';
import type { Memory } from '../types';

const mem = (id: string): Memory => ({ id, fileType: 'photo' } as unknown as Memory);

beforeEach(() => {
  (AsyncStorage as any).__reset();
  jest.clearAllMocks();
});

describe('feedCache', () => {
  it('writes then reads back the cached memories', async () => {
    await writeFeedCache('fam1', [mem('a'), mem('b')]);
    const cached = await readFeedCache('fam1');
    expect(cached?.memories.map((m) => m.id)).toEqual(['a', 'b']);
    expect(typeof cached?.at).toBe('number');
  });

  it('returns null for a family with no cache', async () => {
    await expect(readFeedCache('nope')).resolves.toBeNull();
  });

  it('returns null (never throws) for a null familyId', async () => {
    await expect(readFeedCache(null)).resolves.toBeNull();
  });

  it('caps the stored list to 24 items', async () => {
    const many = Array.from({ length: 40 }, (_, i) => mem(`m${i}`));
    await writeFeedCache('fam1', many);
    const cached = await readFeedCache('fam1');
    expect(cached?.memories).toHaveLength(24);
  });

  it('clears only our feed keys', async () => {
    await AsyncStorage.setItem('unrelated', 'keep-me');
    await writeFeedCache('fam1', [mem('a')]);
    await clearFeedCache();
    expect(await readFeedCache('fam1')).toBeNull();
    expect(await AsyncStorage.getItem('unrelated')).toBe('keep-me');
  });

  it('does not throw when AsyncStorage fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(writeFeedCache('fam1', [mem('a')])).resolves.toBeUndefined();
  });
});
