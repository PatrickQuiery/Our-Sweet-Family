require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Fail fast on insecure configuration before accepting any traffic. A missing,
// short, or example JWT secret means every token in the system is forgeable.
const EXAMPLE_SECRET = 'your-super-secret-jwt-key-change-in-production';
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16 || secret === EXAMPLE_SECRET) {
  console.error(
    'FATAL: JWT_SECRET is missing, shorter than 16 characters, or still set to ' +
    'the example value. Set a strong, unique JWT_SECRET before starting.'
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
