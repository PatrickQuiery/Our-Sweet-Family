jest.mock('../../lib/prisma');
jest.mock('../../lib/storage');

const { Readable } = require('stream');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');
const storage = require('../../lib/storage');

// jest.config has resetMocks:true, so mock return values are set per-test.
function mockReadFile(contentType = 'image/jpeg') {
  storage.readFile.mockResolvedValue({
    stream: Readable.from([Buffer.from('fake-bytes')]),
    contentType,
  });
}

const ownerUser = { id: 'owner1', email: 'owner@test.com', name: 'Owner', role: 'owner', plan: 'free', avatarUrl: null };
const memberUser = { id: 'member1', email: 'member@test.com', name: 'Member', role: 'loved_one', plan: 'free', avatarUrl: null };
const otherUser = { id: 'other1', email: 'other@test.com', name: 'Other', role: 'owner', plan: 'free', avatarUrl: null };

const ownerToken = jwt.sign({ userId: 'owner1' }, 'test-jwt-secret-key');
const memberToken = jwt.sign({ userId: 'member1' }, 'test-jwt-secret-key');
const otherToken = jwt.sign({ userId: 'other1' }, 'test-jwt-secret-key');

const mockFamily = {
  id: 'family1', name: 'Smith', ownerId: 'owner1',
  // Prisma parses Json fields, so accessPerChild comes back as a JS string 'all', not JSON
  members: [{ id: 'fm1', userId: 'member1', permissions: 'view_only', accessPerChild: 'all' }],
  children: [
    { id: 'child1', name: 'Alice', dateOfBirth: '2020-01-01' },
    { id: 'child2', name: 'Bob', dateOfBirth: '2021-06-15' },
  ],
};

const mockMemory = {
  id: 'mem1', familyId: 'family1', childIds: ['child1'],
  fileUrl: 'http://example.com/photo.jpg', thumbnailUrl: null,
  fileType: 'photo', capturedAt: '2023-03-15', isClassified: false,
  caption: null, createdAt: new Date().toISOString(),
  uploadedById: 'owner1',
  uploadedBy: { id: 'owner1', name: 'Owner', avatarUrl: null },
  reactions: [], comments: [],
};

// ─── GET /api/memories ────────────────────────────────────────────────────────

describe('GET /api/memories', () => {
  it('returns memories with pagination for owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.count.mockResolvedValue(1);
    prisma.memory.findMany.mockResolvedValue([mockMemory]);
    prisma.child.findMany.mockResolvedValue(mockFamily.children);

    const res = await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.memories).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns 400 when familyId is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .get('/api/memories')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(400);
  });

  it('rewrites stored media keys to authenticated endpoints, leaving external URLs alone', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.count.mockResolvedValue(2);
    prisma.memory.findMany.mockResolvedValue([
      { ...mockMemory, id: 'keyed', fileUrl: 'memories/abc.jpg', thumbnailUrl: 'thumbnails/abc_thumb.jpg' },
      { ...mockMemory, id: 'external', fileUrl: 'https://images.unsplash.com/x.jpg', thumbnailUrl: null },
    ]);
    prisma.child.findMany.mockResolvedValue(mockFamily.children);

    const res = await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    const keyed = res.body.memories.find((m) => m.id === 'keyed');
    const external = res.body.memories.find((m) => m.id === 'external');
    expect(keyed.fileUrl).toBe('/memories/keyed/file');
    expect(keyed.thumbnailUrl).toBe('/memories/keyed/thumb');
    expect(external.fileUrl).toBe('https://images.unsplash.com/x.jpg');
    expect(external.thumbnailUrl).toBeNull();
  });

  it('returns 403 for non-member user', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);

    const res = await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('applies isClassified=false filter for non-owner members', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.count.mockResolvedValue(0);
    prisma.memory.findMany.mockResolvedValue([]);
    prisma.child.findMany.mockResolvedValue([]);

    await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    const findManyArgs = prisma.memory.findMany.mock.calls[0][0];
    expect(findManyArgs.where.isClassified).toBe(false);
  });

  it('enriches memories with age labels', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.family.findUnique.mockResolvedValue(mockFamily);
    prisma.memory.count.mockResolvedValue(1);
    prisma.memory.findMany.mockResolvedValue([mockMemory]);
    prisma.child.findMany.mockResolvedValue(mockFamily.children);

    const res = await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.body.memories[0].ageLabels).toBeDefined();
    expect(res.body.memories[0].ageLabels[0].childName).toBe('Alice');
  });

  // ── BUG #1 (BLOCKER): per-child access filter ────────────────────────────────
  // When a member has accessPerChild=['child1','child2'], the filter should use
  // OR conditions so memories tagged with EITHER child are returned.
  // Current bug: uses array_contains with the full array, requiring ALL allowed
  // children to appear in every memory's childIds — far too restrictive.
  it('BUG: uses OR filter (not array_contains with full list) for per-child access', async () => {
    const restrictedMember = {
      ...mockFamily.members[0],
      // Prisma returns the parsed JS array, not a JSON string
      accessPerChild: ['child1', 'child2'],
    };
    const familyWithRestriction = { ...mockFamily, members: [restrictedMember] };

    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.family.findUnique.mockResolvedValue(familyWithRestriction);
    prisma.memory.count.mockResolvedValue(0);
    prisma.memory.findMany.mockResolvedValue([]);
    prisma.child.findMany.mockResolvedValue([]);

    await request(app)
      .get('/api/memories?familyId=family1')
      .set('x-clerk-user-id', 'clerk-test');

    const findManyArgs = prisma.memory.findMany.mock.calls[0][0];
    // After fix: should use OR so individual child memories are visible
    expect(findManyArgs.where.OR).toBeDefined();
    // Should NOT use top-level childIds (requires all children simultaneously)
    expect(findManyArgs.where.childIds).toBeUndefined();
  });
});

