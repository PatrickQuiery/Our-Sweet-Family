/** Secret API keys never belong in a native bundle. Test Store is opt-in outside dev. */
export function isNativePublicKey(key: string, platform: string, development: boolean, allowSandbox?: string): boolean {
  if (platform !== 'ios' && platform !== 'android') return false;
  if (key.trim() !== key) return false;
  if (/^test_[A-Za-z0-9]+$/.test(key)) return development || allowSandbox === 'true';
  return (platform === 'ios' ? /^appl_[A-Za-z0-9]+$/ : /^goog_[A-Za-z0-9]+$/).test(key);
}
