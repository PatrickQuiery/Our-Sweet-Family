// Project the complete RevenueCat customer, never an individual transaction.
// Event payloads can be delayed, duplicated, or omit product data (TRANSFER).
const RANK = { free: 0, plus: 1, premium: 2 };
const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

function dateValue(value) {
  if (value === null) return null;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) throw new Error('Invalid RevenueCat date');
  return new Date(time).toISOString();
}
function safeManagementURL(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
function endDate(expiry, grace) {
  if (expiry === null) return null;
  return grace && Date.parse(grace) > Date.parse(expiry) ? grace : expiry;
}
const current = (record, now) => !record.refunded && (record.expiresAt === null || Date.parse(record.expiresAt) > now);

function projectSnapshot(snapshot, now = Date.now()) {
  const active = snapshot.entitlements.filter((e) => current(e, now))
    .sort((a, b) => RANK[b.plan] - RANK[a.plan] || (Date.parse(b.expiresAt) || Infinity) - (Date.parse(a.expiresAt) || Infinity));
  const subscriptions = snapshot.subscriptions.filter((s) => current(s, now));
  const selected = active[0];
  const sub = snapshot.subscriptions.find((s) => s.productId === selected?.productId) || subscriptions[0];
  const historical = snapshot.subscriptions.slice().sort((a,b) => (Date.parse(b.expiresAt)||0)-(Date.parse(a.expiresAt)||0))[0];
  const detail = sub || historical;
  const hasSubscription = subscriptions.length > 0;
  let status = detail ? 'expired' : null;
  if (sub && current(sub, now)) {
    status = sub.billingIssue ? (sub.graceUntil && Date.parse(sub.graceUntil) > now ? 'in_grace' : 'billing_issue')
      : sub.willRenew ? 'active' : 'canceled';
  } else if (selected) status = 'active';
  return {
    plan: selected?.plan || 'free',
    subscriptionStatus: status,
    subscriptionStore: detail?.store || selected?.store || null,
    subscriptionProductId: selected?.productId || detail?.productId || null,
    subscriptionExpiresAt: (selected?.expiresAt || detail?.expiresAt) ? new Date(selected?.expiresAt || detail?.expiresAt) : null,
    subscriptionWillRenew: sub && current(sub, now) ? sub.willRenew : false,
    hasSubscription,
  };
}

function mapSubscriber(body, { now = Date.now(), allowSandbox = false } = {}) {
  const subscriber = body?.subscriber;
  if (!isObject(subscriber) || !isObject(subscriber.entitlements) || !isObject(subscriber.subscriptions)
    || !Number.isFinite(body.request_date_ms) || body.request_date_ms <= 0 || body.request_date_ms > now + 300000) {
    throw new Error('Invalid RevenueCat customer snapshot');
  }
  const subscriptions = [];
  for (const [productId, s] of Object.entries(subscriber.subscriptions)) {
    if (!isObject(s) || typeof s.is_sandbox !== 'boolean') throw new Error('Invalid RevenueCat subscription');
    const expiry = dateValue(s.expires_date);
    const grace = dateValue(s.grace_period_expires_date ?? null);
    if (s.is_sandbox && !allowSandbox) continue;
    subscriptions.push({ productId, store: s.store || null, expiresAt: endDate(expiry, grace), graceUntil: grace,
      refunded: !!s.refunded_at, billingIssue: !!s.billing_issues_detected_at,
      willRenew: !s.unsubscribe_detected_at && !s.refunded_at && !s.auto_resume_date });
  }
  const entitlements = [];
  const premium = (process.env.REVENUECAT_PREMIUM_ENTITLEMENT || 'premium').split(',').map(s=>s.trim());
  const plus = (process.env.REVENUECAT_PLUS_ENTITLEMENT || 'plus').split(',').map(s=>s.trim());
  for (const [id, e] of Object.entries(subscriber.entitlements)) {
    const plan = premium.includes(id) ? 'premium' : plus.includes(id) ? 'plus' : null;
    if (!plan) continue;
    if (!isObject(e) || typeof e.product_identifier !== 'string' || !e.product_identifier) throw new Error('Invalid RevenueCat entitlement');
    const expiry = dateValue(e.expires_date);
    const grace = dateValue(e.grace_period_expires_date ?? null);
    const source = subscriber.subscriptions[e.product_identifier];
    const sub = subscriptions.find(s=>s.productId === e.product_identifier);
    if (source && !sub) continue; // excluded sandbox subscription
    const nonSubs = subscriber.non_subscriptions?.[e.product_identifier];
    if (!source && (!Array.isArray(nonSubs) || !nonSubs.some(p=>isObject(p) && !p.refunded_at && (p.is_sandbox === false || allowSandbox)))) continue;
    entitlements.push({ plan, productId:e.product_identifier, store:sub?.store || null,
      expiresAt:endDate(expiry, grace || sub?.graceUntil), refunded:sub?.refunded || false });
  }
  const subscriptionSnapshot = { version:1, entitlements, subscriptions };
  const projection = projectSnapshot(subscriptionSnapshot, now);
  return { ...projection, subscriptionSnapshot, subscriptionSyncedAt:new Date(body.request_date_ms),
    subscriptionManagementUrl:safeManagementURL(subscriber.management_url) };
}
module.exports = { mapSubscriber, projectSnapshot, safeManagementURL };
