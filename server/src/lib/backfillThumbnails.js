const { uploadFile, deleteFile, readFile, isAbsoluteUrl } = require('./storage');
const { generateThumbnail } = require('./thumbnails');
const { extractPosterBuffer } = require('./videoPoster');

// One-time, self-converging backfill: give photos the current hi-res (800px)
// thumbnail and give videos a poster-frame still, then flip `thumbHiRes`. Runs
// non-blocking on boot; once everything is upgraded the query returns nothing.

async function readKeyToBuffer(key) {
  const { stream } = await readFile(key);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Returns 'upgraded' | 'skipped'. Throws on unexpected failure (caller retries later).
async function upgradeOne(prisma, m) {
  const { id, fileUrl, thumbnailUrl, fileType } = m;

  // External/seed images (absolute URLs) aren't ours to rewrite — mark done.
  if (!fileUrl || isAbsoluteUrl(fileUrl)) {
    await prisma.memory.update({ where: { id }, data: { thumbHiRes: true } });
    return 'skipped';
  }

  const srcBuffer = await readKeyToBuffer(fileUrl);
  // Photos: a hi-res thumbnail from the image. Videos: a poster-frame still.
  const newBuffer = fileType === 'video'
    ? await extractPosterBuffer(srcBuffer)
    : (await generateThumbnail(srcBuffer, 'image/jpeg', fileUrl))?.buffer ?? null;

  if (!newBuffer) {
    // Couldn't derive a still (undecodable / no frame) — don't retry forever.
    await prisma.memory.update({ where: { id }, data: { thumbHiRes: true } });
    return 'skipped';
  }

  const newKey = await uploadFile(newBuffer, fileType === 'video' ? 'poster.jpg' : 'thumb.jpg', 'image/jpeg', 'thumbnails');
  await prisma.memory.update({ where: { id }, data: { thumbnailUrl: newKey, thumbHiRes: true } });

  // Clean up the old thumbnail if it was one of ours and got replaced.
  if (thumbnailUrl && thumbnailUrl !== newKey && !isAbsoluteUrl(thumbnailUrl)) {
    await deleteFile(thumbnailUrl);
  }
  return 'upgraded';
}

/**
 * Backfill photo thumbnails that predate the hi-res change.
 * Best-effort: individual failures are logged and retried on a later boot.
 */
async function backfillThumbnails(prisma, { batchSize = 25, maxTotal = 2000 } = {}) {
  let processed = 0;
  let upgraded = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds = [];

  while (processed < maxTotal) {
    const batch = await prisma.memory.findMany({
      where: {
        thumbHiRes: false,
        ...(failedIds.length ? { id: { notIn: failedIds } } : {}),
      },
      take: batchSize,
      select: { id: true, fileUrl: true, thumbnailUrl: true, fileType: true },
    });
    if (batch.length === 0) break;

    for (const m of batch) {
      processed++;
      try {
        const result = await upgradeOne(prisma, m);
        if (result === 'upgraded') upgraded++;
        else skipped++;
      } catch (e) {
        failed++;
        failedIds.push(m.id); // don't reselect this run; retries next boot
        console.error(`[thumb-backfill] ${m.id} failed:`, e.message);
      }
    }
  }

  if (processed) {
    console.log(`[thumb-backfill] processed=${processed} upgraded=${upgraded} skipped=${skipped} failed=${failed}`);
  }
  return { processed, upgraded, skipped, failed };
}

module.exports = { backfillThumbnails, upgradeOne };
