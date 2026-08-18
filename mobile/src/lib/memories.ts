import { ApiError, type Api } from './api';
import { API_ROOT } from './config';
import type { Comment, Memory } from './types';

export async function getMemory(api: Api, id: string): Promise<Memory> {
  const data = await api.get<{ memory: Memory }>(`/memories/${id}`);
  return data.memory;
}

export async function deleteMemory(api: Api, id: string): Promise<void> {
  await api.del(`/memories/${id}`);
}

export async function updateMemory(api: Api, id: string, patch: Record<string, unknown>): Promise<Memory> {
  const data = await api.patch<{ memory: Memory }>(`/memories/${id}`, patch);
  return data.memory;
}

export async function addReaction(api: Api, id: string): Promise<void> {
  await api.post(`/memories/${id}/reactions`);
}

export async function removeReaction(api: Api, id: string): Promise<void> {
  await api.del(`/memories/${id}/reactions`);
}

export async function addComment(api: Api, id: string, text: string): Promise<Comment> {
  const data = await api.post<{ comment: Comment }>(`/memories/${id}/comments`, { text });
  return data.comment;
}

export async function deleteComment(api: Api, memoryId: string, commentId: string): Promise<void> {
  await api.del(`/memories/${memoryId}/comments/${commentId}`);
}

export interface MemoriesQuery {
  familyId: string;
  page?: number;
  limit?: number;
  search?: string;
  childId?: string;
  /** Timeline scrubber window over capturedAt (ISO strings). */
  from?: string;
  to?: string;
}

export async function getMemories(api: Api, q: MemoriesQuery): Promise<Memory[]> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  let url = `/memories?familyId=${encodeURIComponent(q.familyId)}&page=${page}&limit=${limit}`;
  if (q.search?.trim()) url += `&search=${encodeURIComponent(q.search.trim())}`;
  if (q.childId) url += `&childId=${encodeURIComponent(q.childId)}`;
  if (q.from) url += `&from=${encodeURIComponent(q.from)}`;
  if (q.to) url += `&to=${encodeURIComponent(q.to)}`;
  const data = await api.get<{ memories: Memory[] }>(url);
  return data.memories ?? [];
}

/** Camera-roll asset ids already uploaded for this family (for "already added" flags). */
export async function getUploadedAssetIds(api: Api, familyId: string): Promise<string[]> {
  const data = await api.get<{ assetIds: string[] }>(`/memories/asset-ids?familyId=${encodeURIComponent(familyId)}`);
  return data.assetIds ?? [];
}

export interface UploadAsset {
  uri: string;
  name: string;
  mimeType: string;
  /** Camera-roll asset id — sent as clientAssetId so the server can dedupe re-picks. */
  assetId?: string;
}

export interface UploadInput {
  familyId: string;
  childIds: string[];
  caption?: string;
  asset: UploadAsset;
}

export function buildUploadForm(input: UploadInput): FormData {
  const form = new FormData();
  // React Native's XMLHttpRequest streams this { uri, name, type } file-part shape natively.
  form.append('file', {
    uri: input.asset.uri,
    name: input.asset.name,
    type: input.asset.mimeType,
  } as unknown as Blob);
  form.append('familyId', input.familyId);
  form.append('childIds', JSON.stringify(input.childIds));
  if (input.caption) form.append('caption', input.caption);
  if (input.asset.assetId) form.append('clientAssetId', input.asset.assetId);
  return form;
}

/**
 * Upload a memory via XMLHttpRequest. RN's XHR handles multipart file uploads
 * (the { uri, name, type } part shape) natively; the global fetch in RN 0.86 /
 * Expo 57 is spec-compliant and either rejects that shape ("Unsupported
 * FormDataPart implementation") or drops the connection on Blob multipart bodies.
 */
export function uploadMemory(
  getToken: () => Promise<string | null>,
  input: UploadInput,
  onProgress?: (pct: number) => void,
): Promise<Memory> {
  return new Promise<Memory>((resolve, reject) => {
    getToken()
      .then((token) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_ROOT}/memories`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (onProgress && xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total));
          };
        }
        xhr.onload = () => {
          let body: { memory?: Memory; error?: string; message?: string } | null = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            body = null;
          }
          if (xhr.status >= 200 && xhr.status < 300 && body?.memory) {
            resolve(body.memory);
          } else {
            reject(new ApiError(xhr.status, body?.error || body?.message || `HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new ApiError(0, 'Network request failed'));
        xhr.send(buildUploadForm(input));
      })
      .catch(reject);
  });
}
