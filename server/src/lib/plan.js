// Effective plan = the base plan, upgraded to at least Plus while a temporary
// boost (the referral reward) is still active. Gating everywhere reads the
// effective plan, so a 90-day Plus reward transparently unlocks Plus features
// and reverts on its own when planBoostUntil passes.
const RANK = { free: 0, plus: 1, premium: 2 };

function effectivePlan(user) {
  const base = user?.plan || 'free';
  const boostActive =
    user?.planBoostUntil && new Date(user.planBoostUntil).getTime() > Date.now();
  if (boostActive && RANK.plus > (RANK[base] ?? 0)) return 'plus';
  return base;
}

module.exports = { effectivePlan };
