const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { isParent } = require('../lib/familyAccess');
const { hashInviteToken } = require('../lib/inviteToken');

const router = express.Router();

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
    const family = await prisma.family.findUnique({ where: { id: familyId }, include: { members: true } });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (!isParent(family, req.user.id)) {
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

// POST /api/invitations/:token/claim — the invitee has signed in via Clerk; link
// their (now verified) account to the family. Their Clerk email must match the
// address the invitation was sent to.
router.post('/:token/claim', authenticate, async (req, res) => {
  try {
    const result = await loadPendingInvitation(req.params.token);
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { invitation } = result;

    if ((req.user.email || '').toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        error: 'This invitation was sent to a different email address. Sign in with that email to accept.',
      });
    }

    const alreadyMember = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: invitation.familyId, userId: req.user.id } },
    });
    if (!alreadyMember) {
      await prisma.familyMember.create({
        data: {
          familyId: invitation.familyId,
          userId: req.user.id,
          permissions: invitation.permissions,
          accessPerChild: invitation.accessPerChild,
        },
      });
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    res.json({ success: true, familyId: invitation.familyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/invitations/:id — owner revokes a pending invitation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { members: true } } },
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (!isParent(invitation.family, req.user.id)) {
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
