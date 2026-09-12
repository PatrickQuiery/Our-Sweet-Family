const { projectSnapshot } = require('./billing/entitlements');
const RANK = { free: 0, plus: 1, premium: 2 };

function effectivePlan(user, now = Date.now()) {
  let base = user?.plan || 'free';
  if (user?.subscriptionSnapshot?.version === 1) {
    base = projectSnapshot(user.subscriptionSnapshot, now).plan;
  } else if (user?.subscriptionStatus && user?.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() <= now) {
    base = 'free';
  }
  const boostActive = user?.planBoostUntil && new Date(user.planBoostUntil).getTime() > now;
  return boostActive && RANK.plus > (RANK[base] ?? 0) ? 'plus' : base;
}
module.exports = { effectivePlan };
