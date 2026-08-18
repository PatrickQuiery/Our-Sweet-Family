jest.mock('../../lib/prisma');

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../lib/prisma');
const F = require('../lib/billing/fixtures');

const SECRET = 'whsec_test_secret';

describe('POST /api/billing/revenuecat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
    // Echo the queried id so per-user lookups (e.g. TRANSFER's from/to) resolve
    // to the right row rather than a single fixed user.
    prisma.user.findUnique.mockImplementation(async ({ where }) => ({ id: where.id || where.clerkUserId }));
    prisma.user.update.mockResolvedValue({});
  });

  const post = (body, auth) => {
    const r = request(app).post('/api/billing/revenuecat');
    if (auth !== undefined) r.set('Authorization', auth);
    return r.send(body);
  };

  it('rejects a request with no signature', async () => {
    const res = await post(F.initialPurchasePremiumAppStore);
    expect(res.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a wrong signature', async () => {
    const res = await post(F.initialPurchasePremiumAppStore, 'nope');
    expect(res.status).toBe(401);
  });

  it('refuses (500) when the webhook secret is not configured', async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const res = await post(F.initialPurchasePremiumAppStore, SECRET);
    expect(res.status).toBe(500);
  });

  it('upgrades a user to premium on INITIAL_PURCHASE', async () => {
    const res = await post(F.initialPurchasePremiumAppStore, SECRET);
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' }, data: expect.objectContaining({ plan: 'premium', subscriptionStatus: 'active' }) }),
    );
  });

  it('downgrades to free on EXPIRATION', async () => {
    const res = await post(F.expirationPremium, SECRET);
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'free', subscriptionStatus: 'expired' }) }),
    );
  });

  it('responds 200 (not 500) when the user is unknown, so RevenueCat stops retrying', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await post(F.initialPurchasePremiumAppStore, SECRET);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ applied: false, reason: 'user_not_found' });
  });

  it('responds 200 to unhandled event types (TEST pings) without updating', async () => {
    const res = await post(F.unhandledType, SECRET);
    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('moves the entitlement on TRANSFER (clears from, grants to)', async () => {
    const res = await post(F.transfer, SECRET);
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_old' }, data: expect.objectContaining({ plan: 'free' }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_new' }, data: expect.objectContaining({ plan: 'premium' }) }),
    );
  });

  it('returns 500 on a transient DB error so the event is retried', async () => {
    prisma.user.update.mockRejectedValueOnce(new Error('db down'));
    const res = await post(F.initialPurchasePremiumAppStore, SECRET);
    expect(res.status).toBe(500);
  });

  it('is idempotent — the same event twice yields the same update', async () => {
    await post(F.renewalPremiumPlayStore, SECRET);
    await post(F.renewalPremiumPlayStore, SECRET);
    const datas = prisma.user.update.mock.calls.map((c) => c[0].data.plan);
    expect(datas).toEqual(['premium', 'premium']);
  });
});

describe('GET /api/billing/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the current user plan + subscription fields', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'u@test.com', name: 'U', role: 'owner', plan: 'premium',
      subscriptionStatus: 'active', subscriptionStore: 'app_store',
      subscriptionProductId: 'osf_premium_monthly', subscriptionExpiresAt: new Date('2030-01-01'),
      subscriptionWillRenew: true,
    });

    const res = await request(app).get('/api/billing/status').set('x-clerk-user-id', 'clerk-test');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      plan: 'premium',
      effectivePlan: 'premium',
      subscriptionStatus: 'active',
      subscriptionStore: 'app_store',
      subscriptionWillRenew: true,
    });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).get('/api/billing/status');
    expect(res.status).toBe(401);
  });
});
