export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
export const API_ROOT = `${API_BASE_URL}/api`;

// RevenueCat public SDK keys. Safe to ship in the client (public, not secret).
// A single `test_`/project key works across platforms; per-store keys override it.
// Set EXPO_PUBLIC_REVENUECAT_KEY (or the per-platform vars) in mobile/.env + EAS.
export const REVENUECAT_IOS_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';
export const REVENUECAT_ANDROID_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';

// The single paid entitlement configured in the RevenueCat dashboard.
export const RC_ENTITLEMENT_ID = 'our_sweet_family_pro';
