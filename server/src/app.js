require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/families');
const childrenRoutes = require('./routes/children');
const memoriesRoutes = require('./routes/memories');
const membersRoutes = require('./routes/members');
const milestonesRoutes = require('./routes/milestones');
const reelsRoutes = require('./routes/reels');
const contactRoutes = require('./routes/contact');
const invitationsRoutes = require('./routes/invitations');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Behind Railway/Vercel proxies — needed for correct client IPs (rate limiting)
// and secure cookies. Trust a single hop rather than blindly trusting all.
app.set('trust proxy', 1);

// Baseline security headers. crossOriginResourcePolicy is relaxed so that the
// client (different origin) can load media served from this API.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  'http://localhost:5173',
  'https://oursweetfamily.com',
  'https://www.oursweetfamily.com',
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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NOTE: media is intentionally NOT served via express.static. Private photos/videos
// are streamed only through the authenticated, access-checked endpoints
// GET /api/memories/:id/file and /thumb.

// Rate limiting. Strict on auth (brute-force / enumeration) and contact (spam);
// a looser global limiter as a backstop. Disabled under test to keep the
// supertest suite deterministic.
if (!isTest) {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later.' },
  });
  const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many messages sent. Please try again later.' },
  });
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth', authLimiter);
  app.use('/api/contact', contactLimiter);
  app.use('/api', globalLimiter);
}

app.use('/api/auth', authRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/invitations', invitationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || 500;
  // Don't leak internal error details (stack traces, CORS origins, ORM messages)
  // to clients in production. Known 4xx errors may carry a safe message.
  const message =
    status < 500 && err.message ? err.message : 'Internal server error';
  res.status(status).json({ error: isProd ? message : err.message || 'Internal server error' });
});

module.exports = app;
