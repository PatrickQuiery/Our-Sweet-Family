import { type Api } from './api';

export type DevicePlatform = 'ios' | 'android';

/**
 * Register this device's Expo push token with the API (Phase 3). The token itself
 * is obtained from `expo-notifications` (a native module added at the EAS-build
 * stage); this data layer is the API half and is ready ahead of that wiring.
 */
export async function registerDevice(api: Api, token: string, platform: DevicePlatform): Promise<void> {
  await api.post('/devices', { token, platform });
}

/** Unregister a token on sign-out. Token goes in the query (DELETE has no body here). */
export async function unregisterDevice(api: Api, token: string): Promise<void> {
  await api.del(`/devices?token=${encodeURIComponent(token)}`);
}
