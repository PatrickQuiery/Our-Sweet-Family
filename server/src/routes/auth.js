const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function safeUser(user) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

async function tempPasswordHash() {
  return bcrypt.hash(uuidv4(), 10);
}

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, passwordHash, name, role: 'owner' },
        select: { id: true, email: true, name: true, role: true, plan: true, avatarUrl: true, createdAt: true },
      });

      const token = signToken(user.id);
      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken(user.id);
      const { passwordHash: _, ...safe } = user;
      res.json({ token, user: safe });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// POST /api/auth/google — verify a Google Identity Services credential (ID token)
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    // Look up by googleId first, then fall back to matching email to link accounts
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Link Google ID to existing account
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId,
            ...(!existing.avatarUrl && picture ? { avatarUrl: picture } : {}),
          },
        });
      } else {
        // Create a new account
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            passwordHash: await tempPasswordHash(),
            googleId,
            avatarUrl: picture || null,
            role: 'owner',
          },
        });
      }
    }

    res.json({ token: signToken(user.id), user: safeUser(user) });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// POST /api/auth/apple — verify an Apple Sign-In identity token
router.post('/apple', async (req, res) => {
  const { idToken, name } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const appleSignin = require('apple-signin-auth');
    const payload = await appleSignin.verifyIdToken(idToken, {
      audience: process.env.APPLE_CLIENT_ID,
      // Apple tokens have a short TTL; clients should send them immediately after sign-in
      ignoreExpiration: false,
    });
    const { sub: appleId, email } = payload;

    let user = await prisma.user.findUnique({ where: { appleId } });

    if (!user) {
      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          // Link Apple ID to existing account
          user = await prisma.user.update({ where: { id: existing.id }, data: { appleId } });
        }
      }

      if (!user) {
        // Apple only provides email on the very first sign-in
        if (!email) return res.status(400).json({ error: 'Email not provided — please sign in with Apple again from a new device or revoke app access in your Apple ID settings' });

        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            passwordHash: await tempPasswordHash(),
            appleId,
            role: 'owner',
          },
        });
      }
    }

    res.json({ token: signToken(user.id), user: safeUser(user) });
  } catch (err) {
    console.error('Apple auth error:', err.message);
    res.status(401).json({ error: 'Invalid Apple token' });
  }
});

module.exports = router;
