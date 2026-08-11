import { type Api } from './api';
import type { ActivityItem } from './types';

export interface ActivityQuery {
  familyId: string;
  page?: number;
  limit?: number;
}

export async function getActivity(api: Api, q: ActivityQuery): Promise<ActivityItem[]> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 30;
  const url = `/activity?familyId=${encodeURIComponent(q.familyId)}&page=${page}&limit=${limit}`;
  const data = await api.get<{ activity: ActivityItem[] }>(url);
  return data.activity ?? [];
}

/** Compact relative time: "now", "5m", "3h", "2d", "4w", then a date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w`;
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
