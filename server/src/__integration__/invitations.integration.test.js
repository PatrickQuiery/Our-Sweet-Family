const request = require('supertest');
const app = require('../app');
const appPrisma = require('../lib/prisma');
const { prisma, truncateAll, makeUser, makeFamily, makeChild, tokenFor } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

describe('invite → accept → login (end to end, real DB)', () => {
  it('lets an invited loved one set a password, join, and then sign in', async () => {
    const owner = await makeUser({ role: 'owner', plan: 'plus', name: 'Alex' });
    const family = await makeFamily(owner.id, { name: 'The Johnsons' });
    const emma = await makeChild(family.id, { name: 'Emma' });
    await prisma.memory.create({
      data: { familyId: family.id, uploadedById: owner.id, childIds: [emma.id], fileType: 'photo', capturedAt: new Date('2024-01-01'), fileUrl: 'memories/x.jpg', caption: 'Hi' },
    });

    // 1. Owner invites a brand-new email → pending invitation + shareable link.
    const inviteRes = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${tokenFor(owner.id)}`)
      .send({ familyId: family.id, email: 'aunt@example.com', permissions: 'view_only' });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.inviteUrl).toMatch(/\/accept-invite\?token=/);
    const token = inviteRes.body.inviteUrl.split('token=')[1];

    // No real user exists yet for the invited email.
    expect(await prisma.user.findUnique({ where: { email: 'aunt@example.com' } })).toBeNull();

    // 2. Public info endpoint describes the invite.
    const info = await request(app).get(`/api/invitations/${token}`);
    expect(info.status).toBe(200);
    expect(info.body).toMatchObject({ email: 'aunt@example.com', familyName: 'The Johnsons', inviterName: 'Alex' });

    // 3. Accept: set a password → real User + FamilyMember created, auto-login token.
    const accept = await request(app)
      .post(`/api/invitations/${token}/accept`)
      .send({ name: 'Aunt May', password: 'auntpass123' });

    expect(accept.status).toBe(201);
    expect(accept.body.token).toBeDefined();
    const created = await prisma.user.findUnique({ where: { email: 'aunt@example.com' } });
    expect(created).not.toBeNull();
    expect(created.role).toBe('loved_one');
    const membership = await prisma.familyMember.findFirst({ where: { userId: created.id, familyId: family.id } });
    expect(membership).not.toBeNull();

    // 4. The new loved one can log in with the password they set …
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aunt@example.com', password: 'auntpass123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();

    // … and see the family's memories.
    const feed = await request(app)
      .get(`/api/memories?familyId=${family.id}`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body.memories).toHaveLength(1);

    // 5. The token is single-use.
    const reuse = await request(app)
      .post(`/api/invitations/${token}/accept`)
      .send({ name: 'x', password: 'password123' });
    expect(reuse.status).toBe(410);
  });
});
