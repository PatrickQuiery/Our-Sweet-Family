import { ApiError, type Api } from './api';
import { API_ROOT } from './config';
import type { Memory } from './types';

export interface MemoriesQuery {
  familyId: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getMemories(api: Api, q: MemoriesQuery): Promise<Memory[]> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  let url = `/memories?familyId=${encodeURIComponent(q.familyId)}&page=${page}&limit=${limit}`;
  if (q.search?.trim()) url += `&search=${encodeURIComponent(q.search.trim())}`;
  const data = await api.get<{ memories: Memory[] }>(url);
  return data.memories ?? [];
}

export interface UploadAsset {
  uri: string;
  name: string;
  mimeType: string;
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
): Promise<Memory> {
  return new Promise<Memory>((resolve, reject) => {
    getToken()
      .then((token) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_ROOT}/memories`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
