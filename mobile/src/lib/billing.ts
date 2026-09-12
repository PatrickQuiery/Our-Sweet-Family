export interface BillingStatus {
  plan: string; effectivePlan: string; subscriptionStatus: string | null;
  subscriptionStore: string | null; subscriptionProductId: string | null;
  subscriptionExpiresAt: string | null; subscriptionWillRenew: boolean | null;
  canManage: boolean; hasSubscription: boolean; managementURL: string | null;
  syncAvailable: boolean; planBoostUntil: string | null;
}
export function nativeManagementURL(store: string | null): string | null {
  if (store === 'app_store' || store === 'mac_app_store') return 'https://apps.apple.com/account/subscriptions';
  if (store === 'play_store') return 'https://play.google.com/store/account/subscriptions';
  return null;
}
export function canPurchase(status: BillingStatus | null, ready: boolean, paid: boolean) {
  return !!status && status.canManage && status.syncAvailable && !status.hasSubscription && ready && !paid;
}
export function classifyPackage(pkg: { identifier: string; product: { identifier: string }; packageType: string }): { tier: 'plus' | 'premium'; period: 'monthly' | 'annual' } | null {
  for (const tier of ['plus', 'premium'] as const) for (const period of ['monthly', 'annual'] as const) {
    const names = [`${tier}_${period}`, ...(period === 'annual' ? [`${tier}_yearly`] : []), `${tier}.${period}`, `com.oursweetfamily.${tier}.${period}`];
    if (names.includes(pkg.product.identifier) && (pkg.packageType === 'CUSTOM' || pkg.packageType === (period === 'annual' ? 'ANNUAL' : 'MONTHLY'))) return { tier, period };
  }
  return null;
}
