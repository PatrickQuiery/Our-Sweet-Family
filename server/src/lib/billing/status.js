const { effectivePlan } = require('../plan');
const { projectSnapshot, safeManagementURL } = require('./entitlements');
function billingStatus(user, canManage = true, now = Date.now()) {
  const projected = user.subscriptionSnapshot?.version === 1 ? projectSnapshot(user.subscriptionSnapshot, now) : user;
  const expired = projected.subscriptionExpiresAt && new Date(projected.subscriptionExpiresAt).getTime() <= now;
  const hasSubscription = typeof projected.hasSubscription === 'boolean' ? projected.hasSubscription
    : !!(projected.subscriptionStatus && projected.plan !== 'free' && !expired);
  return {
    plan: expired && !user.subscriptionSnapshot ? 'free' : projected.plan || 'free',
    effectivePlan: effectivePlan(user, now),
    canManage,
    hasSubscription,
    subscriptionStatus: canManage ? (expired && !user.subscriptionSnapshot ? 'expired' : projected.subscriptionStatus ?? null) : null,
    subscriptionStore: canManage ? projected.subscriptionStore ?? null : null,
    subscriptionProductId: canManage ? projected.subscriptionProductId ?? null : null,
    subscriptionExpiresAt: canManage ? projected.subscriptionExpiresAt ?? null : null,
    subscriptionWillRenew: canManage ? (expired ? false : projected.subscriptionWillRenew ?? null) : null,
    managementURL: canManage ? safeManagementURL(user.subscriptionManagementUrl) : null,
    syncAvailable: !!process.env.REVENUECAT_API_KEY,
    planBoostUntil: canManage ? user.planBoostUntil ?? null : null,
  };
}
module.exports = { billingStatus };
