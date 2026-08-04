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

// A display-quality compressed photo (max 1600px, JPEG q72) — what free plans
// store in place of the original, to save storage.
async function compressPhoto(buffer) {
  try {
    const out = await sharp(buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { buffer: out };
  } catch (e) {
    console.error('Photo compression failed:', e);
    return null;
  }
}

// GET /api/memories?familyId=&childId=&page=&limit=&type=
router.get('/', authenticate, async (req, res) => {
  const { familyId, childId, page = 1, limit = 20, type, search } = req.query;

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

    // Build filter. Everything AND-combines via an `and` array so the per-child
    // access OR doesn't collide with the search OR.
    const where = { familyId };
    const and = [];

    // Non-owners cannot see classified memories
    if (!isOwner) {
      where.isClassified = false;
    }

    if (type && ['photo', 'video'].includes(type)) {
      where.fileType = type;
    }

    // Per-child access filter for loved ones (OR of allowed children).
    // NOTE: PostgreSQL Json filtering uses `array_contains` with no `path`.
    if (!isOwner && membership && membership.accessPerChild !== 'all') {
      const allowedChildren = Array.isArray(membership.accessPerChild)
        ? membership.accessPerChild
        : JSON.parse(membership.accessPerChild);
      and.push({ OR: allowedChildren.map((cid) => ({ childIds: { array_contains: [cid] } })) });
    }

    if (childId) {
      and.push({ childIds: { array_contains: [childId] } });
    }

    // Fuzzy search: each whitespace-separated term must match (substring,
    // case-insensitive) either the caption or a tag (via the tagsText column).
    if (search && String(search).trim()) {
      const terms = String(search).trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
      for (const tm of terms) {
        and.push({
          OR: [
            { caption: { contains: tm, mode: 'insensitive' } },
            { tagsText: { contains: tm } },
          ],
        });
      }
    }

    if (and.length) where.AND = and;

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

// Download permission: original files are a paid-plan feature ("export & download
// originals"), and among invited members only those granted share/download — or a
// Parent — may download.
function downloadAllowed({ isParent, membership, plan }) {
  if (!['plus', 'premium'].includes(plan)) return false;
  return isParent || (membership && ['share_download', 'all'].includes(membership.permissions));
}

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
        family: { include: { members: true, children: true, owner: { select: { plan: true, planBoostUntil: true } } } },
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
    // Tell the client whether this viewer may download the original.
    shaped.canDownload = downloadAllowed({
      isParent: isOwner,
      membership,
      plan: effectivePlan(memory.family.owner),
    });
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

// GET /api/memories/:id/download — permission-gated download of the ORIGINAL file,
// served with a Content-Disposition attachment so the browser saves it to the device.
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const access = await loadAccessibleMemory(req.params.id, req.user); // view gate
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { memory, isOwner, membership } = access;

    const owner = await prisma.user.findUnique({
      where: { id: memory.family.ownerId },
      select: { plan: true, planBoostUntil: true },
    });
    const plan = effectivePlan(owner);
    if (!downloadAllowed({ isParent: isOwner, membership, plan })) {
      return res.status(403).json({
        error: ['plus', 'premium'].includes(plan)
          ? 'You do not have permission to download this'
          : 'Downloading originals requires a Plus or Premium plan',
      });
    }

    const key = memory.fileUrl;
    if (isAbsoluteUrl(key)) return res.redirect(302, key);

    const { stream, contentType } = await readFile(key);
    const ext = path.extname(key) || (memory.fileType === 'video' ? '.mp4' : '.jpg');
    const base = (memory.caption || 'memory').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'memory';
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${base}${ext}"`);
    res.set('Cache-Control', 'private, no-store');
    stream.on('error', (err) => {
      console.error('download stream error:', err.message);
      if (!res.headersSent) res.status(404).json({ error: 'File not found' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/memories — upload a photo or video
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { familyId, childIds, tags, caption, isClassified, capturedAtOverride } = req.body;
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

    // Storage tier follows the family OWNER's (effective) plan. Paid plans keep
    // the ORIGINAL file; free plans store a COMPRESSED photo to save storage.
    // (Video transcoding needs a separate pipeline, so videos are stored as-is.)
    const ownerPlan = effectivePlan(family.owner);
    const isPaid = ['plus', 'premium'].includes(ownerPlan);

    let uploadBuffer = req.file.buffer;
    let uploadName = req.file.originalname;
    let uploadMime = req.file.mimetype;
    if (fileType === 'photo' && !isPaid) {
      const compressed = await compressPhoto(req.file.buffer);
      if (compressed) {
        uploadBuffer = compressed.buffer;
        uploadName = 'compressed.jpg';
        uploadMime = 'image/jpeg';
      }
    }
    const fileUrl = await uploadFile(uploadBuffer, uploadName, uploadMime, 'memories');

    // Generate & upload thumbnail (photos only) — always derived from the original.
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

    // Free-text tags: normalized (trimmed, lowercased), de-duped, capped.
    let parsedTags = [];
    if (tags) {
      try {
        const raw = Array.isArray(tags) ? tags : JSON.parse(tags);
        if (Array.isArray(raw)) {
          parsedTags = [...new Set(raw.map((t) => String(t).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
        }
      } catch {
        /* ignore malformed tags — they're optional */
      }
    }

    // Classified access follows the family OWNER's plan (the subscription holder).
    const canClassify = ownerPlan === 'premium' && isOwner;

    const memory = await prisma.memory.create({
      data: {
        familyId,
        childIds: parsedChildIds,
        tags: parsedTags,
        tagsText: parsedTags.length ? parsedTags.join(' ') : null,
        uploadedById: req.user.id,
        fileUrl,
        thumbnailUrl,
        fileType,
        size: uploadBuffer.length, // bytes actually stored (compressed for free-plan photos)
        originalQuality: isPaid,
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

    if (req.body.tags !== undefined) {
      const raw = req.body.tags;
      if (!Array.isArray(raw)) return res.status(400).json({ error: 'tags must be an array' });
      data.tags = [...new Set(raw.map((t) => String(t).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
      data.tagsText = data.tags.length ? data.tags.join(' ') : null;
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
