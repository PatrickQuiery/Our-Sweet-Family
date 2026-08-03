require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Fail fast on insecure configuration before accepting any traffic. Clerk verifies
// session tokens with the secret key; without it, authentication cannot work.
if (!process.env.CLERK_SECRET_KEY) {
  console.error(
    'FATAL: CLERK_SECRET_KEY is not set. Create a Clerk application and set ' +
    'CLERK_SECRET_KEY (and CLERK_PUBLISHABLE_KEY on the client) before starting. ' +
    'See CLERK_SETUP.md.'
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
