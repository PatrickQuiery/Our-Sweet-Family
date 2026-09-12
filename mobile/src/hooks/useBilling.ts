import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from './useApi';
import { useFamily } from '../context/FamilyProvider';
import type { BillingStatus } from '../lib/billing';

export function useBilling() {
  const api = useApi();
  const { userId } = useAuth();
  const { activeFamilyId, refresh: refreshFamily } = useFamily();
  const key = `${userId}:${activeFamilyId}`;
  const current = useRef({ key, epoch: 0 });
  if (current.current.key !== key) current.current = { key, epoch: current.current.epoch + 1 };
  const identity = current.current;
  const assertCurrent = useCallback(() => {
    if (current.current !== identity) throw new Error('Account or family changed.');
  }, [identity]);
  const [state, setState] = useState<{ identity: typeof identity | null; status: BillingStatus | null }>({ identity: null, status: null });
  const requestVersion = useRef(0);
  const [feedback, setFeedback] = useState<{ identity: typeof identity; error: string | null; pending: boolean }>({ identity, error: null, pending: false });
  const updateFeedback = useCallback((error: string | null, pending: boolean) => {
    if (current.current === identity) setFeedback({ identity, error, pending });
  }, [identity]);
  const expectedPaid = useRef(false);
  const expectedTier = useRef<string | null>(null);
  const syncing = useRef(false);
  const query = activeFamilyId ? `?familyId=${encodeURIComponent(activeFamilyId)}` : '';
  const refresh = useCallback(async () => {
    assertCurrent();
    const version = ++requestVersion.current;
    try {
      const status = await api.get<BillingStatus>(`/billing/status${query}`);
      assertCurrent();
      if (version === requestVersion.current) setState({ identity, status });
      return status;
    } catch (e) { updateFeedback('Could not load subscription status. Please retry.', expectedPaid.current); throw e; }
  }, [api, query, key, assertCurrent, updateFeedback]);
  const sync = useCallback(async (expectPaid = false, tier?: string) => {
    assertCurrent();
    if (syncing.current) throw new Error('Subscription confirmation is already in progress.');
    syncing.current = true;
    expectedPaid.current ||= expectPaid;
    if (tier) expectedTier.current = tier;
    const version = ++requestVersion.current;
    updateFeedback(null, true);
    try {
      const status = await api.post<BillingStatus>(`/billing/sync${query}`);
      assertCurrent();
      if (version === requestVersion.current) setState({ identity, status });
      if (expectedPaid.current && (!status.hasSubscription || (expectedTier.current && status.plan !== expectedTier.current))) throw new Error('Purchase confirmation is still pending.');
      await refreshFamily();
      assertCurrent();
      expectedPaid.current = false;
      expectedTier.current = null;
      updateFeedback(null, false);
      return status;
    } catch (e) {
      updateFeedback('Family subscription access could not be confirmed yet. Retry confirmation.', true);
      throw e;
    } finally { syncing.current = false; }
  }, [api, query, key, refreshFamily, assertCurrent, updateFeedback]);
  useEffect(() => {
    expectedPaid.current = false;
    expectedTier.current = null;
    updateFeedback(null, false);
    if (!userId) return;
    void refresh().catch(() => {});
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active') return;
      void refresh().then(async status => {
        if (current.current === identity && !syncing.current && status.canManage && status.syncAvailable) await sync();
      }).catch(() => {});
    });
    return () => listener.remove();
  }, [refresh, sync, identity, updateFeedback, userId]);
  return { status: state.identity === identity ? state.status : null, error: feedback.identity === identity ? feedback.error : null, pending: feedback.identity === identity && feedback.pending, refresh, sync };
}
