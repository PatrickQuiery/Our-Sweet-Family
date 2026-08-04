const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { uploadFile, deleteFile, readFile, isAbsoluteUrl } = require('../lib/storage');
const { isParent } = require('../lib/familyAccess');

const router = express.Router();

// Avatars are small images; keep them in memory for processing, cap the size,
// and only accept image types.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

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
    body('gender').optional({ values: 'falsy' }).isIn(['male', 'female']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { familyId, name, dateOfBirth, gender } = req.body;

    try {
      const family = await prisma.family.findUnique({ where: { id: familyId }, include: { members: true } });
      if (!family) return res.status(404).json({ error: 'Family not found' });
      if (!isParent(family, req.user.id))
        return res.status(403).json({ error: 'Only owner can add children' });

      const child = await prisma.child.create({
        data: { familyId, name, dateOfBirth: new Date(dateOfBirth), gender: gender || null },
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
  [
    body('name').optional().trim().notEmpty(),
    body('gender').optional({ values: 'falsy' }).isIn(['male', 'female']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const child = await prisma.child.findUnique({
        where: { id: req.params.id },
        include: { family: { include: { members: true } } },
      });
      if (!child) return res.status(404).json({ error: 'Child not found' });
      if (!isParent(child.family, req.user.id))
        return res.status(403).json({ error: 'Only owner can update child' });

      const { name, dateOfBirth, gender, avatarUrl } = req.body;
      const updated = await prisma.child.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(gender !== undefined && { gender: gender || null }),
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

// POST /api/children/:id/avatar — owner uploads a profile image for a child.
// Stored as a private key (like memories) and served via GET below.
router.post('/:id/avatar', authenticate, avatarUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { members: true } } },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (!isParent(child.family, req.user.id))
      return res.status(403).json({ error: 'Only owner can update child' });

    // Normalize to a square JPEG; fall back to the raw upload if it can't be processed.
    let buffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    let name = req.file.originalname;
    try {
      buffer = await sharp(req.file.buffer).rotate().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
      mimeType = 'image/jpeg';
      name = 'avatar.jpg';
    } catch {
      // keep the original bytes
    }

    const key = await uploadFile(buffer, name, mimeType, 'avatars');
    const updated = await prisma.child.update({
      where: { id: req.params.id },
      data: { avatarUrl: key },
    });

    // Best-effort cleanup of the previous avatar file (skip external seed URLs).
    if (child.avatarUrl && !isAbsoluteUrl(child.avatarUrl)) await deleteFile(child.avatarUrl);

    res.json({ child: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/children/:id/avatar — authenticated streaming of a child's avatar,
// gated to family members (avatars are private media, like memories).
router.get('/:id/avatar', authenticate, async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { members: true } } },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const isMember =
      child.family.ownerId === req.user.id ||
      child.family.members.some((m) => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });
    if (!child.avatarUrl) return res.status(404).json({ error: 'No avatar' });
    if (isAbsoluteUrl(child.avatarUrl)) return res.redirect(302, child.avatarUrl);

    const { stream, contentType } = await readFile(child.avatarUrl);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    stream.on('error', (err) => {
      console.error('avatar stream error:', err.message);
      if (!res.headersSent) res.status(404).json({ error: 'Avatar not found' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/children/:id/avatar — owner removes a child's profile image.
router.delete('/:id/avatar', authenticate, async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { members: true } } },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (!isParent(child.family, req.user.id))
      return res.status(403).json({ error: 'Only owner can update child' });

    const updated = await prisma.child.update({
      where: { id: req.params.id },
      data: { avatarUrl: null },
    });
    if (child.avatarUrl && !isAbsoluteUrl(child.avatarUrl)) await deleteFile(child.avatarUrl);

    res.json({ child: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/children/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { members: true } } },
    });
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (!isParent(child.family, req.user.id))
      return res.status(403).json({ error: 'Only owner can remove child' });

    await prisma.child.delete({ where: { id: req.params.id } });

    // childIds is a JSON array (no FK), so removal isn't cascaded. Strip the
    // deleted child's id from any memory it was tagged on to avoid dangling tags.
    const tagged = await prisma.memory.findMany({
      where: { familyId: child.familyId, childIds: { array_contains: [req.params.id] } },
      select: { id: true, childIds: true },
    });
    for (const m of tagged) {
      const ids = Array.isArray(m.childIds) ? m.childIds : [];
      await prisma.memory.update({
        where: { id: m.id },
        data: { childIds: ids.filter((c) => c !== req.params.id) },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
