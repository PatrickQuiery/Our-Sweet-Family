// Persist a mapped entitlement change to the User row. Never throws on an unknown
// user (RevenueCat should get a 200 so it doesn't retry forever). `plan` is the
// only gate we flip; `planBoostUntil` (referral boost) is deliberately untouched,
// so effectivePlan() keeps resolving the max of the paid plan and any live boost.

async function findUser(prisma, appUserId) {
  if (!appUserId) return null;
  const byId = await prisma.user.findUnique({ where: { id: appUserId } });
  if (byId) return byId;
  return prisma.user.findUnique({ where: { clerkUserId: appUserId } });
}

async function applyEntitlement(prisma, mapped) {
  if (!mapped || mapped.ignored) return { applied: false, reason: 'ignored' };

  const user = await findUser(prisma, mapped.appUserId);
  if (!user) return { applied: false, reason: 'user_not_found' };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: mapped.plan,
      subscriptionStatus: mapped.subscriptionStatus ?? null,
      subscriptionStore: mapped.subscriptionStore ?? null,
      subscriptionProductId: mapped.subscriptionProductId ?? null,
      subscriptionExpiresAt: mapped.subscriptionExpiresAt ?? null,
      subscriptionWillRenew: mapped.subscriptionWillRenew ?? null,
    },
  });

  return { applied: true, userId: user.id, plan: mapped.plan };
}

module.exports = { applyEntitlement, findUser };
