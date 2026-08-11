import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import { useFamily } from '../context/FamilyProvider';
import { getActivity } from '../lib/activity';
import type { ActivityItem } from '../lib/types';

const PAGE = 30;

/** Paginated activity feed (loves, comments, new memories) for the active family. */
export function useActivity() {
  const api = useApi();
  const { activeFamily } = useFamily();
  const familyId = activeFamily?.id ?? null;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    if (!familyId) {
      setItems([]);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const first = await getActivity(api, { familyId, page: 1, limit: PAGE });
      setItems(first);
      setPage(1);
      setDone(first.length < PAGE);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [api, familyId]);

  const loadMore = useCallback(async () => {
    if (loading || done || !familyId) return;
    setLoading(true);
    try {
      const next = page + 1;
      const more = await getActivity(api, { familyId, page: next, limit: PAGE });
      setItems((prev) => [...prev, ...more]);
      setPage(next);
      if (more.length < PAGE) setDone(true);
    } catch {
      // keep what we have; pull-to-refresh can retry
    } finally {
      setLoading(false);
    }
  }, [api, familyId, page, loading, done]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  return { items, loading, refreshing, error, refresh: loadFirst, loadMore };
}
