import { type Api } from './api';
import type { Milestone } from './types';

export async function getMilestones(api: Api, childId: string): Promise<Milestone[]> {
  const data = await api.get<{ milestones: Milestone[] }>(`/milestones?childId=${encodeURIComponent(childId)}`);
  return data.milestones ?? [];
}

export interface CreateMilestoneInput {
  childId: string;
  type: string;
  value: string;
  unit?: string;
  note?: string;
  date: string; // ISO8601
}

export async function createMilestone(api: Api, input: CreateMilestoneInput): Promise<Milestone> {
  const data = await api.post<{ milestone: Milestone }>('/milestones', input);
  return data.milestone;
}

export async function deleteMilestone(api: Api, id: string): Promise<void> {
  await api.del(`/milestones/${id}`);
}

/** Common milestone kinds offered in the add form (the API accepts any string). */
export const MILESTONE_TYPES = ['Height', 'Weight', 'First', 'Words', 'Tooth', 'Other'];
