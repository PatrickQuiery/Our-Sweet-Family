jest.mock('../../lib/prisma');

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const referee = { id: 'ref1', email: 'ref@test.com', name: 'Ref', role: 'owner', plan: 'free', planBoostUntil: null, referralCode: null };
const referrer = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', planBoostUntil: null, referralCode: 'GRANDMA7' };

describe('GET /api/referrals/me', () => {
  it('generates and returns a referral code when the user has none', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...referee }) // authenticate
      .mockResolvedValueOnce(null);          // code availability check -> free
    prisma.user.update.mockResolvedValue({ ...referee, referralCode: 'NEWCODE1' });
    prisma.referral.count.mockResolvedValue(0);

    const res = await request(app).get('/api/referrals/me').set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(typeof res.body.code).toBe('string');
    expect(res.body.code.length).toBeGreaterThan(0);
    expect(res.body.count).toBe(0);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('returns the existing code without regenerating', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ ...referrer }); // authenticate
    prisma.referral.count.mockResolvedValue(3);

    const res = await request(app).get('/api/referrals/me').set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('GRANDMA7');
    expect(res.body.count).toBe(3);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/referrals/complete', () => {
  it('completes the referral and rewards both sides with a plan boost', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...referee })                 // authenticate
      .mockResolvedValueOnce({ ...referrer })                // referrer by code
      .mockResolvedValueOnce({ planBoostUntil: null })       // grant -> referrer
      .mockResolvedValueOnce({ planBoostUntil: null });      // grant -> referee
    prisma.referral.findUnique.mockResolvedValue(null);      // not already referred
    prisma.family.count.mockResolvedValue(1);                // referee owns a family
    prisma.referral.create.mockResolvedValue({ id: 'r1' });
    prisma.user.update.mockResolvedValue({ planBoostUntil: new Date().toISOString() });

    const res = await request(app)
      .post('/api/referrals/complete')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ code: 'GRANDMA7' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(prisma.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ referrerId: 'owner1', refereeId: 'ref1' }) })
    );
    // both sides rewarded
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it('rejects a self-referral', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...referee })                     // authenticate
      .mockResolvedValueOnce({ ...referee, referralCode: 'SELF' }); // code resolves to same user
    prisma.referral.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/referrals/complete')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ code: 'SELF' });

    expect(res.status).toBe(400);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('is idempotent — a user already referred is not rewarded again', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ ...referee }); // authenticate
    prisma.referral.findUnique.mockResolvedValue({ id: 'r0', refereeId: 'ref1' });

    const res = await request(app)
      .post('/api/referrals/complete')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ code: 'GRANDMA7' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('already_referred');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('requires the referee to have created a family (anti-farming)', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...referee })  // authenticate
      .mockResolvedValueOnce({ ...referrer }); // referrer by code
    prisma.referral.findUnique.mockResolvedValue(null);
    prisma.family.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/referrals/complete')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ code: 'GRANDMA7' });

    expect(res.status).toBe(400);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an invalid code', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...referee }) // authenticate
      .mockResolvedValueOnce(null);          // no referrer for code
    prisma.referral.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/referrals/complete')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ code: 'NOPE' });

    expect(res.status).toBe(404);
  });
});
