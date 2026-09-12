import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { configureRevenueCat } from '../lib/purchases';
import { purchaseWithFreshStatus } from '../lib/purchasePreflight';
import { PurchaseSession } from '../lib/purchaseSession';

export type Tier = 'free' | 'plus' | 'premium';
const tierOf = (info: CustomerInfo | null): Tier => info?.entitlements.active.premium ? 'premium' : info?.entitlements.active.plus ? 'plus' : 'free';
// Module lifetime matches the singleton native SDK, including provider remounts.
const session = new PurchaseSession<CustomerInfo>({
  login: async id => (await Purchases.logIn(id)).customerInfo,
  logout: async () => { if (!(await Purchases.isAnonymous())) await Purchases.logOut(); },
});
function usePurchasesValue() {
  const { isSignedIn, userId } = useAuth();
  const id = isSignedIn && userId ? userId : null;
  const [state, setState] = useState<{ id: string | null; info: CustomerInfo | null }>({ id: null, info: null });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setState({ id: null, info: null });
    setError(null);
    if (!configureRevenueCat()) { setError('Purchases are unavailable on this device.'); return; }
    session.identify(id).then(() => {
      if (alive && session.ready(id)) setState({ id, info: session.info });
    }).catch(() => { if (alive) setError('Could not connect purchases to your account. Please sign in again.'); });
    return () => { alive = false; };
  }, [id]);
  const ready = !!id && state.id === id && session.ready(id);
  const customerInfo = ready ? state.info : null;
  const accept = useCallback((info: CustomerInfo) => { if (session.ready(id)) setState({ id, info }); }, [id]);
  const refresh = useCallback(async () => { const info = await session.run(id, () => Purchases.getCustomerInfo()); accept(info); }, [id, accept]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && ready) void refresh().catch(() => {}); });
    return () => listener.remove();
  }, [ready, refresh]);
  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const result = await session.action(id, () => purchaseWithFreshStatus({
      invalidate: () => Purchases.invalidateCustomerInfoCache(),
      read: () => Purchases.getCustomerInfo(),
      purchase: () => Purchases.purchasePackage(pkg),
      accept,
      isCurrent: () => session.ready(id),
    }));
    accept(result.customerInfo);
    return tierOf(result.customerInfo);
  }, [id, accept]);
  const restore = useCallback(async () => {
    const info = await session.action(id, () => Purchases.restorePurchases());
    accept(info);
    return tierOf(info) !== 'free';
  }, [id, accept]);
  const getOfferings = useCallback(() => session.run(id, () => Purchases.getOfferings()), [id]);
  const presentCustomerCenter = useCallback(async () => {
    await session.action(id, () => RevenueCatUI.presentCustomerCenter());
    await refresh();
  }, [id, refresh]);
  const tier = tierOf(customerInfo);
  return useMemo(() => ({ ready, error, tier, isPaid: tier !== 'free', hasSubscription: !!customerInfo && (customerInfo.activeSubscriptions.length > 0 || Object.keys(customerInfo.entitlements.active).length > 0), customerInfo, refresh, restore, purchase, getOfferings, presentCustomerCenter }), [ready, error, tier, customerInfo, refresh, restore, purchase, getOfferings, presentCustomerCenter]);
}
const PurchasesContext = createContext<ReturnType<typeof usePurchasesValue> | null>(null);
export function PurchasesProvider({ children }: { children: ReactNode }) {
  return <PurchasesContext.Provider value={usePurchasesValue()}>{children}</PurchasesContext.Provider>;
}
export function usePurchases() {
  const value = useContext(PurchasesContext);
  if (!value) throw new Error('usePurchases must be used within a PurchasesProvider');
  return value;
}
