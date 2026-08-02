const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// accessPerChild must be the literal "all" or an array of child-id strings.
// Anything else (a bare string, an object) would later break JSON parsing and
// the per-child access filter, so reject it at write time.
function isValidAccessPerChild(value) {
  if (value === undefined || value === null) return true;
  if (value === 'all') return true;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return true;
  throw new Error("accessPerChild must be 'all' or an array of child ids");
}

// GET /api/members?familyId=
router.get('/', authenticate, async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (family.ownerId !== req.user.id)
      return res.status(403).json({ error: 'Only owner can view members' });

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/members — invite a loved one by email
router.post(
  '/',
  authenticate,
  [
    body('familyId').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('permissions').isIn(['view_only', 'upload', 'share_download', 'all']),
    body('accessPerChild').optional().custom(isValidAccessPerChild),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { familyId, email, permissions, accessPerChild } = req.body;

    try {
      const family = await prisma.family.findUnique({ where: { id: familyId } });
      if (!family) return res.status(404).json({ error: 'Family not found' });
      if (family.ownerId !== req.user.id)
        return res.status(403).json({ error: 'Only owner can invite members' });

      let invitee = await prisma.user.findUnique({ where: { email } });
      if (!invitee) {
        // Create a placeholder account for the loved one
        const { v4: uuidv4 } = require('uuid');
        const bcrypt = require('bcryptjs');
        const tempPass = await bcrypt.hash(uuidv4(), 10);
        invitee = await prisma.user.create({
          data: {
            email,
            passwordHash: tempPass,
            name: email.split('@')[0],
            role: 'loved_one',
          },
        });
      }

      const existing = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: invitee.id } },
      });
      if (existing) return res.status(409).json({ error: 'Already a member' });

      const member = await prisma.familyMember.create({
        data: {
          familyId,
          userId: invitee.id,
          permissions,
          accessPerChild: accessPerChild || 'all',
        },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      res.status(201).json({ member });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/members/:id
router.put(
  '/:id',
  authenticate,
  [
    body('permissions').optional().isIn(['view_only', 'upload', 'share_download', 'all']),
    body('accessPerChild').optional().custom(isValidAccessPerChild),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { permissions, accessPerChild } = req.body;

    try {
      const member = await prisma.familyMember.findUnique({
        where: { id: req.params.id },
        include: { family: true },
      });
      if (!member) return res.status(404).json({ error: 'Member not found' });
      if (member.family.ownerId !== req.user.id)
        return res.status(403).json({ error: 'Only owner can update members' });

      const updated = await prisma.familyMember.update({
        where: { id: req.params.id },
        data: {
          ...(permissions && { permissions }),
          ...(accessPerChild !== undefined && { accessPerChild }),
        },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      res.json({ member: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/members/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const member = await prisma.familyMember.findUnique({
      where: { id: req.params.id },
      include: { family: true },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.family.ownerId !== req.user.id)
      return res.status(403).json({ error: 'Only owner can remove members' });

    await prisma.familyMember.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
