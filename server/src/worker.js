// Dedicated transcode worker process. Deploy this as its own Railway service
// (start command: `npm run worker`) sharing the same repo, DATABASE_URL, and
// storage env as the API. Then set DISABLE_INLINE_WORKER=true on the API service
// so only this process transcodes. You can run several worker instances safely —
// the DB-backed queue claims jobs atomically (FOR UPDATE SKIP LOCKED).
require('dotenv').config();
const prisma = require('./lib/prisma');
const { runWorkerLoop, stopWorkerLoop } = require('./lib/transcodeQueue');

console.log('[worker] transcode worker booting');
runWorkerLoop({ pollMs: Number(process.env.WORKER_POLL_MS) || 5000 }).catch((e) => {
  console.error('[worker] fatal:', e.message);
  process.exit(1);
});

const shutdown = async () => {
  console.log('[worker] shutting down');
  stopWorkerLoop();
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
