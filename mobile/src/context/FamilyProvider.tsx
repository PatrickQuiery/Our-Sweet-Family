import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from '../hooks/useApi';
import { getFamilies, getMe } from '../lib/family';
import type { Family, Me } from '../lib/types';

const ACTIVE_KEY = 'activeFamilyId';

interface FamilyContextValue {
  families: Family[];
  activeFamily: Family | null;
  activeFamilyId: string | null;
  setActiveFamilyId: (id: string) => void;
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** True if the current user may manage the given (or active) family — owner or parent. */
  canManage: (family?: Family | null) => boolean;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const [families, setFamilies] = useState<Family[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [activeFamilyId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fams, meUser] = await Promise.all([getFamilies(api), getMe(api).catch(() => null)]);
      setFamilies(fams);
      if (meUser) setMe(meUser);
      const stored = await SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null);
      setActiveId((prev) => {
        const valid = (id: string | null) => !!id && fams.some((f) => f.id === id);
        if (valid(prev)) return prev;
        if (valid(stored)) return stored;
        return fams[0]?.id ?? null;
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load family');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isSignedIn) refresh();
  }, [isSignedIn, refresh]);

  const setActiveFamilyId = useCallback((id: string) => {
    setActiveId(id);
    SecureStore.setItemAsync(ACTIVE_KEY, id).catch(() => {});
  }, []);

  const value = useMemo<FamilyContextValue>(() => {
    const activeFamily = families.find((f) => f.id === activeFamilyId) ?? null;
    const canManage = (family?: Family | null) => {
      const f = family ?? activeFamily;
      if (!f || !me) return false;
      return f.ownerId === me.id || (f.members ?? []).some((m) => m.userId === me.id && m.permissions === 'all');
    };
    return { families, activeFamily, activeFamilyId, setActiveFamilyId, me, loading, error, refresh, canManage };
  }, [families, activeFamilyId, me, loading, error, refresh, setActiveFamilyId]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used within a FamilyProvider');
  return ctx;
}
