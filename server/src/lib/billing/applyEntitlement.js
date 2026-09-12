async function findUser(prisma, appUserId) {
  if (!appUserId) return null;
  return await prisma.user.findUnique({ where: { id: appUserId } })
    || prisma.user.findUnique({ where: { clerkUserId: appUserId } });
}

async function applyEntitlement(prisma, user, mapped) {
  // Atomic compare-and-set also works across multiple API instances. Fetch order
  // does not imply response order; a slow older request must not undo a renewal.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ subscriptionSyncedAt: null }, { subscriptionSyncedAt: { lt: mapped.subscriptionSyncedAt } }] },
    data: {
      plan: mapped.plan,
      subscriptionStatus: mapped.subscriptionStatus,
      subscriptionStore: mapped.subscriptionStore,
      subscriptionProductId: mapped.subscriptionProductId,
      subscriptionExpiresAt: mapped.subscriptionExpiresAt,
      subscriptionWillRenew: mapped.subscriptionWillRenew,
      subscriptionSyncedAt: mapped.subscriptionSyncedAt,
      subscriptionManagementUrl: mapped.subscriptionManagementUrl,
      subscriptionSnapshot: mapped.subscriptionSnapshot,
    },
  });
  return count ? { applied: true, userId: user.id } : { applied: false, reason: 'stale_snapshot' };
}
module.exports = { applyEntitlement, findUser };
