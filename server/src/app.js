require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/families');
const childrenRoutes = require('./routes/children');
const memoriesRoutes = require('./routes/memories');
const membersRoutes = require('./routes/members');
const milestonesRoutes = require('./routes/milestones');
const reelsRoutes = require('./routes/reels');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow embedded images
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

const allowedOrigins = [
  'http://localhost:5173',
  'https://oursweetfamily.com',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', (req, res, next) => {
  // Prevent browsers from sniffing content types or executing inline scripts
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'");
  res.set('Content-Disposition', 'attachment');
  next();
}, express.static(uploadsDir));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/memories', (req, res, next) => {
  // Apply upload rate limit only on POST (file upload)
  if (req.method === 'POST' && req.path === '/') return uploadLimiter(req, res, next);
  next();
}, memoriesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/reels', reelsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? (err.message || 'Internal server error') : 'Internal server error',
  });
});

module.exports = app;
