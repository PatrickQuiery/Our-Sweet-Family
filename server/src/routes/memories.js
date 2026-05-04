const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const xss = require('xss');
const { fromBuffer } = require('file-type');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { uploadFile } = require('../lib/storage');
const { calculateAgeLabel } = require('../lib/ageLabel');

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/vnd.avi',
  'video/x-matroska', 'video/x-m4v',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|m4v/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

async function extractExifDate(buffer, mimetype) {
  try {
    const exifr = require('exifr');
    if (mimetype.startsWith('image/')) {
      const exif = await exifr.parse(buffer, ['DateTimeOriginal', 'CreateDate', 'DateTime']);
      if (exif) {
        return exif.DateTimeOriginal || exif.CreateDate || exif.DateTime || null;
      }
    }
  } catch (e) {
    // ignore EXIF errors
  }
  return null;
}

async function generateThumbnail(buffer, mimetype, originalName) {
  if (!mimetype.startsWith('image/')) return null;

  try {
    const thumbBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbName = path.basename(originalName, path.extname(originalName)) + '_thumb.jpg';
    return { buffer: thumbBuffer, name: thumbName };
  } catch (e) {
    console.error('Thumbnail generation failed:', e);
    return null;
  }
}

// Verify the calling user has read access to a specific memory.
// Returns { memory } on success or { error, status } on failure.
async function requireMemoryAccess(req, memoryId) {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { family: { include: { members: true } } },
  });
  if (!memory) return { error: 'Memory not found', status: 404 };

  const isOwner = memory.family.ownerId === req.user.id;
  const membership = memory.family.members.find((m) => m.userId === req.user.id);

  if (!isOwner && !membership) return { error: 'Access denied', status: 403 };
  if (!isOwner && memory.isClassified) return { error: 'Access denied', status: 403 };

  if (!isOwner && membership && membership.accessPerChild !== 'all') {
    const allowedChildren = Array.isArray(membership.accessPerChild)
      ? membership.accessPerChild
      : JSON.parse(membership.accessPerChild);
    const rawChildIds = Array.isArray(memory.childIds)
      ? memory.childIds
      : JSON.parse(memory.childIds || '[]');
    const hasAccess =
      rawChildIds.length === 0 || rawChildIds.some((cid) => allowedChildren.includes(cid));
    if (!hasAccess) return { error: 'Access denied', status: 403 };
  }

  return { memory };
}

