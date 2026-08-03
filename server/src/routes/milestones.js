const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { effectivePlan } = require('../lib/plan');

const router = express.Router();

// GET /api/milestones?childId=
router.get('/', authenticate, async (req, res) => {
  const { childId } = req.query;
  if (!childId) return res.status(400).json({ error: 'childId required' });

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: { family: { include: { members: true, owner: { select: { plan: true, planBoostUntil: true } } } } },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const isOwner = child.family.ownerId === req.user.id;
    const isMember = child.family.members.some((m) => m.userId === req.user.id);
    if (!isOwner && !isMember) return res.status(403).json({ error: 'Access denied' });

    // Feature access is determined by the family OWNER's plan (they hold the
    // subscription), not the viewer's — otherwise invited loved ones, who are
    // always on the free plan, could never see paid features.
    const plan = effectivePlan(child.family.owner);
    if (plan === 'free') return res.status(403).json({ error: 'Milestones require Plus or Premium plan' });

    const milestones = await prisma.milestone.findMany({
      where: { childId },
      orderBy: { date: 'desc' },
    });
    res.json({ milestones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/milestones
router.post(
  '/',
  authenticate,
  [
    body('childId').notEmpty(),
    body('type').notEmpty(),
    body('value').notEmpty(),
    body('date').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (effectivePlan(req.user) === 'free')
      return res.status(403).json({ error: 'Milestones require Plus or Premium plan' });

    const { childId, type, value, unit, note, date } = req.body;

    try {
      const child = await prisma.child.findUnique({
        where: { id: childId },
        include: { family: true },
      });
      if (!child) return res.status(404).json({ error: 'Child not found' });
      if (child.family.ownerId !== req.user.id)
        return res.status(403).json({ error: 'Only owner can add milestones' });

      const milestone = await prisma.milestone.create({
        data: { childId, type, value, unit, note, date: new Date(date) },
      });
      res.status(201).json({ milestone });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/milestones/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { child: { include: { family: true } } },
    });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    if (milestone.child.family.ownerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    await prisma.milestone.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
