import { type Api } from './api';

export interface ReferralInfo {
  code: string;
  count: number;
  rewardActiveUntil?: string | null;
  plan: string;
  rewardDays: number;
}

export async function getReferral(api: Api): Promise<ReferralInfo> {
  return api.get<ReferralInfo>('/referrals/me');
}
