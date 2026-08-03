const request = require('supertest');
const app = require('../app');
const appPrisma = require('../lib/prisma');
const { prisma, truncateAll, makeUser, makeFamily, makeChild, makeMemory, authHeader } = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

describe('invite → claim (end to end, real DB)', () => {
  it('an invited, signed-in user claims membership and then sees the family', async () => {
    const owner = await makeUser({ role: 'owner', plan: 'plus', name: 'Alex' });
    const family = await makeFamily(owner.id, { name: 'The Johnsons' });
    const emma = await makeChild(family.id, { name: 'Emma' });
    await makeMemory(family.id, owner.id, { childIds: [emma.id], caption: 'Hi' });

    // 1. Owner invites a brand-new email → pending invitation + shareable link.
    const inviteRes = await request(app)
      .post('/api/members')
      .set(...authHeader(owner))
      .send({ familyId: family.id, email: 'aunt@example.com', permissions: 'view_only' });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.inviteUrl).toMatch(/\/accept-invite\?token=/);
    const token = inviteRes.body.inviteUrl.split('token=')[1];

    // 2. The invitee signs up via Clerk — simulated here as the local row that
    //    authenticate would sync on their first request (matching email).
    const aunt = await makeUser({ email: 'aunt@example.com', name: 'Aunt May', role: 'owner' });

    // 3. Public info endpoint describes the invite.
    const info = await request(app).get(`/api/invitations/${token}`);
    expect(info.status).toBe(200);
    expect(info.body).toMatchObject({ email: 'aunt@example.com', familyName: 'The Johnsons', inviterName: 'Alex' });

    // 4. Claim (authenticated) links membership.
    const claim = await request(app)
      .post(`/api/invitations/${token}/claim`)
      .set(...authHeader(aunt));
    expect(claim.status).toBe(200);
    const membership = await prisma.familyMember.findFirst({ where: { userId: aunt.id, familyId: family.id } });
    expect(membership).not.toBeNull();

    // 5. She can now see the family's memories.
    const feed = await request(app)
      .get(`/api/memories?familyId=${family.id}`)
      .set(...authHeader(aunt));
    expect(feed.status).toBe(200);
    expect(feed.body.memories).toHaveLength(1);

    // 6. The invite is single-use.
    const reuse = await request(app)
      .post(`/api/invitations/${token}/claim`)
      .set(...authHeader(aunt));
    expect(reuse.status).toBe(410);
  });

  it('rejects a claim from a different email than was invited', async () => {
    const owner = await makeUser({ role: 'owner', name: 'Alex' });
    const family = await makeFamily(owner.id, { name: 'Fam' });
    const inviteRes = await request(app)
      .post('/api/members')
      .set(...authHeader(owner))
      .send({ familyId: family.id, email: 'invited@example.com', permissions: 'view_only' });
    const token = inviteRes.body.inviteUrl.split('token=')[1];

    const stranger = await makeUser({ email: 'stranger@example.com' });
    const res = await request(app)
      .post(`/api/invitations/${token}/claim`)
      .set(...authHeader(stranger));

    expect(res.status).toBe(403);
    const membership = await prisma.familyMember.findFirst({ where: { userId: stranger.id } });
    expect(membership).toBeNull();
  });
});
