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
});
