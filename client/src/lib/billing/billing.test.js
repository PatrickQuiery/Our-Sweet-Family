import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPackage, managementUrl, checkoutAvailable, syncPurchase, createIdentityAdapter, validateWebKey } from './billing.js';

const pkg = (id, period = 'P1M') => ({ identifier: id, webBillingProduct: { identifier: id, normalPeriodDuration: period, price: { formattedPrice: '$6.10' } } });
describe('billing purchase boundaries', () => {
  it('maps exact configured packages and rejects unknown, contradictory or unpriced products', () => {
    assert.equal(classifyPackage(pkg('plus_monthly')).tier, 'plus');
    assert.equal(classifyPackage(pkg('premium_annual', 'P1Y')).period, 'annual');
    assert.equal(classifyPackage({ ...pkg('plus_yearly', 'P1Y'), identifier: 'Plus Yearly' }).period, 'annual');
    assert.equal(classifyPackage({ ...pkg('plus_monthly'), identifier: 'premium_monthly' }), null);
    assert.equal(classifyPackage(pkg('fake_plus_monthly')), null);
    assert.equal(classifyPackage(pkg('plus_monthly', 'P1Y')), null);
    assert.equal(classifyPackage({ identifier: 'plus_monthly' }), null);
  });
  it('requires owner, trusted sync and no current subscription', () => {
    const status = { canManage: true, syncAvailable: true, hasSubscription: false };
    assert.equal(checkoutAvailable(status), true);
    assert.equal(checkoutAvailable({ ...status, canManage: false }), false);
    assert.equal(checkoutAvailable({ ...status, hasSubscription: true }), false);
    assert.equal(checkoutAvailable({ ...status, syncAvailable: false }), false);
  });
  it('uses secure owner-only management links and originating store fallbacks', () => {
    assert.equal(managementUrl({ canManage: false, managementURL: 'https://example.com' }), null);
    assert.equal(managementUrl({ canManage: true, managementURL: 'javascript:alert(1)' }), null);
    assert.match(managementUrl({ canManage: true, subscriptionStore: 'APP_STORE' }), /apps.apple.com/);
    assert.equal(managementUrl({ canManage: true, managementURL: 'https://billing.example.com' }), 'https://billing.example.com/');
  });
  it('rejects secrets and sandbox keys unless explicitly allowed', () => {
    assert.equal(validateWebKey('sk_secret', false), false);
    assert.equal(validateWebKey('test_public', false), false);
    assert.equal(validateWebKey('test_public', true), true);
    assert.equal(validateWebKey('rcb_public', false), true);
  });
  it('keeps purchase pending when server never confirms entitlement', async () => {
    let calls = 0;
    const result = await syncPurchase(async () => { calls++; throw Error('unavailable'); }, 'plus', async () => {});
    assert.equal(calls, 3);
    assert.equal(result.confirmed, false);
    assert.equal((await syncPurchase(async () => ({ plan: 'premium', hasSubscription: true }), 'premium')).confirmed, true);
  });
  it('discards an old identity result and serializes account changes', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const changes = [];
    const instance = { changeUser: async id => { changes.push(id); }, getOfferings: async () => { await gate; return 'old private result'; } };
    const adapter = createIdentityAdapter(() => instance);
    adapter.setIdentity('user_a');
    const first = adapter.run('user_a', sdk => sdk.getOfferings());
    await new Promise(resolve => setTimeout(resolve, 0));
    adapter.setIdentity('user_b');
    const second = adapter.run('user_b', () => 'new result');
    release();
    await assert.rejects(first, /account changed/i);
    assert.equal(await second, 'new result');
    assert.deepEqual(changes, ['user_b']);
    await assert.rejects(adapter.run('user_a', () => 'wrong'), /account changed/i);
  });
});
