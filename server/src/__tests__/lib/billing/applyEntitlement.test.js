jest.mock('../../../lib/prisma');

const prisma = require('../../../lib/prisma');
const { applyEntitlement } = require('../../../lib/billing/applyEntitlement');

const activePremium = {
  appUserId: 'user_1',
  plan: 'premium',
  subscriptionStatus: 'active',
  subscriptionStore: 'app_store',
  subscriptionProductId: 'osf_premium_monthly',
  subscriptionExpiresAt: new Date('2030-01-01'),
  subscriptionWillRenew: true,
};

describe('applyEntitlement', () => {
  it('writes the plan + subscription fields to a user found by id', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1' });
    const res = await applyEntitlement(prisma, activePremium);

    expect(res).toEqual({ applied: true, userId: 'user_1', plan: 'premium' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        plan: 'premium',
        subscriptionStatus: 'active',
        subscriptionStore: 'app_store',
        subscriptionProductId: 'osf_premium_monthly',
        subscriptionExpiresAt: activePremium.subscriptionExpiresAt,
        subscriptionWillRenew: true,
      },
    });
  });

  it('falls back to matching by clerkUserId', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce({ id: 'real_id' }); // by clerkUserId
    const res = await applyEntitlement(prisma, activePremium);

    expect(res).toMatchObject({ applied: true, userId: 'real_id' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'real_id' } }));
  });

  it('returns not-found (without throwing or updating) for an unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await applyEntitlement(prisma, activePremium);

    expect(res).toEqual({ applied: false, reason: 'user_not_found' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('skips ignored mappings', async () => {
    const res = await applyEntitlement(prisma, { ignored: true, type: 'TEST' });
    expect(res).toEqual({ applied: false, reason: 'ignored' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('expiration sets plan free but never clears the referral boost', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1' });
    await applyEntitlement(prisma, {
      appUserId: 'user_1',
      plan: 'free',
      subscriptionStatus: 'expired',
      subscriptionStore: 'app_store',
      subscriptionProductId: 'osf_premium_monthly',
      subscriptionExpiresAt: new Date('2020-01-01'),
      subscriptionWillRenew: false,
    });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.plan).toBe('free');
    expect(data).not.toHaveProperty('planBoostUntil');
  });
});
