import { type Api } from './api';
import type { Family, FamilyUsage, Me } from './types';

export async function getMe(api: Api): Promise<Me> {
  const data = await api.get<{ user: Me }>('/auth/me');
  return data.user;
}

export async function getFamilies(api: Api): Promise<Family[]> {
  const data = await api.get<{ families: Family[] }>('/families');
  return data.families ?? [];
}

export async function getFamily(api: Api, id: string): Promise<Family> {
  const data = await api.get<{ family: Family }>(`/families/${id}`);
  return data.family;
}

export async function createFamily(api: Api, name: string): Promise<Family> {
  const data = await api.post<{ family: Family }>('/families', { name });
  return data.family;
}

export async function updateFamily(api: Api, id: string, name: string): Promise<Family> {
  const data = await api.put<{ family: Family }>(`/families/${id}`, { name });
  return data.family;
}

export async function updateFamilySettings(
  api: Api,
  id: string,
  settings: { showPhotoLocation?: boolean },
): Promise<Family> {
  const data = await api.patch<{ family: Family }>(`/families/${id}/settings`, settings);
  return data.family;
}

export async function getFamilyUsage(api: Api, id: string): Promise<FamilyUsage> {
  return api.get<FamilyUsage>(`/families/${id}/usage`);
}
