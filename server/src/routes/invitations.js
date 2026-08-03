const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { hashInviteToken } = require('../lib/inviteToken');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Load a pending invitation by its raw token, or return why it's unusable.
async function loadPendingInvitation(rawToken, include) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(rawToken) },
    ...(include ? { include } : {}),
  });
  if (!invitation) return { status: 404, error: 'Invitation not found' };
  if (invitation.acceptedAt) return { status: 410, error: 'This invitation has already been used' };
  if (new Date(invitation.expiresAt) < new Date()) {
    return { status: 410, error: 'This invitation has expired' };
  }
  return { invitation };
}

// GET /api/invitations?familyId= — owner lists pending invitations
router.get('/', authenticate, async (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (family.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can view invitations' });
    }

    const invitations = await prisma.invitation.findMany({
      where: { familyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, permissions: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invitations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invitations/:token — public: info for the accept page
router.get('/:token', async (req, res) => {
  try {
    const result = await loadPendingInvitation(req.params.token, {
      family: { select: { name: true, owner: { select: { name: true } } } },
    });
    if (result.error) return res.status(result.status).json({ error: result.error });

    const { invitation } = result;
    res.json({
      email: invitation.email,
      familyName: invitation.family.name,
      inviterName: invitation.family.owner.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invitations/:token/accept — public: set password, join the family
router.post(
  '/:token/accept',
  [
    body('name').trim().notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const result = await loadPendingInvitation(req.params.token);
      if (result.error) return res.status(result.status).json({ error: result.error });
      const { invitation } = result;

      const { name, password } = req.body;

      // If the email has since been registered, link the membership to that
      // account rather than creating a new user or overwriting a password.
      const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
      if (existing) {
        const alreadyMember = await prisma.familyMember.findUnique({
          where: { familyId_userId: { familyId: invitation.familyId, userId: existing.id } },
        });
        if (!alreadyMember) {
          await prisma.familyMember.create({
            data: {
              familyId: invitation.familyId,
              userId: existing.id,
              permissions: invitation.permissions,
              accessPerChild: invitation.accessPerChild,
            },
          });
        }
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
        return res.status(200).json({ existingAccount: true });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email: invitation.email, passwordHash, name, role: 'loved_one' },
        select: { id: true, email: true, name: true, role: true, plan: true, avatarUrl: true, createdAt: true },
      });

      await prisma.familyMember.create({
        data: {
          familyId: invitation.familyId,
          userId: user.id,
          permissions: invitation.permissions,
          accessPerChild: invitation.accessPerChild,
        },
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      res.status(201).json({ token: signToken(user.id), user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/invitations/:id — owner revokes a pending invitation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { id: req.params.id },
      include: { family: true },
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.family.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can revoke invitations' });
    }

    await prisma.invitation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
