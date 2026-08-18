// Representative RevenueCat webhook event bodies (trimmed to fields we read).
// Shape: { event: { type, app_user_id, product_id, entitlement_ids, store, expiration_at_ms, ... } }

const EXP_MS = 1893456000000; // 2030-01-01, comfortably in the future

const wrap = (event) => ({ event, api_version: '1.0' });

module.exports = {
  EXP_MS,

  initialPurchasePremiumAppStore: wrap({
    type: 'INITIAL_PURCHASE',
    app_user_id: 'user_1',
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'APP_STORE',
    expiration_at_ms: EXP_MS,
  }),

  renewalPremiumPlayStore: wrap({
    type: 'RENEWAL',
    app_user_id: 'user_1',
    product_id: 'osf_premium_yearly',
    entitlement_ids: ['premium'],
    store: 'PLAY_STORE',
    expiration_at_ms: EXP_MS,
  }),

  productChangePlusToPremiumStripe: wrap({
    type: 'PRODUCT_CHANGE',
    app_user_id: 'user_1',
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'STRIPE',
    expiration_at_ms: EXP_MS,
  }),

  cancellationPremium: wrap({
    type: 'CANCELLATION',
    app_user_id: 'user_1',
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'APP_STORE',
    expiration_at_ms: EXP_MS,
  }),

  billingIssuePremium: wrap({
    type: 'BILLING_ISSUE',
    app_user_id: 'user_1',
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'APP_STORE',
    expiration_at_ms: EXP_MS,
  }),

  expirationPremium: wrap({
    type: 'EXPIRATION',
    app_user_id: 'user_1',
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    store: 'APP_STORE',
    expiration_at_ms: 1600000000000, // in the past
  }),

  initialPurchasePlus: wrap({
    type: 'INITIAL_PURCHASE',
    app_user_id: 'user_2',
    product_id: 'osf_plus_monthly',
    entitlement_ids: ['plus'],
    store: 'STRIPE',
    expiration_at_ms: EXP_MS,
  }),

  transfer: wrap({
    type: 'TRANSFER',
    store: 'APP_STORE',
    transferred_from: ['user_old'],
    transferred_to: ['user_new'],
    product_id: 'osf_premium_monthly',
    entitlement_ids: ['premium'],
    expiration_at_ms: EXP_MS,
  }),

  unknownProduct: wrap({
    type: 'INITIAL_PURCHASE',
    app_user_id: 'user_3',
    product_id: 'some_random_consumable',
    entitlement_ids: [],
    store: 'APP_STORE',
    expiration_at_ms: EXP_MS,
  }),

  unhandledType: wrap({
    type: 'TEST', // RevenueCat sends TEST pings from the dashboard
    app_user_id: 'user_1',
    store: 'APP_STORE',
  }),
};
