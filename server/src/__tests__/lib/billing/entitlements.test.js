const { mapEvent } = require('../../../lib/billing/entitlements');
const F = require('./fixtures');

describe('mapEvent', () => {
  it('maps an initial premium purchase to an active premium entitlement', () => {
    const m = mapEvent(F.initialPurchasePremiumAppStore);
    expect(m).toMatchObject({
      appUserId: 'user_1',
      plan: 'premium',
      subscriptionStatus: 'active',
      subscriptionStore: 'app_store',
      subscriptionProductId: 'osf_premium_monthly',
      subscriptionWillRenew: true,
    });
    expect(m.subscriptionExpiresAt.getTime()).toBe(F.EXP_MS);
  });

  it('maps a renewal to active (play store)', () => {
    const m = mapEvent(F.renewalPremiumPlayStore);
    expect(m).toMatchObject({ plan: 'premium', subscriptionStatus: 'active', subscriptionStore: 'play_store' });
  });

  it('maps a product change (plus→premium) to active premium via stripe', () => {
    const m = mapEvent(F.productChangePlusToPremiumStripe);
    expect(m).toMatchObject({ plan: 'premium', subscriptionStatus: 'active', subscriptionStore: 'stripe' });
  });

  it('maps a cancellation to canceled but keeps the paid plan until expiry', () => {
    const m = mapEvent(F.cancellationPremium);
    expect(m).toMatchObject({ plan: 'premium', subscriptionStatus: 'canceled', subscriptionWillRenew: false });
  });

  it('maps a billing issue to billing_issue while keeping access', () => {
    const m = mapEvent(F.billingIssuePremium);
    expect(m).toMatchObject({ plan: 'premium', subscriptionStatus: 'billing_issue' });
  });

  it('maps an expiration to free/expired and no renewal', () => {
    const m = mapEvent(F.expirationPremium);
    expect(m).toMatchObject({ plan: 'free', subscriptionStatus: 'expired', subscriptionWillRenew: false });
  });

  it('maps the live our_sweet_family_pro entitlement to premium (top tier)', () => {
    const m = mapEvent({
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user_pro',
        entitlement_ids: ['our_sweet_family_pro'],
        product_id: 'yearly',
        store: 'APP_STORE',
        expiration_at_ms: F.EXP_MS,
      },
    });
    expect(m).toMatchObject({
      appUserId: 'user_pro',
      plan: 'premium',
      subscriptionStatus: 'active',
      subscriptionStore: 'app_store',
      subscriptionProductId: 'yearly',
      subscriptionWillRenew: true,
    });
  });

  it('falls back to premium from a bare monthly/yearly product id when entitlement ids are absent', () => {
    const m = mapEvent({
      event: { type: 'RENEWAL', app_user_id: 'user_pro', product_id: 'monthly', store: 'APP_STORE', expiration_at_ms: F.EXP_MS },
    });
    expect(m).toMatchObject({ plan: 'premium', subscriptionStatus: 'active' });
  });

  it('maps a plus purchase to the plus plan', () => {
    const m = mapEvent(F.initialPurchasePlus);
    expect(m).toMatchObject({ appUserId: 'user_2', plan: 'plus', subscriptionStatus: 'active' });
  });

  it('flags a transfer with from/to and the transferred entitlement', () => {
    const m = mapEvent(F.transfer);
    expect(m).toMatchObject({ transfer: true, from: 'user_old', to: 'user_new', plan: 'premium' });
  });

  it('ignores an event whose product maps to no known tier', () => {
    const m = mapEvent(F.unknownProduct);
    expect(m).toMatchObject({ ignored: true });
  });

  it('ignores unhandled event types (e.g. TEST pings)', () => {
    const m = mapEvent(F.unhandledType);
    expect(m).toMatchObject({ ignored: true });
  });
});
