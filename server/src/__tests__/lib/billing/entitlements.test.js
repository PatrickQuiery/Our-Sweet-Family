const { mapSubscriber, projectSnapshot } = require('../../../lib/billing/entitlements');
const { effectivePlan } = require('../../../lib/plan');
const NOW = Date.parse('2026-09-12T12:00:00Z');
const future = '2026-10-12T12:00:00Z';
const past = '2026-08-12T12:00:00Z';
function snapshot(entitlements = {}, subscriptions = {}) {
  return { request_date_ms: NOW, subscriber: { entitlements, subscriptions, non_subscriptions: {}, management_url: 'https://apps.apple.com/account/subscriptions' } };
}
function entitlement(product, expires = future) { return { product_identifier: product, expires_date: expires, grace_period_expires_date: null, purchase_date: past }; }
function sub(overrides = {}) { return { store:'app_store', expires_date:future, is_sandbox:false, unsubscribe_detected_at:null, billing_issues_detected_at:null, grace_period_expires_date:null, refunded_at:null, ...overrides }; }

describe('RevenueCat customer projection', () => {
  it('uses entitlement names, not misleading product names, for access', () => {
    expect(mapSubscriber(snapshot({}, { premium_yearly: sub() }), {now:NOW}).plan).toBe('free');
  });
  it('keeps Premium when an unrelated Plus subscription has expired', () => {
    const data = snapshot({plus:entitlement('plus_monthly',past),premium:entitlement('premium_yearly')}, {plus_monthly:sub({expires_date:past}), premium_yearly:sub()});
    expect(mapSubscriber(data,{now:NOW})).toMatchObject({plan:'premium',subscriptionStatus:'active',subscriptionWillRenew:true});
  });
  it('cancellation keeps access to the paid-through date and stops renewal', () => {
    const data=snapshot({premium:entitlement('premium_yearly')},{premium_yearly:sub({unsubscribe_detected_at:past})});
    expect(mapSubscriber(data,{now:NOW})).toMatchObject({plan:'premium',subscriptionStatus:'canceled',subscriptionWillRenew:false});
  });
  it('billing trouble alone does not grant access after expiry', () => {
    const data=snapshot({premium:entitlement('premium_yearly',past)},{premium_yearly:sub({expires_date:past,billing_issues_detected_at:past})});
    expect(mapSubscriber(data,{now:NOW}).plan).toBe('free');
  });
  it('honors a real grace period and bounds access at its end', () => {
    const data=snapshot({premium:entitlement('premium_yearly',past)},{premium_yearly:sub({expires_date:past,billing_issues_detected_at:past,grace_period_expires_date:future})});
    const mapped=mapSubscriber(data,{now:NOW});
    expect(mapped).toMatchObject({plan:'premium',subscriptionStatus:'in_grace',subscriptionExpiresAt:new Date(future)});
    expect(projectSnapshot(mapped.subscriptionSnapshot,Date.parse(future)).plan).toBe('free');
  });
  it('revokes refunded access even if the entitlement has a future date', () => {
    const data=snapshot({premium:entitlement('premium_yearly')},{premium_yearly:sub({refunded_at:past})});
    expect(mapSubscriber(data,{now:NOW}).plan).toBe('free');
  });
  it('excludes sandbox grants unless explicitly enabled', () => {
    const data=snapshot({premium:entitlement('premium_yearly')},{premium_yearly:sub({is_sandbox:true})});
    expect(mapSubscriber(data,{now:NOW}).plan).toBe('free');
    expect(mapSubscriber(data,{now:NOW,allowSandbox:true}).plan).toBe('premium');
  });
  it('falls back to still-valid Plus automatically when Premium expires between webhooks', () => {
    const data=snapshot({premium:entitlement('premium_monthly','2026-09-13T00:00:00Z'),plus:entitlement('plus_yearly')},{premium_monthly:sub({expires_date:'2026-09-13T00:00:00Z'}),plus_yearly:sub()});
    const mapped=mapSubscriber(data,{now:NOW});
    expect(effectivePlan(mapped,Date.parse('2026-09-14T00:00:00Z'))).toBe('plus');
  });
  it('never converts malformed customer data into a free-plan write', () => {
    for (const data of [{}, {subscriber:{}}, snapshot({premium:{product_identifier:'premium_yearly',expires_date:'bad'}})]) {
      expect(()=>mapSubscriber(data,{now:NOW})).toThrow();
    }
  });
  it('does not expose unsafe management URLs', () => {
    const data=snapshot({plus:entitlement('plus_yearly')},{plus_yearly:sub()});
    data.subscriber.management_url='javascript:alert(1)';
    expect(mapSubscriber(data,{now:NOW}).subscriptionManagementUrl).toBeNull();
  });
  it('keeps referral access after subscription expiration', () => {
    const data=snapshot({plus:entitlement('plus_yearly',past)},{plus_yearly:sub({expires_date:past})});
    const mapped=mapSubscriber(data,{now:NOW});
    expect(effectivePlan({...mapped,planBoostUntil:future},NOW)).toBe('plus');
  });
});
