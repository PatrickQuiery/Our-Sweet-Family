const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/devices — register (or refresh) this device's Expo push token.
// Upsert by token so re-registering the same device just updates the owner/platform.
router.post(
  '/',
  authenticate,
  [body('token').isString().trim().notEmpty(), body('platform').isIn(['ios', 'android'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, platform } = req.body;
    try {
      const device = await prisma.deviceToken.upsert({
        where: { token },
        update: { userId: req.user.id, platform },
        create: { token, platform, userId: req.user.id },
      });
      res.status(201).json({ device: { id: device.id, platform: device.platform } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/devices — unregister a token on sign-out (only your own).
router.delete('/', authenticate, async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    await prisma.deviceToken.deleteMany({ where: { token, userId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
