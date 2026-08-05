import * as SecureStore from 'expo-secure-store';

/**
 * Shape Clerk's ClerkProvider expects for `tokenCache`. Declared inline (rather
 * than imported from @clerk/clerk-expo) so this module has no dependency on
 * Clerk being installed; structural typing satisfies ClerkProvider in Task 6.
 */
export interface TokenCache {
  getToken(key: string): Promise<string | null>;
  saveToken(key: string, value: string): Promise<void>;
}

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore write failures; Clerk will re-fetch a token
    }
  },
};
