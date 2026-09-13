const { prisma, truncateAll, makeUser } = require('./helpers');
const { applyEntitlement } = require('../lib/billing/applyEntitlement');
const { effectivePlan } = require('../lib/plan');
beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());
test('concurrent snapshots cannot roll back newer access and preserve referral rewards', async () => {
  const user = await makeUser();
  const boost = new Date(Date.now() + 86400000);
  await prisma.user.update({ where: { id: user.id }, data: { planBoostUntil: boost } });
  const snapshot = (plan, time) => ({ plan, subscriptionStatus: 'active', subscriptionStore: 'app_store',
    subscriptionProductId: `${plan}_monthly`, subscriptionExpiresAt: new Date(Date.now() + 60000),
    subscriptionWillRenew: true, subscriptionSyncedAt: new Date(time), subscriptionManagementUrl: null,
    subscriptionSnapshot: { version: 1, entitlements: [{ plan, productId: `${plan}_monthly`, expiresAt: new Date(Date.now()+60000).toISOString(), refunded: false }], subscriptions: [] } });
  const old = snapshot('plus', Date.now()-1000), latest = snapshot('premium', Date.now());
  await Promise.all([applyEntitlement(prisma,user,latest), applyEntitlement(prisma,user,old)]);
  expect((await applyEntitlement(prisma,user,old)).applied).toBe(false);
  const saved = await prisma.user.findUnique({ where: { id: user.id } });
  expect(saved.plan).toBe('premium');
  expect(saved.planBoostUntil).toEqual(boost);
  expect(effectivePlan(saved)).toBe('premium');
  expect(effectivePlan(saved, Date.now()+120000)).toBe('plus');
});
