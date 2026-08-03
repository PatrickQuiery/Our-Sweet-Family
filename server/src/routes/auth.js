const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Sign-up, sign-in, password, MFA and social login are all handled by Clerk on the
// client. The server only exposes the synced local user (with app-specific role,
// plan and profile). Profile/password changes happen in Clerk's UserProfile UI.

// GET /api/auth/me — current user (created/linked on first authenticated request)
router.get('/me', authenticate, async (req, res) => {
  const { passwordHash: _ph, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

module.exports = router;
