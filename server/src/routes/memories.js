const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { uploadFile } = require('../lib/storage');
const { calculateAgeLabel } = require('../lib/ageLabel');

const router = express.Router();

// Store in memory for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
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

// GET /api/memories?familyId=&childId=&page=&limit=&type=
router.get('/', authenticate, async (req, res) => {
  const { familyId, childId, page = 1, limit = 20, type } = req.query;

  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    // Check access
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

    // Build filter
    const where = { familyId };

    // Non-owners cannot see classified memories
    if (!isOwner) {
      where.isClassified = false;
    }

    // Per-child access filter for loved ones
    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);

      // Use OR so that memories tagged with ANY allowed child are returned.
      // Using array_contains with the full array would require ALL allowed children
      // to appear on every memory, which is far too restrictive.
      where.OR = allowedChildren.map((cid) => ({
        childIds: { path: '$', array_contains: [cid] },
      }));
    }

    if (childId) {
      // JSON array contains childId
      where.AND = [
        { childIds: { path: '$', array_contains: [childId] } },
      ];
    }

    if (type && ['photo', 'video'].includes(type)) {
      where.fileType = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [total, memories] = await Promise.all([
      prisma.memory.count({ where }),
      prisma.memory.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        skip,
        take,
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

    // Enrich with age labels
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
        page: parseInt(page),
        limit: take,
        pages: Math.ceil(total / take),
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

    // Enforce per-child access restrictions for members
    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      const rawChildIds = Array.isArray(memory.childIds)
        ? memory.childIds
        : JSON.parse(memory.childIds || '[]');
      // Untagged memories (no childIds) are visible to all members;
      // tagged memories require at least one child to be in the allowed list.
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

  try {
    // Check ownership
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = family.ownerId === req.user.id;
    const membership = family.members.find((m) => m.userId === req.user.id);
    if (!isOwner && !membership) return res.status(403).json({ error: 'Access denied' });

    // Check upload permission for members
    if (!isOwner && membership && !['upload', 'all'].includes(membership.permissions)) {
      return res.status(403).json({ error: 'No upload permission' });
    }

    const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'photo';

    // Extract EXIF date
    let capturedAt = capturedAtOverride ? new Date(capturedAtOverride) : null;
    if (!capturedAt) {
      const exifDate = await extractExifDate(req.file.buffer, req.file.mimetype);
      capturedAt = exifDate ? new Date(exifDate) : new Date();
    }

    // Upload original
    const fileUrl = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'memories'
    );

    // Generate & upload thumbnail (photos only)
    let thumbnailUrl = null;
    if (fileType === 'photo') {
      const thumb = await generateThumbnail(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (thumb) {
        thumbnailUrl = await uploadFile(thumb.buffer, thumb.name, 'image/jpeg', 'thumbnails');
      }
    }

    const parsedChildIds = childIds
      ? (Array.isArray(childIds) ? childIds : JSON.parse(childIds))
      : [];

    // Premium check for classified memories
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
    const comment = await prisma.comment.create({
      data: {
        memoryId: req.params.id,
        userId: req.user.id,
        text: text.trim(),
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
