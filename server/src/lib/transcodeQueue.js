const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const prisma = require('./prisma');
const { uploadFile, readFile, deleteFile } = require('./storage');
const { runFfmpeg } = require('./transcode');

const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 15;

// Enqueue a video for background transcoding (called by the API on upload).
async function enqueueTranscode(memoryId, sourceKey) {
  return prisma.transcodeJob.create({ data: { memoryId, sourceKey } });
}

// Atomically claim the next pending (or stale-processing, i.e. crashed) job.
// Postgres FOR UPDATE SKIP LOCKED lets many workers pull safely in parallel.
async function claimNextJob() {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE "TranscodeJob"
    SET status = 'processing', "startedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "TranscodeJob"
      WHERE status = 'pending'
         OR (status = 'processing' AND "startedAt" < now() - interval '${STALE_MINUTES} minutes')
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`);
  return rows[0] || null;
}

// Do the work for one claimed job: pull the original from storage, transcode,
// swap it into the memory (reclaiming the original), and mark the job done. On
// failure, retry until MAX_ATTEMPTS, then give up and keep the original.
async function processJob(job) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-tj-'));
  const inPath = path.join(dir, 'in');
  const outPath = path.join(dir, 'out.mp4');
  try {
    const { stream } = await readFile(job.sourceKey);
    await pipeline(stream, fs.createWriteStream(inPath));
    const inSize = fs.statSync(inPath).size;

    await runFfmpeg(inPath, outPath);
    const out = fs.readFileSync(outPath);

    if (out.length > 0 && out.length < inSize) {
      const compressedKey = await uploadFile(out, 'compressed.mp4', 'video/mp4', 'memories');
      await prisma.memory.update({
        where: { id: job.memoryId },
        data: { fileUrl: compressedKey, size: out.length, processing: false },
      });
      await deleteFile(job.sourceKey); // reclaim the original's storage
      console.log(`[transcode] job ${job.id}: ${inSize} -> ${out.length} bytes`);
    } else {
      // Compression didn't help — keep the original.
      await prisma.memory.update({ where: { id: job.memoryId }, data: { processing: false } });
    }
    await prisma.transcodeJob.update({
      where: { id: job.id },
      data: { status: 'done', finishedAt: new Date(), error: null },
    });
  } catch (e) {
    const giveUp = job.attempts >= MAX_ATTEMPTS;
    console.error(`[transcode] job ${job.id} failed (attempt ${job.attempts}${giveUp ? ', giving up' : ''}):`, e.message);
    await prisma.transcodeJob.update({
      where: { id: job.id },
      data: {
        status: giveUp ? 'failed' : 'pending',
        error: String(e.message).slice(0, 500),
        ...(giveUp ? { finishedAt: new Date() } : {}),
      },
    });
    if (giveUp) {
      // Stop showing the memory as "processing"; the original stays as its file.
      try { await prisma.memory.update({ where: { id: job.memoryId }, data: { processing: false } }); } catch { /* memory gone */ }
    }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

let running = false;

// Long-running loop: claim → process → repeat, sleeping when idle. Safe to run
// in several processes at once (the claim is atomic). Runs one job at a time per
// process; scale by adding worker processes.
async function runWorkerLoop({ pollMs = 5000 } = {}) {
  if (running) return;
  running = true;
  console.log('[transcode] worker loop started');
  while (running) {
    let job = null;
    try {
      job = await claimNextJob();
    } catch (e) {
      console.error('[transcode] claim error:', e.message);
    }
    if (job) {
      await processJob(job);
    } else {
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  console.log('[transcode] worker loop stopped');
}

function stopWorkerLoop() {
  running = false;
}

module.exports = { enqueueTranscode, claimNextJob, processJob, runWorkerLoop, stopWorkerLoop, MAX_ATTEMPTS };
