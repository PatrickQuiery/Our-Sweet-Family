jest.mock('../../lib/prisma');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const otherUser = { id: 'other1', email: 'other@test.com', name: 'Other', role: 'owner', plan: 'free', avatarUrl: null };

const mockFamily = {
  id: 'family1', name: 'Smith', ownerId: 'owner1',
  members: [{ id: 'fm1', userId: 'member1', permissions: 'view_only', accessPerChild: 'all' }],
};

const mem = {
  id: 'mem1', fileUrl: 'http://ex.com/p.jpg', thumbnailUrl: null, fileType: 'photo',
  createdAt: new Date('2026-08-01T00:00:00Z'), uploadedById: 'owner1',
  uploadedBy: { id: 'owner1', name: 'Owner', avatarUrl: null },
};

describe('GET /api/activity', () => {
  it('returns a unified, newest-first feed of loves, comments and new memories', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.findMany.mockResolvedValue([mem]);
    prisma.reaction.findMany.mockResolvedValue([
      { id: 'r1', memoryId: 'mem1', createdAt: new Date('2026-08-10T00:00:00Z'), user: { id: 'member1', name: 'Gran', avatarUrl: null } },
    ]);
    prisma.comment.findMany.mockResolvedValue([
      { id: 'c1', memoryId: 'mem1', text: 'So cute!', createdAt: new Date('2026-08-05T00:00:00Z'), user: { id: 'member1', name: 'Gran', avatarUrl: null } },
    ]);

    const res = await request(app).get('/api/activity?familyId=family1').set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.activity.map((a) => a.type)).toEqual(['love', 'comment', 'memory']); // newest first
    expect(res.body.activity[0]).toMatchObject({ type: 'love', actor: { name: 'Gran' }, memory: { id: 'mem1' } });
    expect(res.body.activity[1]).toMatchObject({ type: 'comment', text: 'So cute!' });
    expect(res.body.pagination.total).toBe(3);
  });

  it('returns 400 when familyId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    const res = await request(app).get('/api/activity').set('x-clerk-user-id', 'clerk-test');
    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-member', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    const res = await request(app).get('/api/activity?familyId=family1').set('x-clerk-user-id', 'clerk-test');
    expect(res.status).toBe(403);
  });
});
