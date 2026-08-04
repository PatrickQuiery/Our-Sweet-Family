const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/families — list families for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const ownedFamilies = await prisma.family.findMany({
      where: { ownerId: req.user.id },
      include: { children: true, members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } } } },
    });

    const memberFamilies = await prisma.family.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: { children: true, members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } } } },
    });

    const all = [...ownedFamilies];
    for (const f of memberFamilies) {
      if (!all.find((x) => x.id === f.id)) all.push(f);
    }

    res.json({ families: all });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/families
router.post(
  '/',
  authenticate,
  [body('name').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    try {
      const family = await prisma.family.create({
        data: { name, ownerId: req.user.id },
        include: { children: true, members: true },
      });
      res.status(201).json({ family });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/families/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.params.id },
      include: {
        children: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isMember =
      family.ownerId === req.user.id ||
      family.members.some((m) => m.userId === req.user.id);

    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    res.json({ family });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/families/:id
router.put(
  '/:id',
  authenticate,
  [body('name').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const family = await prisma.family.findUnique({ where: { id: req.params.id } });
      if (!family) return res.status(404).json({ error: 'Family not found' });
      if (family.ownerId !== req.user.id) return res.status(403).json({ error: 'Only owner can update' });

      const updated = await prisma.family.update({
        where: { id: req.params.id },
        data: { name: req.body.name },
        include: { children: true },
      });
      res.json({ family: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PATCH /api/families/:id/settings — owner-only family settings.
// Currently: showPhotoLocation (opt-in to display photo GPS, owner-only).
router.patch('/:id/settings', authenticate, async (req, res) => {
  try {
    const family = await prisma.family.findUnique({ where: { id: req.params.id } });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (family.ownerId !== req.user.id) return res.status(403).json({ error: 'Only owner can update' });

    const data = {};
    if (typeof req.body.showPhotoLocation === 'boolean') data.showPhotoLocation = req.body.showPhotoLocation;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const updated = await prisma.family.update({ where: { id: req.params.id }, data, include: { children: true } });
    res.json({ family: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
