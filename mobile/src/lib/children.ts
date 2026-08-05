import { type Api } from './api';
import { xhrUpload, type UploadPart } from './upload';
import type { Child, Gender } from './types';

export async function getChildren(api: Api, familyId: string): Promise<Child[]> {
  const data = await api.get<{ children: Child[] }>(`/children?familyId=${encodeURIComponent(familyId)}`);
  return data.children ?? [];
}

export interface CreateChildInput {
  familyId: string;
  name: string;
  dateOfBirth: string; // ISO8601 (required by the API)
  gender?: Gender | null;
}

export async function createChild(api: Api, input: CreateChildInput): Promise<Child> {
  const data = await api.post<{ child: Child }>('/children', input);
  return data.child;
}

export interface UpdateChildInput {
  name?: string;
  dateOfBirth?: string;
  gender?: Gender | null;
}

export async function updateChild(api: Api, id: string, input: UpdateChildInput): Promise<Child> {
  const data = await api.put<{ child: Child }>(`/children/${id}`, input);
  return data.child;
}

export async function deleteChild(api: Api, id: string): Promise<void> {
  await api.del(`/children/${id}`);
}

export function uploadChildAvatar(
  getToken: () => Promise<string | null>,
  childId: string,
  asset: UploadPart,
): Promise<{ child: Child }> {
  return xhrUpload<{ child: Child }>(getToken, 'POST', `/children/${childId}/avatar`, asset);
}
