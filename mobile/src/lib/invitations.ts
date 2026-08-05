import { type Api } from './api';
import type { Invitation } from './types';

export async function getInvitations(api: Api, familyId: string): Promise<Invitation[]> {
  const data = await api.get<{ invitations: Invitation[] }>(`/invitations?familyId=${encodeURIComponent(familyId)}`);
  return data.invitations ?? [];
}

export interface InvitationInfo {
  email: string;
  familyName: string;
  inviterName: string;
}

/** Public endpoint — describes a pending invitation for the accept screen. */
export async function getInvitationInfo(api: Api, token: string): Promise<InvitationInfo> {
  return api.get<InvitationInfo>(`/invitations/${encodeURIComponent(token)}`);
}

export async function claimInvitation(api: Api, token: string): Promise<{ success: boolean; familyId: string }> {
  return api.post<{ success: boolean; familyId: string }>(`/invitations/${encodeURIComponent(token)}/claim`);
}

export async function revokeInvitation(api: Api, id: string): Promise<void> {
  await api.del(`/invitations/${id}`);
}

export const PERMISSION_LABELS: Record<string, string> = {
  view_only: 'View only',
  upload: 'Can upload',
  share_download: 'Upload & download',
  all: 'Full access',
};