// GET /api/memories?familyId=&childId=&page=&limit=&type=
router.get('/', authenticate, async (req, res) => {
  const { familyId, childId, type } = req.query;
  const pageNum = Math.max(1, Math.min(parseInt(req.query.page) || 1, 10000));
  const limitNum = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 100));

  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = family.ownerId === req.user.id;
    const membership = family.members.find((m) => m.userId === req.user.id);

    if (!isOwner && !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = { familyId };

    if (!isOwner) {
      where.isClassified = false;
    }

    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      where.OR = allowedChildren.map((cid) => ({
        childIds: { array_contains: [cid] },
      }));
    }

    if (childId) {
      where.AND = [{ childIds: { array_contains: [childId] } }];
    }

    if (type && ['photo', 'video'].includes(type)) {
      where.fileType = type;
    }

    const skip = (pageNum - 1) * limitNum;

    const [total, memories] = await Promise.all([
      prisma.memory.count({ where }),
      prisma.memory.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    const children = await prisma.child.findMany({ where: { familyId } });
    const childMap = Object.fromEntries(children.map((c) => [c.id, c]));

    const enriched = memories.map((m) => {
      const childIds = Array.isArray(m.childIds) ? m.childIds : JSON.parse(m.childIds || '[]');
      const ageLabels = childIds.map((cid) => {
        const child = childMap[cid];
        if (!child) return null;
        return {
          childId: cid,
          childName: child.name,
          ageLabel: calculateAgeLabel(child.dateOfBirth, m.capturedAt),
        };
      }).filter(Boolean);

      return { ...m, childIds, ageLabels };
    });

    res.json({
      memories: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/memories/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const memory = await prisma.memory.findUnique({
      where: { id: req.params.id },
      include: {
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        family: { include: { members: true, children: true } },
      },
    });

    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    const isOwner = memory.family.ownerId === req.user.id;
    const membership = memory.family.members.find((m) => m.userId === req.user.id);

    if (!isOwner && !membership) return res.status(403).json({ error: 'Access denied' });
    if (!isOwner && memory.isClassified) return res.status(403).json({ error: 'Access denied' });

    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      const rawChildIds = Array.isArray(memory.childIds)
        ? memory.childIds
        : JSON.parse(memory.childIds || '[]');
      const hasAccess =
        rawChildIds.length === 0 || rawChildIds.some((cid) => allowedChildren.includes(cid));
      if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
    }

    const childIds = Array.isArray(memory.childIds) ? memory.childIds : JSON.parse(memory.childIds || '[]');
    const ageLabels = childIds.map((cid) => {
      const child = memory.family.children.find((c) => c.id === cid);
      if (!child) return null;
      return {
        childId: cid,
        childName: child.name,
        ageLabel: calculateAgeLabel(child.dateOfBirth, memory.capturedAt),
      };
    }).filter(Boolean);

    res.json({ memory: { ...memory, childIds, ageLabels } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/memories — upload a photo or video
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { familyId, childIds, caption, isClassified, capturedAtOverride } = req.body;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  // Validate file magic bytes against extension to prevent type confusion attacks
  const detectedType = await fromBuffer(req.file.buffer);
  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
    return res.status(400).json({ error: 'File content does not match an allowed media type' });
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = family.ownerId === req.user.id;
    const membership = family.members.find((m) => m.userId === req.user.id);
    if (!isOwner && !membership) return res.status(403).json({ error: 'Access denied' });

    if (!isOwner && membership && !['upload', 'all'].includes(membership.permissions)) {
      return res.status(403).json({ error: 'No upload permission' });
    }

    const fileType = detectedType.mime.startsWith('video/') ? 'video' : 'photo';

    let capturedAt = null;
    if (capturedAtOverride) {
      const override = new Date(capturedAtOverride);
      if (isNaN(override.getTime())) {
        return res.status(400).json({ error: 'Invalid capturedAt date' });
      }
      if (override > new Date()) {
        return res.status(400).json({ error: 'capturedAt cannot be in the future' });
      }
      capturedAt = override;
    }
    if (!capturedAt) {
      const exifDate = await extractExifDate(req.file.buffer, detectedType.mime);
      capturedAt = exifDate ? new Date(exifDate) : new Date();
    }

    const fileUrl = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      detectedType.mime,
      'memories'
    );

    let thumbnailUrl = null;
    if (fileType === 'photo') {
      const thumb = await generateThumbnail(req.file.buffer, detectedType.mime, req.file.originalname);
      if (thumb) {
        thumbnailUrl = await uploadFile(thumb.buffer, thumb.name, 'image/jpeg', 'thumbnails');
      }
    }

    const parsedChildIds = childIds
      ? (Array.isArray(childIds) ? childIds : JSON.parse(childIds))
      : [];

    const canClassify = req.user.plan === 'premium' && isOwner;

    const memory = await prisma.memory.create({
      data: {
        familyId,
        childIds: parsedChildIds,
        uploadedById: req.user.id,
        fileUrl,
        thumbnailUrl,
        fileType,
        originalQuality: ['plus', 'premium'].includes(req.user.plan),
        capturedAt,
        isClassified: canClassify && isClassified === 'true',
        caption: caption || null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ memory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/memories/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const memory = await prisma.memory.findUnique({
      where: { id: req.params.id },
      include: { family: true },
    });
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    if (memory.family.ownerId !== req.user.id && memory.uploadedById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.memory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/memories/:id/reactions
router.post('/:id/reactions', authenticate, async (req, res) => {
  try {
    const { error, status } = await requireMemoryAccess(req, req.params.id);
    if (error) return res.status(status).json({ error });

    const reaction = await prisma.reaction.upsert({
      where: {
        memoryId_userId_type: {
          memoryId: req.params.id,
          userId: req.user.id,
          type: 'love',
        },
      },
      update: {},
      create: {
        memoryId: req.params.id,
        userId: req.user.id,
        type: 'love',
      },
    });
    res.status(201).json({ reaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/memories/:id/reactions
router.delete('/:id/reactions', authenticate, async (req, res) => {
  try {
    const { error, status } = await requireMemoryAccess(req, req.params.id);
    if (error) return res.status(status).json({ error });

    await prisma.reaction.deleteMany({
      where: { memoryId: req.params.id, userId: req.user.id, type: 'love' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/memories/:id/comments
router.post('/:id/comments', authenticate, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

  try {
    const { error, status } = await requireMemoryAccess(req, req.params.id);
    if (error) return res.status(status).json({ error });

    // Strip all HTML to prevent stored XSS
    const sanitized = xss(text.trim(), { whiteList: {}, stripIgnoreTag: true });
    if (!sanitized) return res.status(400).json({ error: 'Comment text required' });

    const comment = await prisma.comment.create({
      data: {
        memoryId: req.params.id,
        userId: req.user.id,
        text: sanitized,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/memories/:memoryId/comments/:commentId
router.delete('/:memoryId/comments/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
