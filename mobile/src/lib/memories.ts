import type { Api } from './api';
import type { Family, Memory } from './types';

export async function getFamilies(api: Api): Promise<Family[]> {
  const data = await api.get<{ families: Family[] }>('/families');
  return data.families ?? [];
}

export interface MemoriesQuery {
  familyId: string;
  page?: number;
  limit?: number;
}

export async function getMemories(api: Api, q: MemoriesQuery): Promise<Memory[]> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const data = await api.get<{ memories: Memory[] }>(
    `/memories?familyId=${encodeURIComponent(q.familyId)}&page=${page}&limit=${limit}`,
  );
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
  // React Native FormData accepts { uri, name, type } for file parts.
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

export async function uploadMemory(api: Api, input: UploadInput): Promise<Memory> {
  const data = await api.postForm<{ memory: Memory }>('/memories', buildUploadForm(input));
  return data.memory;
}
