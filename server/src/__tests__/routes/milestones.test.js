jest.mock('../../lib/prisma');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const plusUser = { id: 'plus1', email: 'plus@test.com', name: 'Plus', role: 'owner', plan: 'plus', avatarUrl: null };
const memberUser = { id: 'member1', email: 'member@test.com', name: 'Member', role: 'loved_one', plan: 'free', avatarUrl: null };

const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const plusToken = jwt.sign({ userId: 'plus1' }, 'test-jwt-secret-key');
const memberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');

const mockChild = {
  id: 'child1', familyId: 'family1', name: 'Alice', dateOfBirth: '2020-01-01',
  family: {
    id: 'family1', ownerId: 'owner1',
    members: [{ userId: 'member1' }],
  },
};
const mockChildForPlus = {
  ...mockChild,
  family: { ...mockChild.family, ownerId: 'plus1' },
};

const mockMilestone = {
  id: 'ms1', childId: 'child1', type: 'height', value: '75', unit: 'cm',
  note: null, date: '2022-06-01', createdAt: new Date().toISOString(),
};

describe('GET /api/milestones', () => {
  it('returns 403 for free plan users', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.child.findUnique.mockResolvedValue(mockChild);

    const res = await request(app)
      .get('/api/milestones?childId=child1')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/plus or premium/i);
  });

  it('returns milestones for plus plan users', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.child.findUnique.mockResolvedValue(mockChildForPlus);
    prisma.milestone.findMany.mockResolvedValue([mockMilestone]);

    const res = await request(app)
      .get('/api/milestones?childId=child1')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(200);
    expect(res.body.milestones).toHaveLength(1);
  });

  it('returns 400 when childId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);

    const res = await request(app)
      .get('/api/milestones')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 403 for non-member user', async () => {
    const nonMemberUser = { id: 'other1', plan: 'plus', email: 'o@t.com', name: 'Other', role: 'owner', avatarUrl: null };
    const nonMemberToken = jwt.sign({ userId: 'other1' }, 'test-jwt-secret-key');

    prisma.user.findUnique.mockResolvedValue(nonMemberUser);
    prisma.child.findUnique.mockResolvedValue(mockChild); // family ownerId is 'owner1', not 'other1'

    const res = await request(app)
      .get('/api/milestones?childId=child1')
      .set('Authorization', `Bearer ${nonMemberToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/milestones', () => {
  it('returns 403 for free plan users', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ childId: 'child1', type: 'height', value: '75', date: '2022-06-01' });

    expect(res.status).toBe(403);
  });

  it('creates a milestone for plus plan owner', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.child.findUnique.mockResolvedValue({
      ...mockChild,
      family: { ownerId: 'plus1' },
    });
    prisma.milestone.create.mockResolvedValue(mockMilestone);

    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ childId: 'child1', type: 'height', value: '75', unit: 'cm', date: '2022-06-01' });

    expect(res.status).toBe(201);
    expect(res.body.milestone.type).toBe('height');
  });

  it('returns 400 for missing required fields', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);

    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ childId: 'child1', type: 'height' }); // missing value and date

    expect(res.status).toBe(400);
  });

  it('returns 403 when member (not owner) tries to add milestone', async () => {
    const plusMember = { ...memberUser, plan: 'plus' };
    const plusMemberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');

    prisma.user.findUnique.mockResolvedValue(plusMember);
    prisma.child.findUnique.mockResolvedValue({
      ...mockChild,
      family: { ownerId: 'owner1' }, // member1 is not owner
    });

    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${plusMemberToken}`)
      .send({ childId: 'child1', type: 'height', value: '75', date: '2022-06-01' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/milestones/:id', () => {
  const milestoneWithChild = {
    ...mockMilestone,
    child: { family: { ownerId: 'plus1' } },
  };

  it('deletes milestone when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.milestone.findUnique.mockResolvedValue(milestoneWithChild);
    prisma.milestone.delete.mockResolvedValue(mockMilestone);

    const res = await request(app)
      .delete('/api/milestones/ms1')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent milestone', async () => {
    prisma.user.findUnique.mockResolvedValue(plusUser);
    prisma.milestone.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/milestones/ghost')
      .set('Authorization', `Bearer ${plusToken}`);

    expect(res.status).toBe(404);
  });
});
