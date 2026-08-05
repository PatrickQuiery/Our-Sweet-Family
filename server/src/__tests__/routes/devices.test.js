jest.mock('../../lib/prisma');

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const user = { id: 'u1', email: 'u@test.com', name: 'U', role: 'owner', plan: 'free' };

describe('POST /api/devices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
  });

  it('registers (upserts) a device token for the current user', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({ id: 'd1', platform: 'ios' });

    const res = await request(app)
      .post('/api/devices')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ token: 'ExponentPushToken[abc]', platform: 'ios' });

    expect(res.status).toBe(201);
    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExponentPushToken[abc]' },
        create: { token: 'ExponentPushToken[abc]', platform: 'ios', userId: 'u1' },
      }),
    );
  });

  it('rejects an unsupported platform', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ token: 'ExponentPushToken[abc]', platform: 'windows' });

    expect(res.status).toBe(400);
    expect(prisma.deviceToken.upsert).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/devices').send({ token: 'x', platform: 'ios' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/devices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
  });

  it('unregisters a token scoped to the current user', async () => {
    prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete('/api/devices')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ token: 'ExponentPushToken[abc]' });

    expect(res.status).toBe(200);
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc]', userId: 'u1' },
    });
  });

  it('400s without a token', async () => {
    const res = await request(app).delete('/api/devices').set('x-clerk-user-id', 'clerk-test').send({});
    expect(res.status).toBe(400);
  });
});
