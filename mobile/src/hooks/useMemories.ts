import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import { getFamilies, getMemories } from '../lib/memories';
import type { Family, Memory } from '../lib/types';

export function useMemories() {
  const api = useApi();
  const [family, setFamily] = useState<Family | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const fams = await getFamilies(api);
      const fam = fams[0] ?? null;
      setFamily(fam);
      if (fam) {
        const first = await getMemories(api, { familyId: fam.id, page: 1, limit: 20 });
        setMemories(first);
        setPage(1);
        setDone(first.length < 20);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  const loadMore = useCallback(async () => {
    if (loading || done || !family) return;
    setLoading(true);
    try {
      const next = page + 1;
      const more = await getMemories(api, { familyId: family.id, page: next, limit: 20 });
      setMemories((prev) => [...prev, ...more]);
      setPage(next);
      if (more.length < 20) setDone(true);
    } catch {
      // keep what we have; pull-to-refresh can retry
    } finally {
      setLoading(false);
    }
  }, [api, family, page, loading, done]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  return { family, memories, loading, refreshing, error, refresh: loadFirst, loadMore };
}
