import { runAutoUpload, type AutoUploadDeps, type RollAsset, type SyncCursor } from '../autoUpload';

function asset(id: string, creationTime: number, mediaType: RollAsset['mediaType'] = 'photo'): RollAsset {
  return { id, creationTime, mediaType };
}

function makeDeps(assets: RollAsset[], overrides: Partial<AutoUploadDeps> = {}): { deps: AutoUploadDeps; saved: SyncCursor[]; uploaded: string[] } {
  const saved: SyncCursor[] = [];
  const uploaded: string[] = [];
  const deps: AutoUploadDeps = {
    getCursor: async () => null,
    saveCursor: async (c) => {
      saved.push(c);
    },
    listNewAssets: async () => assets,
    uploadAsset: async (a) => {
      uploaded.push(a.id);
    },
    ...overrides,
  };
  return { deps, saved, uploaded };
}

describe('runAutoUpload', () => {
  it('uploads new assets oldest-first and advances the cursor after each', async () => {
    const { deps, saved, uploaded } = makeDeps([asset('c', 300), asset('a', 100), asset('b', 200)]);
    const res = await runAutoUpload(deps);

    expect(uploaded).toEqual(['a', 'b', 'c']); // sorted by creationTime asc
    expect(res).toEqual({ uploaded: 3, failed: 0, cursor: { lastAssetId: 'c', lastCreationTime: 300 } });
    expect(saved[saved.length - 1]).toEqual({ lastAssetId: 'c', lastCreationTime: 300 });
  });

  it('does nothing when there are no new assets', async () => {
    const { deps, saved, uploaded } = makeDeps([]);
    const res = await runAutoUpload(deps);
    expect(uploaded).toEqual([]);
    expect(saved).toEqual([]);
    expect(res).toEqual({ uploaded: 0, failed: 0, cursor: null });
  });

  it('stops on the first upload failure, leaving the cursor at the last success', async () => {
    const uploaded: string[] = [];
    const { deps, saved } = makeDeps([asset('a', 100), asset('b', 200), asset('c', 300)], {
      uploadAsset: async (a) => {
        if (a.id === 'b') throw new Error('network');
        uploaded.push(a.id);
      },
    });
    const res = await runAutoUpload(deps);

    expect(uploaded).toEqual(['a']);
    expect(res).toEqual({ uploaded: 1, failed: 1, cursor: { lastAssetId: 'a', lastCreationTime: 100 } });
    expect(saved).toEqual([{ lastAssetId: 'a', lastCreationTime: 100 }]);
  });

  it('respects the max per-run bound', async () => {
    const { deps, uploaded } = makeDeps([asset('a', 100), asset('b', 200), asset('c', 300)]);
    const res = await runAutoUpload(deps, { max: 2 });
    expect(uploaded).toEqual(['a', 'b']);
    expect(res.uploaded).toBe(2);
    expect(res.cursor).toEqual({ lastAssetId: 'b', lastCreationTime: 200 });
  });

  it('passes the persisted cursor to listNewAssets', async () => {
    const cursor: SyncCursor = { lastAssetId: 'x', lastCreationTime: 50 };
    const listNewAssets = jest.fn(async () => [asset('a', 100)]);
    const { deps } = makeDeps([], { getCursor: async () => cursor, listNewAssets });
    await runAutoUpload(deps);
    expect(listNewAssets).toHaveBeenCalledWith(cursor);
  });
});
