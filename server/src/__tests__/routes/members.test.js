jest.mock('../../lib/prisma');
jest.mock('bcryptjs');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const memberUser = { id: 'member1', email: 'member@test.com', name: 'Member', role: 'loved_one', plan: 'free', avatarUrl: null };

const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const memberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');

const mockFamily = { id: 'family1', name: 'Smith Family', ownerId: 'owner1' };
const mockMember = {
  id: 'fm1',
  familyId: 'family1',
  userId: 'member1',
  permissions: 'view_only',
  accessPerChild: 'all',
  user: { id: 'member1', name: 'Member', email: 'member@test.com', avatarUrl: null },
};

describe('GET /api/members', () => {
  it('returns members when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.familyMember.findMany.mockResolvedValue([mockMember]);

    const res = await request(app)
      .get('/api/members?familyId=family1')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
  });

  it('returns 403 when a non-owner tries to list members', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/members?familyId=family1')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when familyId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/members', () => {
  it('invites an existing user by email', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(ownerUser)   // authenticate
      .mockResolvedValueOnce(memberUser); // find invitee
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.familyMember.findUnique.mockResolvedValue(null);
    prisma.familyMember.create.mockResolvedValue(mockMember);

    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ familyId: 'family1', email: 'member@test.com', permissions: 'view_only' });

    expect(res.status).toBe(201);
    expect(res.body.member.userId).toBe('member1');
  });

  it('creates a placeholder account when inviting an unknown email', async () => {
    bcrypt.hash.mockResolvedValue('temp_hash');
    prisma.user.findUnique
      .mockResolvedValueOnce(ownerUser)  // authenticate
      .mockResolvedValueOnce(null);      // invitee not found
    prisma.user.create.mockResolvedValue({ ...memberUser, id: 'new1', email: 'newbie@test.com' });
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.familyMember.findUnique.mockResolvedValue(null);
    prisma.familyMember.create.mockResolvedValue({ ...mockMember, userId: 'new1' });

    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ familyId: 'family1', email: 'newbie@test.com', permissions: 'view_only' });

    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('returns 409 when user is already a member', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(ownerUser)
      .mockResolvedValueOnce(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.familyMember.findUnique.mockResolvedValue(mockMember); // already exists

    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ familyId: 'family1', email: 'member@test.com', permissions: 'view_only' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid permission value', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ familyId: 'family1', email: 'member@test.com', permissions: 'invalid_perm' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when non-owner tries to invite', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ familyId: 'family1', email: 'new@test.com', permissions: 'view_only' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/members/:id', () => {
  const memberWithFamily = { ...mockMember, family: { ownerId: 'owner1' } };

  it('updates member permissions when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.familyMember.findUnique.mockResolvedValue(memberWithFamily);
    prisma.familyMember.update.mockResolvedValue({ ...mockMember, permissions: 'upload' });

    const res = await request(app)
      .put('/api/members/fm1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissions: 'upload' });

    expect(res.status).toBe(200);
    expect(res.body.member.permissions).toBe('upload');
  });

  it('returns 403 when non-owner tries to update member', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.familyMember.findUnique.mockResolvedValue(memberWithFamily);

    const res = await request(app)
      .put('/api/members/fm1')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ permissions: 'all' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/members/:id', () => {
  const memberWithFamily = { ...mockMember, family: { ownerId: 'owner1' } };

  it('removes a member when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.familyMember.findUnique.mockResolvedValue(memberWithFamily);
    prisma.familyMember.delete.mockResolvedValue(mockMember);

    const res = await request(app)
      .delete('/api/members/fm1')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when non-owner tries to remove a member', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.familyMember.findUnique.mockResolvedValue(memberWithFamily);

    const res = await request(app)
      .delete('/api/members/fm1')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
