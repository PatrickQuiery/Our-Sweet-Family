const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { isParent } = require('../lib/familyAccess');
const { mediaRefs } = require('../lib/mediaRef');
const { effectivePlan } = require('../lib/plan');

const router = express.Router();

// GET /api/reels?familyId=&type=annual|monthly|birthday|holiday
router.get('/', authenticate, async (req, res) => {
  const { familyId, type = 'annual', childId } = req.query;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true, owner: { select: { plan: true, planBoostUntil: true } } },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = isParent(family, req.user.id);
    const membership = family.members.find((m) => m.userId === req.user.id);
    if (!isOwner && !membership) return res.status(403).json({ error: 'Access denied' });

    // Reel tiers are gated on the family OWNER's plan (the subscription holder),
    // not the viewer's — a loved one is always on the free plan.
    const plan = effectivePlan(family.owner);

    // Plan validation for reel types
    if (type === 'annual' && plan === 'free') {
      // ok
    } else if (type === 'monthly' && plan === 'free') {
      return res.status(403).json({ error: 'Monthly reels require Plus or Premium plan' });
    } else if (['birthday', 'holiday'].includes(type) && plan !== 'premium') {
      return res.status(403).json({ error: 'Birthday and holiday reels require Premium plan' });
    }

    const where = {
      familyId,
      ...(!isOwner && { isClassified: false }),
    };

    // Enforce per-child access for restricted loved ones — a member who is only
    // granted access to some children must not see other children's memories in
    // reels (mirrors the same restriction applied to the memories feed).
    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      where.OR = allowedChildren.map((cid) => ({
        childIds: { array_contains: [cid] },
      }));
    }

    if (childId) {
      // Postgres Json membership: array_contains, no `path`.
      where.AND = [{ childIds: { array_contains: [childId] } }];
    }

    const rawMemories = await prisma.memory.findMany({
      where,
      orderBy: { capturedAt: 'asc' },
    });
    const memories = rawMemories.map(mediaRefs);

    // Group memories into reels
    const reels = generateReels(memories, type);

    res.json({ reels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function generateReels(memories, type) {
  const groups = {};

  for (const memory of memories) {
    const date = new Date(memory.capturedAt);
    let key;

    switch (type) {
      case 'annual':
        key = `${date.getFullYear()}`;
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'birthday':
        // Group by month-day (birthday patterns)
        key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        break;
      case 'holiday':
        key = getHolidayPeriod(date);
        break;
      default:
        key = `${date.getFullYear()}`;
    }

    if (!groups[key]) {
      groups[key] = { key, label: formatReelLabel(key, type), memories: [] };
    }
    groups[key].memories.push(memory);
  }

  return Object.values(groups)
    .filter((g) => g.memories.length > 0)
    .sort((a, b) => b.key.localeCompare(a.key));
}

function formatReelLabel(key, type) {
  switch (type) {
    case 'annual':
      return key;
    case 'monthly': {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    case 'birthday':
      return `${key} Birthdays`;
    case 'holiday':
      return key;
    default:
      return key;
  }
}

function getHolidayPeriod(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 12 && day >= 20) return 'Christmas';
  if (month === 1 && day <= 5) return 'New Year';
  if (month === 10 && day >= 25) return 'Halloween';
  if (month === 11 && day >= 20 && day <= 30) return 'Thanksgiving';
  if (month === 2 && day === 14) return "Valentine's Day";
  return `${date.toLocaleDateString('en-US', { month: 'long' })} ${date.getFullYear()}`;
}

module.exports = router;
