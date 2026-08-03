jest.mock('../../lib/prisma');

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../lib/prisma');
const { clerkClient } = require('@clerk/express');

// Local row backing a Clerk identity (Clerk owns credentials; passwordHash is null).
const dbUser = {
  id: 'user1',
  email: 'test@example.com',
  clerkUserId: 'clerk_1',
  passwordHash: null,
  name: 'Test User',
  role: 'owner',
  plan: 'free',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
};

describe('GET /api/auth/me', () => {
  it('returns the current user without passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);

    const res = await request(app).get('/api/auth/me').set('x-clerk-user-id', 'clerk_1');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 when not signed in', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('local user sync on first authenticated request', () => {
  it('creates a local user when none exists for the Clerk id', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // lookup by clerkUserId
      .mockResolvedValueOnce(null); // lookup by email — none exists
    clerkClient.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'New@Example.com' }],
      firstName: 'New',
      lastName: 'Person',
    });
    prisma.user.create.mockResolvedValue({ ...dbUser, id: 'u2', clerkUserId: 'clerk_2', email: 'new@example.com', name: 'New Person' });

    const res = await request(app).get('/api/auth/me').set('x-clerk-user-id', 'clerk_2');

    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clerkUserId: 'clerk_2', email: 'new@example.com' }) })
    );
  });

  it('links an existing local user (by email) instead of duplicating', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // by clerkUserId
      .mockResolvedValueOnce(dbUser); // by email — an existing seed/invited row
    clerkClient.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
    });
    prisma.user.update.mockResolvedValue({ ...dbUser, clerkUserId: 'clerk_9' });

    const res = await request(app).get('/api/auth/me').set('x-clerk-user-id', 'clerk_9');

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user1' }, data: expect.objectContaining({ clerkUserId: 'clerk_9' }) })
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
