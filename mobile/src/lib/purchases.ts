import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from './config';

/** RevenueCat's native SDK only runs on iOS/Android — guard so `expo start --web` won't crash. */
export const purchasesSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

function apiKey(): string {
  return Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
}

/**
 * Configure the RevenueCat SDK exactly once. Idempotent and safe to call on every
 * mount. Returns whether the SDK is usable (key present + supported platform).
 */
export function configureRevenueCat(): boolean {
  if (configured) return true;
  if (!purchasesSupported) return false;
  const key = apiKey();
  if (!key) {
    console.warn('[RevenueCat] No API key — set EXPO_PUBLIC_REVENUECAT_KEY in mobile/.env / EAS.');
    return false;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  // App user id is set later via logIn(clerkUserId); configuring anonymously first
  // is fine — the anonymous customer aliases into the identified one on logIn.
  Purchases.configure({ apiKey: key });
  configured = true;
  return true;
}