// ─── GET /api/memories/:id ────────────────────────────────────────────────────

describe('GET /api/memories/:id', () => {
  const memoryWithFamily = {
    ...mockMemory,
    family: { ...mockFamily },
  };

  it('returns memory for owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(memoryWithFamily);

    const res = await request(app)
      .get('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.memory.id).toBe('mem1');
  });

  it('returns 403 for classified memory when viewed by non-owner', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.memory.findUnique.mockResolvedValue({
      ...memoryWithFamily,
      isClassified: true,
    });

    const res = await request(app)
      .get('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('returns 403 for non-member user', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.memory.findUnique.mockResolvedValue(memoryWithFamily);

    const res = await request(app)
      .get('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent memory', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/memories/ghost')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(404);
  });

  // ── BUG #2 (MEDIUM): single memory has no per-child access check ─────────────
  // A member restricted to child1 can directly fetch a memory for child2 by ID.
  // The GET /:id route only checks isClassified, not accessPerChild.
  it('BUG: denies access to a memory outside the member\'s allowed children', async () => {
    const restrictedMembership = [{
      id: 'fm1', userId: 'member1', permissions: 'view_only',
      accessPerChild: ['child1'], // only child1 allowed (Prisma returns parsed JS array)
    }];
    const child2Memory = {
      ...memoryWithFamily,
      childIds: ['child2'], // memory belongs to child2
      isClassified: false,
      family: { ...mockFamily, members: restrictedMembership },
    };

    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.memory.findUnique.mockResolvedValue(child2Memory);

    const res = await request(app)
      .get('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    // Should be denied — member only has access to child1
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/memories/:id ─────────────────────────────────────────────────

describe('DELETE /api/memories/:id', () => {
  const memoryWithFamily = { ...mockMemory, family: { ownerId: 'owner1' } };

  it('deletes memory when called by owner', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(memoryWithFamily);
    prisma.memory.delete.mockResolvedValue(mockMemory);

    const res = await request(app)
      .delete('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deletes memory when called by original uploader', async () => {
    const uploaderMemory = { ...memoryWithFamily, uploadedById: 'member1' };
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.memory.findUnique.mockResolvedValue(uploaderMemory);
    prisma.memory.delete.mockResolvedValue(uploaderMemory);

    const res = await request(app)
      .delete('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
  });

  it('returns 403 when called by unrelated user', async () => {
    const notUploaderMemory = { ...memoryWithFamily, uploadedById: 'owner1' };
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.memory.findUnique.mockResolvedValue(notUploaderMemory);

    const res = await request(app)
      .delete('/api/memories/mem1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/memories/:id/reactions ────────────────────────────────────────

// Memory shaped for the loadAccessibleMemory gate (family + members).
const accessibleMemory = {
  ...mockMemory,
  family: { ownerId: 'owner1', members: mockFamily.members },
};

describe('POST /api/memories/:id/reactions', () => {
  it('adds a love reaction', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(accessibleMemory);
    prisma.reaction.upsert.mockResolvedValue({ id: 'r1', memoryId: 'mem1', userId: 'owner1', type: 'love' });

    const res = await request(app)
      .post('/api/memories/mem1/reactions')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(201);
    expect(res.body.reaction.type).toBe('love');
  });

  // Regression: an unrelated user must NOT be able to react on a memory in a
  // family they don't belong to (IDOR).
  it('denies reaction from a user outside the family', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.memory.findUnique.mockResolvedValue(accessibleMemory);

    const res = await request(app)
      .post('/api/memories/mem1/reactions')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
    expect(prisma.reaction.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 when reacting on a non-existent memory', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/memories/ghost/reactions')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/memories/:id/reactions', () => {
  it('removes love reaction', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(accessibleMemory);
    prisma.reaction.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete('/api/memories/mem1/reactions')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/memories/:id/comments ─────────────────────────────────────────

describe('POST /api/memories/:id/comments', () => {
  it('adds a comment', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(accessibleMemory);
    prisma.comment.create.mockResolvedValue({
      id: 'c1', memoryId: 'mem1', userId: 'owner1', text: 'So cute!',
      user: { id: 'owner1', name: 'Owner', avatarUrl: null },
    });

    const res = await request(app)
      .post('/api/memories/mem1/comments')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ text: 'So cute!' });

    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('So cute!');
  });

  it('returns 400 for empty comment text', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);

    const res = await request(app)
      .post('/api/memories/mem1/comments')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });

  // Regression: unrelated user cannot comment on another family's memory (IDOR).
  it('denies comment from a user outside the family', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.memory.findUnique.mockResolvedValue(accessibleMemory);

    const res = await request(app)
      .post('/api/memories/mem1/comments')
      .set('x-clerk-user-id', 'clerk-test')
      .send({ text: 'intruder' });

    expect(res.status).toBe(403);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/memories/:memoryId/comments/:commentId', () => {
  it('deletes own comment', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'owner1', text: 'test' });
    prisma.comment.delete.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/memories/mem1/comments/c1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
  });

  it("returns 403 when deleting another user's comment", async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'owner1', text: 'test' });

    const res = await request(app)
      .delete('/api/memories/mem1/comments/c1')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });
});

// ─── Authenticated media streaming ────────────────────────────────────────────

describe('GET /api/memories/:id/file', () => {
  const mediaMemory = {
    ...mockMemory,
    fileUrl: 'memories/abc.jpg',
    thumbnailUrl: 'thumbnails/abc_thumb.jpg',
    family: { ownerId: 'owner1', members: mockFamily.members },
  };

  it('streams the file for the owner with the right content-type', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(mediaMemory);
    mockReadFile('image/jpeg');

    const res = await request(app)
      .get('/api/memories/mem1/file')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['cache-control']).toMatch(/private/);
  });

  it('denies a user outside the family', async () => {
    prisma.user.findUnique.mockResolvedValue(otherUser);
    prisma.memory.findUnique.mockResolvedValue(mediaMemory);

    const res = await request(app)
      .get('/api/memories/mem1/file')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('denies a classified memory to a non-owner', async () => {
    prisma.user.findUnique.mockResolvedValue(memberUser);
    prisma.memory.findUnique.mockResolvedValue({ ...mediaMemory, isClassified: true });

    const res = await request(app)
      .get('/api/memories/mem1/file')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown memory', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/memories/ghost/file')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/memories/mem1/file');
    expect(res.status).toBe(401);
  });

  it('redirects to an absolute external URL (legacy/seed images)', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue({ ...mediaMemory, fileUrl: 'https://images.unsplash.com/x.jpg' });

    const res = await request(app)
      .get('/api/memories/mem1/file')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://images.unsplash.com/x.jpg');
  });
});

describe('GET /api/memories/:id/thumb', () => {
  it('streams the thumbnail for an authorized viewer', async () => {
    prisma.user.findUnique.mockResolvedValue(ownerUser);
    prisma.memory.findUnique.mockResolvedValue({
      ...mockMemory,
      fileUrl: 'memories/abc.jpg',
      thumbnailUrl: 'thumbnails/abc_thumb.jpg',
      family: { ownerId: 'owner1', members: mockFamily.members },
    });
    mockReadFile('image/jpeg');

    const res = await request(app)
      .get('/api/memories/mem1/thumb')
      .set('x-clerk-user-id', 'clerk-test');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });
});
