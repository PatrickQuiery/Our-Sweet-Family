import { type Api } from './api';
import type { Reel, ReelType } from './types';

export async function getReels(
  api: Api,
  opts: { familyId: string; type?: ReelType; childId?: string },
): Promise<Reel[]> {
  const type = opts.type ?? 'annual';
  let url = `/reels?familyId=${encodeURIComponent(opts.familyId)}&type=${type}`;
  if (opts.childId) url += `&childId=${encodeURIComponent(opts.childId)}`;
  const data = await api.get<{ reels: Reel[] }>(url);
  return data.reels ?? [];
}

export const REEL_TYPE_LABELS: Record<ReelType, string> = {
  annual: 'Yearly',
  monthly: 'Monthly',
  birthday: 'Birthdays',
  holiday: 'Holidays',
};
