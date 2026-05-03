jest.mock('../../lib/prisma');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null, createdAt: new Date().toISOString() };
const otherUser = { id: 'other1', email: 'other@test.com', name: 'Other', role: 'owner', plan: 'free', avatarUrl: null, createdAt: new Date().toISOString() };

const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const otherToken = jwt.sign({ userId: 'other1' }, 'test-jwt-secret-key');

const mockFamily = { id: 'family1', name: 'Smith Family', ownerId: 'owner1', createdAt: new Date().toISOString(), children: [], members: [] };

describe('GET /api/families', () => {
  it('returns all families for authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findMany
      .mockResolvedValueOnce([mockFamily])   // owned families
      .mockResolvedValueOnce([]);            // member families

    const res = await request(app)
      .get('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.families).toHaveLength(1);
    expect(res.body.families[0].id).toBe('family1');
  });

  it('deduplicates families appearing in both owned and member queries', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findMany
      .mockResolvedValueOnce([mockFamily])
      .mockResolvedValueOnce([mockFamily]); // same family returned twice

    const res = await request(app)
      .get('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.families).toHaveLength(1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/families');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/families', () => {
  it('creates a family and returns it', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.create.mockResolvedValue(mockFamily);

    const res = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Smith Family' });

    expect(res.status).toBe(201);
    expect(res.body.family.name).toBe('Smith Family');
    expect(prisma.family.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Smith Family', ownerId: 'owner1' }),
    }));
  });

  it('returns 400 for empty name', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/families/:id', () => {
  it('returns the family for an owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/families/family1')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.family.id).toBe('family1');
  });

  it('returns 403 for a user who is neither owner nor member', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/families/family1')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent family', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/families/nope')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/families/:id', () => {
  it('updates family name when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.family.update.mockResolvedValue({ ...mockFamily, name: 'Jones Family' });

    const res = await request(app)
      .put('/api/families/family1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Jones Family' });

    expect(res.status).toBe(200);
    expect(res.body.family.name).toBe('Jones Family');
  });

  it('returns 403 when non-owner tries to update', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .put('/api/families/family1')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
  });
});
