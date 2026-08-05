import { type Api } from './api';
import type { Invitation, Member, Permission } from './types';

export async function getMembers(api: Api, familyId: string): Promise<Member[]> {
  const data = await api.get<{ members: Member[] }>(`/members?familyId=${encodeURIComponent(familyId)}`);
  return data.members ?? [];
}

export interface InviteResult {
  /** Set when the invitee already had an account and was added directly. */
  member?: Member;
  /** Set when a pending invitation was created. */
  invitation?: Invitation;
  inviteUrl?: string;
}

export async function inviteMember(
  api: Api,
  input: { familyId: string; email: string; permissions: Permission },
): Promise<InviteResult> {
  return api.post<InviteResult>('/members', input);
}

export async function updateMember(api: Api, id: string, permissions: Permission): Promise<Member> {
  const data = await api.put<{ member: Member }>(`/members/${id}`, { permissions });
  return data.member;
}

export async function removeMember(api: Api, id: string): Promise<void> {
  await api.del(`/members/${id}`);
}
