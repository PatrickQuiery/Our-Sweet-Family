const request = require('supertest');
const app = require('../app');
const appPrisma = require('../lib/prisma');
const {
  prisma, truncateAll, makeUser, makeFamily, makeChild, makeMember, makeMemory, authHeader,
} = require('./helpers');

beforeEach(truncateAll);
afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

// Builds an owner + family + two children (Emma, Liam) and three memories:
//   m1 -> [Emma], m2 -> [Emma, Liam], m3 -> [Liam]
async function seedFamily() {
  const owner = await makeUser({ role: 'owner', plan: 'free' });
  const family = await makeFamily(owner.id);
  const emma = await makeChild(family.id, { name: 'Emma' });
  const liam = await makeChild(family.id, { name: 'Liam' });
  const m1 = await makeMemory(family.id, owner.id, { childIds: [emma.id], caption: 'Emma solo', capturedAt: '2024-01-10' });
  const m2 = await makeMemory(family.id, owner.id, { childIds: [emma.id, liam.id], caption: 'Both', capturedAt: '2024-02-10' });
  const m3 = await makeMemory(family.id, owner.id, { childIds: [liam.id], caption: 'Liam solo', capturedAt: '2024-03-10' });
  return { owner, family, emma, liam, m1, m2, m3 };
}

describe('childId filter (real array_contains query)', () => {
  it('returns only memories tagged with the requested child', async () => {
    const { owner, family, emma, liam } = await seedFamily();

    const emmaRes = await request(app)
      .get(`/api/memories?familyId=${family.id}&childId=${emma.id}`)
      .set(...authHeader(owner));
    expect(emmaRes.status).toBe(200);
    expect(emmaRes.body.memories.map((m) => m.caption).sort()).toEqual(['Both', 'Emma solo']);

    const liamRes = await request(app)
      .get(`/api/memories?familyId=${family.id}&childId=${liam.id}`)
      .set(...authHeader(owner));
    expect(liamRes.status).toBe(200);
    expect(liamRes.body.memories.map((m) => m.caption).sort()).toEqual(['Both', 'Liam solo']);
  });
});

describe('per-child access for a restricted loved one', () => {
  it('returns only allowed children and does NOT 500', async () => {
    const { family, liam } = await seedFamily();
    const grandma = await makeUser({ role: 'loved_one', plan: 'free', name: 'Grandma' });
    await makeMember(family.id, grandma.id, { permissions: 'view_only', accessPerChild: [liam.id] });

    const res = await request(app)
      .get(`/api/memories?familyId=${family.id}`)
      .set(...authHeader(grandma));

    expect(res.status).toBe(200);
    // Only memories tagged with Liam — the Emma-solo memory must be absent.
    expect(res.body.memories.map((m) => m.caption).sort()).toEqual(['Both', 'Liam solo']);
  });
});

describe('reels enforce per-child access', () => {
  it('a restricted member never sees another child\'s memories in reels', async () => {
    const { family, liam } = await seedFamily();
    const grandma = await makeUser({ role: 'loved_one', plan: 'free' });
    await makeMember(family.id, grandma.id, { permissions: 'view_only', accessPerChild: [liam.id] });

    const res = await request(app)
      .get(`/api/reels?familyId=${family.id}&type=annual`)
      .set(...authHeader(grandma));

    expect(res.status).toBe(200);
    const captions = res.body.reels.flatMap((r) => r.memories.map((m) => m.caption));
    expect(captions).not.toContain('Emma solo');
    expect(captions.sort()).toEqual(['Both', 'Liam solo']);
  });
});

describe('classified memories in the real query', () => {
  it('hides classified memories from a non-owner member', async () => {
    const owner = await makeUser({ role: 'owner', plan: 'premium' });
    const family = await makeFamily(owner.id);
    await makeMemory(family.id, owner.id, { caption: 'Public', isClassified: false });
    await makeMemory(family.id, owner.id, { caption: 'Secret', isClassified: true });
    const member = await makeUser({ role: 'loved_one', plan: 'free' });
    await makeMember(family.id, member.id, { accessPerChild: 'all' });

    const ownerRes = await request(app)
      .get(`/api/memories?familyId=${family.id}`)
      .set(...authHeader(owner));
    expect(ownerRes.body.memories.map((m) => m.caption).sort()).toEqual(['Public', 'Secret']);

    const memberRes = await request(app)
      .get(`/api/memories?familyId=${family.id}`)
      .set(...authHeader(member));
    expect(memberRes.body.memories.map((m) => m.caption)).toEqual(['Public']);
  });
});

describe('pagination against real rows', () => {
  it('paginates and reports correct totals', async () => {
    const owner = await makeUser({ role: 'owner' });
    const family = await makeFamily(owner.id);
    for (let i = 0; i < 25; i++) {
      await makeMemory(family.id, owner.id, { caption: `M${i}`, capturedAt: `2024-01-${String(i + 1).padStart(2, '0')}` });
    }
    const page1 = await request(app)
      .get(`/api/memories?familyId=${family.id}&page=1&limit=10`)
      .set(...authHeader(owner));
    expect(page1.body.memories).toHaveLength(10);
    expect(page1.body.pagination).toMatchObject({ total: 25, page: 1, limit: 10, pages: 3 });

    const page3 = await request(app)
      .get(`/api/memories?familyId=${family.id}&page=3&limit=10`)
      .set(...authHeader(owner));
    expect(page3.body.memories).toHaveLength(5);
  });
});
