import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/clerk-expo';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { configureRevenueCat, purchasesSupported } from '../lib/purchases';
import { RC_ENTITLEMENT_ID } from '../lib/config';

export interface PurchasesContextValue {
  /** SDK configured + usable on this platform. */
  ready: boolean;
  /** Whether the RevenueCat `our_sweet_family_pro` entitlement is active (client-optimistic). */
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  /** Present the dashboard-configured paywall. Resolves true if the user purchased/restored. */
  presentPaywall: () => Promise<boolean>;
  /** Present the RevenueCat Customer Center (manage / cancel / restore / refunds). */
  presentCustomerCenter: () => Promise<void>;
  /** Restore prior purchases — App Store requires this be reachable. */
  restore: () => Promise<boolean>;
  /** Re-pull entitlement state from RevenueCat. */
  refresh: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

const hasPro = (info: CustomerInfo | null): boolean =>
  !!info?.entitlements.active[RC_ENTITLEMENT_ID];

/**
 * Owns the RevenueCat lifecycle: configure once, identify the Clerk user, and
 * keep entitlement state live. The backend `plan` (webhook-updated) stays the
 * authoritative gate for features; this SDK state drives the purchase flow and
 * an optimistic post-purchase UI. Mount once, under ClerkProvider.
 */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const identifiedFor = useRef<string | null>(null);

  // Configure once + subscribe to entitlement changes (renewals, expirations,
  // purchases made on another device all push updates here).
  useEffect(() => {
    if (!purchasesSupported) {
      setReady(false);
      return undefined;
    }
    const ok = configureRevenueCat();
    setReady(ok);
    if (!ok) return undefined;
    const onUpdate = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(onUpdate);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onUpdate);
    };
  }, []);

  // Identify the RevenueCat customer with our stable Clerk user id (so a purchase
  // is attributed to the right account across reinstalls / devices).
  useEffect(() => {
    if (!ready || !purchasesSupported) return;
    let alive = true;
    (async () => {
      try {
        if (isSignedIn && userId) {
          if (identifiedFor.current !== userId) {
            const { customerInfo: info } = await Purchases.logIn(userId);
            identifiedFor.current = userId;
            if (alive) setCustomerInfo(info);
          } else if (alive) {
            setCustomerInfo(await Purchases.getCustomerInfo());
          }
        } else if (identifiedFor.current) {
          await Purchases.logOut();
          identifiedFor.current = null;
          if (alive) setCustomerInfo(null);
        }
      } catch (e: any) {
        console.warn('[RevenueCat] identify failed:', e?.message ?? e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, isSignedIn, userId]);

  const refresh = useCallback(async () => {
    if (!ready || !purchasesSupported) return;
    try {
      setCustomerInfo(await Purchases.getCustomerInfo());
    } catch {
      /* transient — the update listener will catch up */
    }
  }, [ready]);

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    if (!purchasesSupported) return false;
    try {
      const result = await RevenueCatUI.presentPaywall();
      await refresh();
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (e: any) {
      console.warn('[RevenueCat] paywall error:', e?.message ?? e);
      return false;
    }
  }, [refresh]);

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    if (!purchasesSupported) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      await refresh();
    } catch (e: any) {
      console.warn('[RevenueCat] customer center error:', e?.message ?? e);
    }
  }, [refresh]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!purchasesSupported) return false;
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return hasPro(info);
    } catch (e: any) {
      console.warn('[RevenueCat] restore error:', e?.message ?? e);
      return false;
    }
  }, []);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      ready,
      isPro: hasPro(customerInfo),
      customerInfo,
      presentPaywall,
      presentCustomerCenter,
      restore,
      refresh,
    }),
    [ready, customerInfo, presentPaywall, presentCustomerCenter, restore, refresh],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within a PurchasesProvider');
  return ctx;
}
