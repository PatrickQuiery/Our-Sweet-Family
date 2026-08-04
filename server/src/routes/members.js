const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { isParent } = require('../lib/familyAccess');
const { generateInviteToken, inviteExpiry } = require('../lib/inviteToken');
const { sendMail } = require('../lib/mailer');

const router = express.Router();

function inviteUrlFor(rawToken) {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${base}/accept-invite?token=${rawToken}`;
}

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
    const family = await prisma.family.findUnique({ where: { id: familyId }, include: { members: true } });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (!isParent(family, req.user.id))
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
      const family = await prisma.family.findUnique({ where: { id: familyId }, include: { members: true } });
      if (!family) return res.status(404).json({ error: 'Family not found' });
      if (!isParent(family, req.user.id))
        return res.status(403).json({ error: 'Only owner can invite members' });

      const invitee = await prisma.user.findUnique({ where: { email } });

      if (invitee) {
        // The invitee already has an account and can log in — add them directly.
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
        return res.status(201).json({ member });
      }

      // Unknown email: create a pending invitation with a random token. No real
      // User is created until the invitee accepts and sets their own password.
      // Replace any prior pending invite for this email so re-inviting re-issues.
      await prisma.invitation.deleteMany({ where: { familyId, email, acceptedAt: null } });

      const { raw, hash } = generateInviteToken();
      const invitation = await prisma.invitation.create({
        data: {
          familyId,
          email,
          permissions,
          accessPerChild: accessPerChild || 'all',
          tokenHash: hash,
          invitedById: req.user.id,
          expiresAt: inviteExpiry(),
        },
      });

      const inviteUrl = inviteUrlFor(raw);

      // Best-effort email — the owner also gets the link in the response so they
      // can share it even if SMTP isn't configured yet.
      try {
        await sendMail({
          to: email,
          subject: `${req.user.name} invited you to ${family.name} on Our Sweet Family`,
          text: `${req.user.name} has invited you to share in their family's memories on Our Sweet Family.\n\nAccept your invitation and set your password:\n${inviteUrl}\n\nThis link expires in 7 days.`,
          html: `<p><strong>${req.user.name}</strong> has invited you to share in their family's memories on Our Sweet Family.</p><p><a href="${inviteUrl}">Accept your invitation &amp; set your password</a></p><p>This link expires in 7 days.</p>`,
        });
      } catch (mailErr) {
        console.error('Invitation email failed (link still returned to owner):', mailErr);
      }

      res.status(201).json({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          permissions: invitation.permissions,
          expiresAt: invitation.expiresAt,
        },
        inviteUrl,
      });
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
        include: { family: { include: { members: true } } },
      });
      if (!member) return res.status(404).json({ error: 'Member not found' });
      if (!isParent(member.family, req.user.id))
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
      include: { family: { include: { members: true } } },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!isParent(member.family, req.user.id))
      return res.status(403).json({ error: 'Only owner can remove members' });

    await prisma.familyMember.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
