require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Fail fast before accepting any traffic. clerkMiddleware() authenticates EVERY
// request and needs BOTH keys — a missing publishable key makes it throw on every
// request (including public ones), so require both here rather than 500 silently.
const missingClerkEnv = ['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'].filter(
  (k) => !process.env[k]
);
if (missingClerkEnv.length) {
  console.error(
    `FATAL: missing required Clerk env var(s): ${missingClerkEnv.join(', ')}. ` +
    'Both the secret and publishable keys must be set on the server (clerkMiddleware ' +
    'requires the publishable key on every request). Get them from your Clerk ' +
    'dashboard. See CLERK_SETUP.md.'
  );
  process.exit(1);
}

// DATABASE_URL is required for every request that touches data — fail fast at
// boot rather than throwing on the first Prisma query.
if (!process.env.DATABASE_URL) {
  console.error('FATAL: missing required env var DATABASE_URL (Postgres connection string).');
  process.exit(1);
}

const app = require('./app');
const PORT = process.env.PORT || 3001;

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Process transcode jobs inline by default so video compression works out of the
  // box on a single service. For scale, deploy a dedicated worker (`npm run worker`)
  // and set DISABLE_INLINE_WORKER=true here so only that process transcodes.
  if (process.env.DISABLE_INLINE_WORKER !== 'true') {
    require('./lib/transcodeQueue')
      .runWorkerLoop()
      .catch((e) => console.error('inline transcode worker error:', e.message));
  }

  // One-time, self-converging backfill of old 400px thumbnails to the current
  // hi-res size. Non-blocking and best-effort; a no-op once all are upgraded.
  setImmediate(() => {
    const prisma = require('./lib/prisma');
    require('./lib/backfillThumbnails')
      .backfillThumbnails(prisma)
      .catch((e) => console.error('thumbnail backfill error:', e.message));
  });
});
