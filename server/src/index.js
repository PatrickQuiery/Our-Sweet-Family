require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/families');
const childrenRoutes = require('./routes/children');
const memoriesRoutes = require('./routes/memories');
const membersRoutes = require('./routes/members');
const milestonesRoutes = require('./routes/milestones');
const reelsRoutes = require('./routes/reels');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

const allowedOrigins = [
  'http://localhost:5173',
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

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/reels', reelsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
