const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function getFamilyAndCheckAccess(familyId, userId) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: true },
  });
  if (!family) return null;
  const isMember =
    family.ownerId === userId || family.members.some((m) => m.userId === userId);
  return isMember ? family : null;
}

// GET /api/children?familyId=
router.get('/', authenticate, async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  const family = await getFamilyAndCheckAccess(familyId, req.user.id);
  if (!family) return res.status(403).json({ error: 'Access denied' });

  try {
    const children = await prisma.child.findMany({ where: { familyId } });
    res.json({ children });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/children
router.post(
  '/',
  authenticate,
  [
    body('familyId').notEmpty(),
    body('name').trim().notEmpty(),
    body('dateOfBirth').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { familyId, name, dateOfBirth } = req.body;

    try {
      const family = await prisma.family.findUnique({ where: { id: familyId } });
      if (!family) return res.status(404).json({ error: 'Family not found' });
      if (family.ownerId !== req.user.id)
        return res.status(403).json({ error: 'Only owner can add children' });

      const child = await prisma.child.create({
        data: { familyId, name, dateOfBirth: new Date(dateOfBirth) },
      });
      res.status(201).json({ child });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/children/:id
router.put(
  '/:id',
  authenticate,
  [body('name').optional().trim().notEmpty()],
  async (req, res) => {
    try {
      const child = await prisma.child.findUnique({
        where: { id: req.params.id },
        include: { family: true },
      });
      if (!child) return res.status(404).json({ error: 'Child not found' });
      if (child.family.ownerId !== req.user.id)
        return res.status(403).json({ error: 'Only owner can update child' });

      const { name, dateOfBirth, avatarUrl } = req.body;
      const updated = await prisma.child.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      });
      res.json({ child: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/children/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { family: true },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (child.family.ownerId !== req.user.id)
      return res.status(403).json({ error: 'Only owner can remove child' });

    await prisma.child.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
