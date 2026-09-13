import { isNativePublicKey } from '../purchaseKeys';
test('native SDK accepts only the public key for its platform', () => {
  expect(isNativePublicKey('appl_example', 'ios', false)).toBe(true);
  expect(isNativePublicKey('goog_example', 'android', false)).toBe(true);
  expect(isNativePublicKey('goog_example', 'ios', false)).toBe(false);
  expect(isNativePublicKey('appl_example', 'android', false)).toBe(false);
  expect(isNativePublicKey('appl_example', 'web', true)).toBe(false);
});
test('test store keys require development or an explicit dedicated sandbox build', () => {
  expect(isNativePublicKey('test_example', 'ios', false)).toBe(false);
  expect(isNativePublicKey('test_example', 'ios', true)).toBe(true);
  expect(isNativePublicKey('test_example', 'android', false, 'true')).toBe(true);
  expect(isNativePublicKey('test_example', 'ios', false, 'false')).toBe(false);
});
test.each(['', 'sk_example', 'rcb_example', 'secret', 'appl_', ' appl_example', 'appl_example\n'])('invalid or private key %s is rejected even in development', key => {
  expect(isNativePublicKey(key, 'ios', true, 'true')).toBe(false);
});
