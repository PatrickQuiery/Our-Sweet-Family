jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
import * as SecureStore from 'expo-secure-store';
import { tokenCache } from '../tokenCache';

describe('tokenCache', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok_123');
    await expect(tokenCache.getToken('key')).resolves.toBe('tok_123');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('key');
  });

  it('saves a token', async () => {
    await tokenCache.saveToken('key', 'tok_456');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('key', 'tok_456');
  });

  it('returns null when SecureStore throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(tokenCache.getToken('key')).resolves.toBeNull();
  });
});
