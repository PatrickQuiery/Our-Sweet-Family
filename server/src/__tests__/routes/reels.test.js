jest.mock('../../lib/prisma');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const freeUser = { id: 'user1', email: 'u@t.com', name: 'User', role: 'owner', plan: 'free', avatarUrl: null };
const plusUser = { id: 'user2', email: 'p@t.com', name: 'Plus', role: 'owner', plan: 'plus', avatarUrl: null };
const premUser = { id: 'user3', email: 'r@t.com', name: 'Prem', role: 'owner', plan: 'premium', avatarUrl: null };

const freeToken = jwt.sign({ userId: 'user1' }, 'test-jwt-secret-key');
const plusToken = jwt.sign({ userId: 'user2' }, 'test-jwt-secret-key');
const premToken = jwt.sign({ userId: 'user3' }, 'test-jwt-secret-key');

const mockFamily = { id: 'family1', name: 'Smith', ownerId: 'user1', members: [] };
const mockFamilyForPlus = { ...mockFamily, ownerId: 'user2' };
const mockFamilyForPrem = { ...mockFamily, ownerId: 'user3' };

function makeMemory(year, month, day) {
  return {
    id: `mem-${year}-${month}-${day}`,
    familyId: 'family1',
    capturedAt: new Date(year, month - 1, day).toISOString(),
    isClassified: false,
    childIds: [],
  };
}

describe('GET /api/reels', () => {
  it('returns 400 when familyId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(freeUser);

    const res = await request(app)
      .get('/api/reels')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent family', async () => {
    prisma.user.findUnique.mockResolvedValue(freeUser);
    prisma.family.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/reels?familyId=ghost')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(404);
  });

  it('returns annual reels for free plan users', async () => {
    prisma.user.findUnique.mockResolvedValue(freeUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.findMany.mockResolvedValue([
      makeMemory(2022, 3, 10),
      makeMemory(2022, 8, 20),
      makeMemory(2023, 1, 5),
    ]);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=annual')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reels).toHaveLength(2); // 2022 and 2023
    expect(res.body.reels[0].key).toBe('2023'); // sorted desc
    expect(res.body.reels[0].memories).toHaveLength(1);
    expect(res.body.reels[1].key).toBe('2022');
    expect(res.body.reels[1].memories).toHaveLength(2);
  });

  it('returns 403 for monthly reels on free plan', async () => {
    prisma.user.findUnique.mockResolvedValue(freeUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=monthly')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/plus or premium/i);
  });

  it('returns monthly reels for plus plan users', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.family.findUnique.mockResolvedValue(mockFamilyForPlus);
    prisma.memory.findMany.mockResolvedValue([
      makeMemory(2023, 1, 5),
      makeMemory(2023, 1, 20),
      makeMemory(2023, 3, 10),
    ]);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=monthly')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reels).toHaveLength(2); // Jan 2023 and Mar 2023
  });

  it('returns 403 for birthday reels on plus plan', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.family.findUnique.mockResolvedValue(mockFamilyForPlus);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=birthday')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/premium/i);
  });

  it('returns birthday reels for premium plan', async () => {
    prisma.user.findUnique.mockResolvedValue(premUser);
    prisma.family.findUnique.mockResolvedValue(mockFamilyForPrem);
    prisma.memory.findMany.mockResolvedValue([
      makeMemory(2022, 4, 15), // birthday key: 04-15
      makeMemory(2023, 4, 15), // same key
      makeMemory(2023, 6, 1),  // different key
    ]);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=birthday')
      .set('Authorization', `Bearer ${premToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reels).toHaveLength(2);
    const labels = res.body.reels.map((r) => r.label);
    expect(labels.some((l) => l.includes('04-15'))).toBe(true);
  });

  it('returns 403 for holiday reels on free plan', async () => {
    prisma.user.findUnique.mockResolvedValue(freeUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=holiday')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(403);
  });

  it('groups holiday memories by season', async () => {
    prisma.user.findUnique.mockResolvedValue(premUser);
    prisma.family.findUnique.mockResolvedValue(mockFamilyForPrem);
    prisma.memory.findMany.mockResolvedValue([
      makeMemory(2022, 12, 25), // Christmas
      makeMemory(2023, 10, 31), // Halloween
      makeMemory(2023, 12, 23), // Christmas
    ]);

    const res = await request(app)
      .get('/api/reels?familyId=family1&type=holiday')
      .set('Authorization', `Bearer ${premToken}`);

    expect(res.status).toBe(200);
    const keys = res.body.reels.map((r) => r.key);
    expect(keys).toContain('Christmas');
    expect(keys).toContain('Halloween');
  });
});
