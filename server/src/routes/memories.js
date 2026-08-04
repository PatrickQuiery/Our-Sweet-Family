const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { uploadFile, deleteFile, readFile, isAbsoluteUrl } = require('../lib/storage');
const { calculateAgeLabel } = require('../lib/ageLabel');
const { loadAccessibleMemory } = require('../lib/memoryAccess');
const { mediaRefs } = require('../lib/mediaRef');
const { effectivePlan } = require('../lib/plan');
const { reverseGeocode } = require('../lib/geocode');
const { isParent } = require('../lib/familyAccess');

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

// Pull GPS coordinates from a photo's EXIF, if present. Returns null for videos
// (exifr doesn't read container metadata) and for photos without/with stripped
// location. Coordinates are sensitive and only ever surfaced to the family owner.
async function extractExifGps(buffer, mimetype) {
  try {
    if (mimetype.startsWith('image/')) {
      const exifr = require('exifr');
      const gps = await exifr.gps(buffer);
      if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
        return { latitude: gps.latitude, longitude: gps.longitude };
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

    const isOwner = isParent(family, req.user.id);
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
      // NOTE: PostgreSQL Json filtering uses `array_contains` with no `path`
      // (the MySQL `path: '$'` form is rejected by the Postgres connector).
      where.OR = allowedChildren.map((cid) => ({
        childIds: { array_contains: [cid] },
      }));
    }

    if (childId) {
      // JSON array contains childId (Postgres: array_contains, no path)
      where.AND = [
        { childIds: { array_contains: [childId] } },
      ];
    }

    if (type && ['photo', 'video'].includes(type)) {
      where.fileType = type;
    }

    // Coerce & clamp pagination so bad input can't 500 (NaN skip) or request an
    // unbounded page (limit clamped to 100).
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

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

      const shaped = mediaRefs({ ...m, childIds, ageLabels });
      // The feed never carries location — it only ever appears on the owner's
      // single-memory view.
      delete shaped.latitude;
      delete shaped.longitude;
      delete shaped.locationCity;
      delete shaped.locationState;
      return shaped;
    });

    res.json({
      memories: enriched,
      pagination: {
        total,
        page: pageNum,
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

    const isOwner = isParent(memory.family, req.user.id);
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

    const shaped = mediaRefs({ ...memory, childIds, ageLabels });
    // Location is owner-only AND gated behind the family's opt-in setting. GPS is
    // always captured/stored; it's only ever shown when the owner has turned the
    // feature on — and even then, only to the owner.
    const showLocation = isOwner && memory.family.showPhotoLocation;
    if (!showLocation) {
      delete shaped.latitude;
      delete shaped.longitude;
      delete shaped.locationCity;
      delete shaped.locationState;
    }
    res.json({ memory: shaped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/memories/:id/file  and  /:id/thumb — authenticated media streaming.
// Runs the same access gate as the memory itself, then streams the bytes. There is
// no unauthenticated path to media any more.
async function streamMedia(req, res, variant) {
  try {
    const access = await loadAccessibleMemory(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { memory } = access;

    const key = variant === 'thumb' ? (memory.thumbnailUrl || memory.fileUrl) : memory.fileUrl;
    if (!key) return res.status(404).json({ error: 'Media not found' });

    // Legacy/external absolute URLs: redirect rather than proxy.
    if (isAbsoluteUrl(key)) return res.redirect(302, key);

    const { stream, contentType } = await readFile(key);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    stream.on('error', (err) => {
      console.error('media stream error:', err.message);
      if (!res.headersSent) res.status(404).json({ error: 'Media not found' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
}

router.get('/:id/file', authenticate, (req, res) => streamMedia(req, res, 'file'));
router.get('/:id/thumb', authenticate, (req, res) => streamMedia(req, res, 'thumb'));

// POST /api/memories — upload a photo or video
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { familyId, childIds, caption, isClassified, capturedAtOverride } = req.body;
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  try {
    // Check ownership
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true, owner: { select: { plan: true, planBoostUntil: true } } },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const isOwner = isParent(family, req.user.id);
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

    // Extract EXIF GPS (photos only) and reverse-geocode to City/State once, now,
    // so it's never recomputed on read. Both are stored regardless of the family's
    // display setting; visibility is enforced at read time.
    const gps = await extractExifGps(req.file.buffer, req.file.mimetype);
    const place = gps ? await reverseGeocode(gps.latitude, gps.longitude) : null;

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

    let parsedChildIds = [];
    if (childIds) {
      try {
        parsedChildIds = Array.isArray(childIds) ? childIds : JSON.parse(childIds);
      } catch {
        return res.status(400).json({ error: 'childIds must be a JSON array' });
      }
      if (!Array.isArray(parsedChildIds)) {
        return res.status(400).json({ error: 'childIds must be a JSON array' });
      }
    }

    // Storage tier and classified access follow the family OWNER's plan (the
    // subscription holder), so a relative's contribution keeps the family's tier.
    const ownerPlan = effectivePlan(family.owner);
    const canClassify = ownerPlan === 'premium' && isOwner;

    const memory = await prisma.memory.create({
      data: {
        familyId,
        childIds: parsedChildIds,
        uploadedById: req.user.id,
        fileUrl,
        thumbnailUrl,
        fileType,
        size: req.file.size ?? null,
        originalQuality: ['plus', 'premium'].includes(ownerPlan),
        capturedAt,
        isClassified: canClassify && isClassified === 'true',
        caption: caption || null,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
        locationCity: place?.city ?? null,
        locationState: place?.state ?? null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ memory: mediaRefs(memory) });
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
      include: { family: { include: { members: true } } },
    });
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    if (!isParent(memory.family, req.user.id) && memory.uploadedById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.memory.delete({ where: { id: req.params.id } });

    // Best-effort storage cleanup so deleted memories don't leak files/cost.
    await deleteFile(memory.fileUrl);
    await deleteFile(memory.thumbnailUrl);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/memories/:id — edit an existing memory's child tags and/or caption.
// This is how a memory uploaded without tags (or tagged incorrectly) gets fixed
// after the fact; without it, an untagged memory never surfaces under a child
// filter. Only the family owner or the original uploader may edit, mirroring
// the delete authorization.
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const memory = await prisma.memory.findUnique({
      where: { id: req.params.id },
      include: { family: { include: { children: true, members: true } } },
    });
    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    const isOwner = isParent(memory.family, req.user.id);
    const isUploader = memory.uploadedById === req.user.id;
    if (!isOwner && !isUploader) return res.status(403).json({ error: 'Access denied' });

    const data = {};

    if (req.body.childIds !== undefined) {
      const { childIds } = req.body;
      if (!Array.isArray(childIds)) {
        return res.status(400).json({ error: 'childIds must be an array' });
      }
      const validIds = new Set(memory.family.children.map((c) => c.id));
      if (!childIds.every((cid) => validIds.has(cid))) {
        return res.status(400).json({ error: 'childIds must reference children in this family' });
      }
      data.childIds = childIds;
    }

    if (req.body.caption !== undefined) {
      data.caption = req.body.caption || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.memory.update({
      where: { id: req.params.id },
      data,
      include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const childIds = Array.isArray(updated.childIds)
      ? updated.childIds
      : JSON.parse(updated.childIds || '[]');
    const ageLabels = childIds
      .map((cid) => {
        const child = memory.family.children.find((c) => c.id === cid);
        if (!child) return null;
        return {
          childId: cid,
          childName: child.name,
          ageLabel: calculateAgeLabel(child.dateOfBirth, updated.capturedAt),
        };
      })
      .filter(Boolean);

    res.json({ memory: mediaRefs({ ...updated, childIds, ageLabels }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/memories/:id/reactions
router.post('/:id/reactions', authenticate, async (req, res) => {
  try {
    const access = await loadAccessibleMemory(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

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
    const access = await loadAccessibleMemory(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

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
    const access = await loadAccessibleMemory(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

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
