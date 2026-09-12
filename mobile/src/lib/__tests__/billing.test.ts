import { canPurchase, classifyPackage, nativeManagementURL, type BillingStatus } from '../billing';
const status = { canManage: true, syncAvailable: true, hasSubscription: false } as BillingStatus;
test('checkout requires identified SDK, family owner and configured backend with no current subscription', () => {
  expect(canPurchase(status, true, false)).toBe(true);
  expect(canPurchase(null, true, false)).toBe(false);
  expect(canPurchase(status, false, false)).toBe(false);
  expect(canPurchase(status, true, true)).toBe(false);
  expect(canPurchase({ ...status, canManage: false }, true, false)).toBe(false);
  expect(canPurchase({ ...status, syncAvailable: false }, true, false)).toBe(false);
  expect(canPurchase({ ...status, hasSubscription: true }, true, false)).toBe(false);
});
test('native management never opens a web checkout', () => {
  expect(nativeManagementURL('app_store')).toContain('apps.apple.com');
  expect(nativeManagementURL('play_store')).toContain('play.google.com');
  expect(nativeManagementURL('stripe')).toBe(null);
  expect(nativeManagementURL('rc_billing')).toBe(null);
});
test('only explicitly supported products with correct cadence can be purchased', () => {
  const pkg = { identifier: '$rc_monthly', product: { identifier: 'plus_monthly' }, packageType: 'MONTHLY' };
  expect(classifyPackage(pkg)).toEqual({ tier: 'plus', period: 'monthly' });
  expect(classifyPackage({ ...pkg, packageType: 'ANNUAL' })).toBe(null);
  expect(classifyPackage({ ...pkg, product: { identifier: 'unknown_plus_monthly' } })).toBe(null);
  expect(classifyPackage({ ...pkg, product: { identifier: 'pro_monthly' } })).toBe(null);
});

test('current dashboard yearly products resolve to annual packages', () => {
  expect(classifyPackage({ identifier: '$rc_annual', product: { identifier: 'premium_yearly' }, packageType: 'ANNUAL' })).toEqual({ tier: 'premium', period: 'annual' });
});

test('custom dashboard packages use the exact product cadence', () => {
  expect(classifyPackage({ identifier: 'Plus Yearly', product: { identifier: 'plus_yearly' }, packageType: 'CUSTOM' })).toEqual({ tier: 'plus', period: 'annual' });
  expect(classifyPackage({ identifier: 'Premium Monthly', product: { identifier: 'premium_monthly' }, packageType: 'CUSTOM' })).toEqual({ tier: 'premium', period: 'monthly' });
  expect(classifyPackage({ identifier: 'Plus Yearly', product: { identifier: 'plus_yearly' }, packageType: 'MONTHLY' })).toBe(null);
});
