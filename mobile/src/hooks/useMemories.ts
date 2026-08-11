import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import { useFamily } from '../context/FamilyProvider';
import { getMemories } from '../lib/memories';
import type { Memory } from '../lib/types';

interface UseMemoriesOpts {
  search?: string;
  childId?: string;
  from?: string;
  to?: string;
}

/**
 * Paginated memory feed for the active family (from FamilyProvider). Reloads when
 * the active family, `search`, or `childId` filter changes. `family` in the return
 * is the active family, so existing consumers (Timeline header, Capture) keep working.
 */
export function useMemories({ search, childId, from, to }: UseMemoriesOpts = {}) {
  const api = useApi();
  const { activeFamily } = useFamily();
  const familyId = activeFamily?.id ?? null;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    if (!familyId) {
      setMemories([]);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const first = await getMemories(api, { familyId, page: 1, limit: 20, search, childId, from, to });
      setMemories(first);
      setPage(1);
      setDone(first.length < 20);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [api, familyId, search, childId, from, to]);

  const loadMore = useCallback(async () => {
    if (loading || done || !familyId) return;
    setLoading(true);
    try {
      const next = page + 1;
      const more = await getMemories(api, { familyId, page: next, limit: 20, search, childId, from, to });
      setMemories((prev) => [...prev, ...more]);
      setPage(next);
      if (more.length < 20) setDone(true);
    } catch {
      // keep what we have; pull-to-refresh can retry
    } finally {
      setLoading(false);
    }
  }, [api, familyId, page, loading, done, search, childId, from, to]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  return { family: activeFamily, memories, loading, refreshing, error, refresh: loadFirst, loadMore };
}
