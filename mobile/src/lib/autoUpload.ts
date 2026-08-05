/**
 * Background auto-upload orchestration core (Phase 3), written as pure logic with
 * injected dependencies so it's fully unit-testable without native modules. At
 * EAS-build time the adapters are backed by expo-media-library (listNewAssets),
 * the existing memory upload (uploadAsset), and expo-sqlite (get/saveCursor).
 *
 * Each asset uploads with its stable id as `clientAssetId`, so the server dedupes
 * across re-wakes/reinstalls (@@unique([familyId, clientAssetId])).
 */

export interface RollAsset {
  /** Stable camera-roll asset id — used as clientAssetId for server-side dedupe. */
  id: string;
  /** Epoch ms the asset was created (for ordering + cursor). */
  creationTime: number;
  mediaType: 'photo' | 'video';
}

export interface SyncCursor {
  lastAssetId: string;
  lastCreationTime: number;
}

export interface AutoUploadDeps {
  getCursor: () => Promise<SyncCursor | null>;
  saveCursor: (cursor: SyncCursor) => Promise<void>;
  /** Assets newer than the cursor (album/start-date/Wi-Fi filtering happens here). */
  listNewAssets: (since: SyncCursor | null) => Promise<RollAsset[]>;
  uploadAsset: (asset: RollAsset) => Promise<void>;
}

export interface AutoUploadResult {
  uploaded: number;
  failed: number;
  cursor: SyncCursor | null;
}

/**
 * Diff new camera-roll assets since the cursor → upload oldest-first → advance the
 * cursor after each success. Stops on the first upload failure so the run resumes
 * from exactly there on the next wake (no skipped or out-of-order assets). Bounded
 * by `opts.max` so a single background window can't run unbounded.
 */
export async function runAutoUpload(deps: AutoUploadDeps, opts: { max?: number } = {}): Promise<AutoUploadResult> {
  const max = opts.max ?? Infinity;
  const cursor = await deps.getCursor();

  // Oldest-first so the cursor advances monotonically and a mid-run stop is resumable.
  const assets = [...(await deps.listNewAssets(cursor))].sort((a, b) => a.creationTime - b.creationTime);

  let uploaded = 0;
  let failed = 0;
  let newCursor = cursor;

  for (const asset of assets) {
    if (uploaded >= max) break;
    try {
      await deps.uploadAsset(asset);
      uploaded += 1;
      newCursor = { lastAssetId: asset.id, lastCreationTime: asset.creationTime };
      await deps.saveCursor(newCursor);
    } catch {
      failed += 1;
      break; // resume here next wake
    }
  }

  return { uploaded, failed, cursor: newCursor };
}
