jest.mock('../../lib/prisma');
jest.mock('bcryptjs');
jest.mock('../../lib/mailer', () => ({ sendMail: jest.fn().mockResolvedValue({ sent: true }) }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const memberUser = { id: 'member1', email: 'member@test.com', name: 'Member', role: 'loved_one', plan: 'free', avatarUrl: null };
const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const memberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const pendingInvite = {
  id: 'inv1', familyId: 'family1', email: 'newbie@test.com',
  permissions: 'view_only', accessPerChild: 'all',
  tokenHash: 'hashed', invitedById: 'owner1',
  expiresAt: future, acceptedAt: null,
  family: { name: 'Smith Family', owner: { name: 'Owner' } },
};

// ─── GET /api/invitations/:token (public info) ────────────────────────────────

describe('GET /api/invitations/:token', () => {
  it('returns invite info for a valid token', async () => {
    prisma.invitation.findUnique.mockResolvedValue(pendingInvite);

    const res = await request(app).get('/api/invitations/rawtoken123');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('newbie@test.com');
    expect(res.body.familyName).toBe('Smith Family');
    expect(res.body.inviterName).toBe('Owner');
  });

  it('returns 404 for an unknown token', async () => {
    prisma.invitation.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/invitations/nope');
    expect(res.status).toBe(404);
  });

  it('returns 410 for an expired invitation', async () => {
    prisma.invitation.findUnique.mockResolvedValue({ ...pendingInvite, expiresAt: past });
    const res = await request(app).get('/api/invitations/rawtoken123');
    expect(res.status).toBe(410);
  });

  it('returns 410 for an already-accepted invitation', async () => {
    prisma.invitation.findUnique.mockResolvedValue({ ...pendingInvite, acceptedAt: future });
    const res = await request(app).get('/api/invitations/rawtoken123');
    expect(res.status).toBe(410);
  });
});

// ─── POST /api/invitations/:token/claim (Clerk-authenticated) ─────────────────

describe('POST /api/invitations/:token/claim', () => {
  // The invitee has just signed up via Clerk; their local row is resolved by
  // authenticate. Their email must match the invited address.
  const invitee = { id: 'new1', email: 'newbie@test.com', clerkUserId: 'clerk_new', name: 'Newbie', role: 'owner', plan: 'free' };

  it('links the signed-in invitee as a family member', async () => {
    prisma.user.findUnique.mockResolvedValue(invitee); // authenticate → req.user
    prisma.invitation.findUnique.mockResolvedValue(pendingInvite);
    prisma.familyMember.findUnique.mockResolvedValue(null);
    prisma.familyMember.create.mockResolvedValue({ id: 'fm9', userId: 'new1' });
    prisma.invitation.update.mockResolvedValue({ ...pendingInvite, acceptedAt: future });

    const res = await request(app)
      .post('/api/invitations/rawtoken123/claim')
      .set('x-clerk-user-id', 'clerk_new');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.familyMember.create).toHaveBeenCalled();
    expect(prisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acceptedAt: expect.anything() }) })
    );
  });

  it('rejects a claim when the signed-in email differs from the invited email', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...invitee, email: 'someone-else@test.com' });
    prisma.invitation.findUnique.mockResolvedValue(pendingInvite);

    const res = await request(app)
      .post('/api/invitations/rawtoken123/claim')
      .set('x-clerk-user-id', 'clerk_new');

    expect(res.status).toBe(403);
    expect(prisma.familyMember.create).not.toHaveBeenCalled();
  });

  it('returns 410 for an expired invitation and links nothing', async () => {
    prisma.user.findUnique.mockResolvedValue(invitee);
    prisma.invitation.findUnique.mockResolvedValue({ ...pendingInvite, expiresAt: past });

    const res = await request(app)
      .post('/api/invitations/rawtoken123/claim')
      .set('x-clerk-user-id', 'clerk_new');

    expect(res.status).toBe(410);
    expect(prisma.familyMember.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/invitations/rawtoken123/claim');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/invitations?familyId= (owner: list pending) ─────────────────────

describe('GET /api/invitations', () => {
  it('lists pending invitations for the owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue({ id: 'family1', ownerId: 'owner1' });
    prisma.invitation.findMany.mockResolvedValue([pendingInvite]);

    const res = await request(app)
      .get('/api/invitations?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.invitations).toHaveLength(1);
  });

  it('returns 403 when a non-owner lists invitations', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue({ id: 'family1', ownerId: 'owner1' });

    const res = await request(app)
      .get('/api/invitations?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/invitations/:id (owner: revoke) ──────────────────────────────

describe('DELETE /api/invitations/:id', () => {
  it('revokes a pending invitation when called by the owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.invitation.findUnique.mockResolvedValue({ ...pendingInvite, family: { ownerId: 'owner1' } });
    prisma.invitation.delete.mockResolvedValue(pendingInvite);

    const res = await request(app)
      .delete('/api/invitations/inv1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when a non-owner tries to revoke', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.invitation.findUnique.mockResolvedValue({ ...pendingInvite, family: { ownerId: 'owner1' } });

    const res = await request(app)
      .delete('/api/invitations/inv1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });
});
