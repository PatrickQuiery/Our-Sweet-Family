jest.mock('../../lib/prisma');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const memberUser = { id: 'member1', email: 'member@test.com', name: 'Member', role: 'loved_one', plan: 'free', avatarUrl: null };
const otherUser = { id: 'other1', email: 'other@test.com', name: 'Other', role: 'owner', plan: 'free', avatarUrl: null };

const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const memberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');
const otherToken = jwt.sign({ userId: 'other1' }, 'test-jwt-secret-key');

const mockFamily = { id: 'family1', name: 'Smith Family', ownerId: 'owner1', members: [{ userId: 'member1' }] };
const mockChild = { id: 'child1', familyId: 'family1', name: 'Alice', dateOfBirth: '2020-03-15', avatarUrl: null };

describe('GET /api/children', () => {
  it('returns children for family owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.child.findMany.mockResolvedValue([mockChild]);

    const res = await request(app)
      .get('/api/children?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.children).toHaveLength(1);
    expect(res.body.children[0].name).toBe('Alice');
  });

  it('returns children for family member', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.child.findMany.mockResolvedValue([mockChild]);

    const res = await request(app)
      .get('/api/children?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.children).toHaveLength(1);
  });

  it('returns 403 for non-member users', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/children?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('returns 400 when familyId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .get('/api/children')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(400);
  });
});

describe('POST /api/children', () => {
  it('creates a child when called by family owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.child.create.mockResolvedValue(mockChild);

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'family1', name: 'Alice', dateOfBirth: '2020-03-15' });

    expect(res.status).toBe(201);
    expect(res.body.child.name).toBe('Alice');
  });

  it('creates a child with a gender when provided', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.child.create.mockResolvedValue({ ...mockChild, gender: 'female' });

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'family1', name: 'Alice', dateOfBirth: '2020-03-15', gender: 'female' });

    expect(res.status).toBe(201);
    expect(res.body.child.gender).toBe('female');
    expect(prisma.child.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'female' }) })
    );
  });

  it('rejects an invalid gender value', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'family1', name: 'Alice', dateOfBirth: '2020-03-15', gender: 'other' });

    expect(res.status).toBe(400);
    expect(prisma.child.create).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner tries to add a child', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'family1', name: 'Bob', dateOfBirth: '2021-05-10' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid date format', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'family1', name: 'Alice', dateOfBirth: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when family does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/children')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ familyId: 'ghost', name: 'Alice', dateOfBirth: '2020-03-15' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/children/:id', () => {
  const childWithFamily = { ...mockChild, family: { ownerId: 'owner1' } };

  it('updates a child when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.child.findUnique.mockResolvedValue(childWithFamily);
    prisma.child.update.mockResolvedValue({ ...mockChild, name: 'Alicia' });

    const res = await request(app)
      .put('/api/children/child1')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ name: 'Alicia' });

    expect(res.status).toBe(200);
    expect(res.body.child.name).toBe('Alicia');
  });

  it('updates a child gender when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.child.findUnique.mockResolvedValue(childWithFamily);
    prisma.child.update.mockResolvedValue({ ...mockChild, gender: 'male' });

    const res = await request(app)
      .put('/api/children/child1')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ gender: 'male' });

    expect(res.status).toBe(200);
    expect(res.body.child.gender).toBe('male');
    expect(prisma.child.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'male' }) })
    );
  });

  it('returns 403 when non-owner tries to update', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.child.findUnique.mockResolvedValue(childWithFamily);

    const res = await request(app)
      .put('/api/children/child1')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/children/:id', () => {
  const childWithFamily = { ...mockChild, family: { ownerId: 'owner1' } };

  it('deletes a child when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.child.findUnique.mockResolvedValue(childWithFamily);
    prisma.child.delete.mockResolvedValue(mockChild);
    // No memories tagged with the deleted child → nothing to strip.
    prisma.memory.findMany.mockResolvedValue([]);

    const res = await request(app)
      .delete('/api/children/child1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when non-owner tries to delete', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.child.findUnique.mockResolvedValue(childWithFamily);

    const res = await request(app)
      .delete('/api/children/child1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent child', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.child.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/children/ghost')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(404);
  });
});
