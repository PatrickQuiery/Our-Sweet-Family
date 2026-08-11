const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { mediaRefs } = require('../lib/mediaRef');
const { isParent } = require('../lib/familyAccess');

const router = express.Router();

// A compact memory reference for an activity row (thumbnail + type), reusing the
// same key→authenticated-endpoint rewriting the feed uses.
function memoryRef(m) {
  const shaped = mediaRefs(m);
  return { id: m.id, fileType: m.fileType, thumbnailUrl: shaped.thumbnailUrl, fileUrl: shaped.fileUrl };
}

// GET /api/activity?familyId=&page=&limit=
// A unified, time-sorted feed of loves + comments + new memories across the
// family, scoped to what the viewer is allowed to see (mirrors the memories feed's
// access rules). Merged and paginated in memory — fine for family-sized libraries.
router.get('/', authenticate, async (req, res) => {
  const { familyId, page = 1, limit = 30 } = req.query;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    const family = await prisma.family.findUnique({ where: { id: familyId }, include: { members: true } });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = isParent(family, req.user.id);
    const membership = family.members.find((m) => m.userId === req.user.id);
    if (!isOwner && !membership) return res.status(403).json({ error: 'Access denied' });

    // Which memories may this viewer see? Same rules as GET /api/memories.
    const where = { familyId };
    const and = [];
    if (!isOwner) where.isClassified = false;
    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowed = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      and.push({ OR: allowed.map((cid) => ({ childIds: { array_contains: [cid] } })) });
    }
    if (and.length) where.AND = and;

    const memories = await prisma.memory.findMany({
      where,
      select: {
        id: true, fileUrl: true, thumbnailUrl: true, fileType: true, createdAt: true,
        uploadedById: true, uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!memories.length) return res.json({ activity: [], pagination: { page: 1, limit: 30, total: 0, pages: 0 } });

    const memMap = new Map(memories.map((m) => [m.id, m]));
    const ids = memories.map((m) => m.id);

    const [reactions, comments] = await Promise.all([
      prisma.reaction.findMany({
        where: { memoryId: { in: ids } },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.comment.findMany({
        where: { memoryId: { in: ids } },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ]);

    const items = [];
    for (const r of reactions) {
      const m = memMap.get(r.memoryId);
      if (m) items.push({ id: `love-${r.id}`, type: 'love', actor: r.user, memory: memoryRef(m), createdAt: r.createdAt });
    }
    for (const c of comments) {
      const m = memMap.get(c.memoryId);
      if (m) items.push({ id: `comment-${c.id}`, type: 'comment', actor: c.user, text: c.text, memory: memoryRef(m), createdAt: c.createdAt });
    }
    for (const m of memories) {
      items.push({ id: `memory-${m.id}`, type: 'memory', actor: m.uploadedBy, memory: memoryRef(m), createdAt: m.createdAt });
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const total = items.length;
    const start = (pageNum - 1) * take;

    res.json({
      activity: items.slice(start, start + take),
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
