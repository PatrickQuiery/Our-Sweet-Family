require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/families');
const childrenRoutes = require('./routes/children');
const memoriesRoutes = require('./routes/memories');
const membersRoutes = require('./routes/members');
const milestonesRoutes = require('./routes/milestones');
const reelsRoutes = require('./routes/reels');

const app = express();

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
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/reels', reelsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
