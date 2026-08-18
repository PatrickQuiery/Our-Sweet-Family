// Pure mapping from a RevenueCat webhook event to the entitlement changes we
// persist on the User row. No I/O — trivially unit-testable with fixtures.
//
// `plan` is the authoritative gate the rest of the app reads; the `subscription*`
// fields are descriptive (status/renewal for the manage-subscription UI).

// Entitlement identifiers configured in RevenueCat → our plan tiers. Overridable
// via env so we don't hardcode the dashboard naming.
const PREMIUM_ENT = process.env.REVENUECAT_PREMIUM_ENTITLEMENT || 'premium';
const PLUS_ENT = process.env.REVENUECAT_PLUS_ENTITLEMENT || 'plus';

const STORE_MAP = {
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  AMAZON: 'play_store',
  STRIPE: 'stripe',
  RC_BILLING: 'stripe',
  PROMOTIONAL: 'stripe',
};

// Event types that grant/keep active access.
const ACTIVE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
// Event types that end access.
const EXPIRE_TYPES = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);

function tierFor(event) {
  const ents = event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
  if (ents.includes(PREMIUM_ENT)) return 'premium';
  if (ents.includes(PLUS_ENT)) return 'plus';
  // Fallback: infer from the product identifier.
  const pid = String(event.product_id || '').toLowerCase();
  if (pid.includes('premium')) return 'premium';
  if (pid.includes('plus')) return 'plus';
  return null;
}

function storeFor(event) {
  return STORE_MAP[event.store] || null;
}

function expiresAtFor(event) {
  const ms = Number(event.expiration_at_ms);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
}

/**
 * Map a RevenueCat webhook body to an entitlement change.
 * Returns one of:
 *   - { ignored: true, type }                      — nothing to apply
 *   - { transfer: true, from, to, plan, ...fields } — move entitlement between users
 *   - { appUserId, plan, subscription* }            — apply to that user
 */
function mapEvent(body) {
  const event = body && body.event;
  if (!event || !event.type) return { ignored: true, type: null };
  const { type } = event;

  const tier = tierFor(event);
  const store = storeFor(event);
  const expiresAt = expiresAtFor(event);
  const productId = event.product_id || null;

  // TRANSFER carries no single app_user_id — it moves the entitlement between users.
  if (type === 'TRANSFER') {
    const from = (event.transferred_from || [])[0] || null;
    const to = (event.transferred_to || [])[0] || null;
    if (!from || !to || !tier) return { ignored: true, type };
    return {
      transfer: true,
      from,
      to,
      plan: tier,
      subscriptionStatus: 'active',
      subscriptionStore: store,
      subscriptionProductId: productId,
      subscriptionExpiresAt: expiresAt,
      subscriptionWillRenew: true,
    };
  }

  const base = {
    appUserId: event.app_user_id || null,
    subscriptionStore: store,
    subscriptionProductId: productId,
    subscriptionExpiresAt: expiresAt,
  };

  if (EXPIRE_TYPES.has(type)) {
    return { ...base, plan: 'free', subscriptionStatus: 'expired', subscriptionWillRenew: false };
  }

  // Everything below needs a known tier + user to be applicable.
  if (!tier || !base.appUserId) return { ignored: true, type };

  if (type === 'CANCELLATION') {
    // Auto-renew off (or refund) — keep access until expiry, flag as canceled.
    return { ...base, plan: tier, subscriptionStatus: 'canceled', subscriptionWillRenew: false };
  }
  if (type === 'BILLING_ISSUE') {
    // Payment failed but in grace — keep access, surface the issue.
    return { ...base, plan: tier, subscriptionStatus: 'billing_issue', subscriptionWillRenew: true };
  }
  if (ACTIVE_TYPES.has(type)) {
    return { ...base, plan: tier, subscriptionStatus: 'active', subscriptionWillRenew: type !== 'NON_RENEWING_PURCHASE' };
  }

  return { ignored: true, type };
}

module.exports = { mapEvent, tierFor, storeFor };
