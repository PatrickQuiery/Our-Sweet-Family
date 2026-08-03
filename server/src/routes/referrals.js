const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { effectivePlan } = require('../lib/plan');

const router = express.Router();

const REWARD_DAYS = 90;
// No ambiguous characters (0/O, 1/I/L) so codes are easy to read aloud/type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(len = 7) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const clash = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!clash) return code;
  }
  return randomCode(10); // vanishingly unlikely fallback
}

// Grant (or extend) a Plus boost. Stacks: if a boost is still active, we add days
// onto its end rather than the boost resetting to a shorter window.
async function grantPlusDays(userId, days) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { planBoostUntil: true } });
  const now = Date.now();
  const from = u?.planBoostUntil && new Date(u.planBoostUntil).getTime() > now
    ? new Date(u.planBoostUntil).getTime()
    : now;
  const until = new Date(from + days * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: userId }, data: { planBoostUntil: until } });
  return until;
}

// GET /api/referrals/me — the caller's share code + stats (creates a code lazily).
router.get('/me', authenticate, async (req, res) => {
  try {
    let user = req.user;
    if (!user.referralCode) {
      const code = await generateUniqueCode();
      user = await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
    }
    const count = await prisma.referral.count({ where: { referrerId: user.id } });
    res.json({
      code: user.referralCode,
      count,
      rewardActiveUntil: user.planBoostUntil,
      plan: effectivePlan(user),
      rewardDays: REWARD_DAYS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/referrals/complete { code } — attribute + reward. Called once the
// referee has created their own family. Idempotent and abuse-resistant:
//  - a user can be credited to at most one referrer (refereeId is unique),
//  - no self-referral,
//  - the referee must actually own a family (so signups alone can't be farmed).
router.post('/complete', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    const already = await prisma.referral.findUnique({ where: { refereeId: req.user.id } });
    if (already) return res.json({ status: 'already_referred' });

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot refer yourself' });
    }

    const familyCount = await prisma.family.count({ where: { ownerId: req.user.id } });
    if (familyCount === 0) {
      return res.status(400).json({ error: 'Create your family before completing a referral' });
    }

    try {
      await prisma.referral.create({
        data: { referrerId: referrer.id, refereeId: req.user.id, status: 'completed' },
      });
    } catch (err) {
      // Unique-constraint race: another request credited this referee first.
      if (err.code === 'P2002') return res.json({ status: 'already_referred' });
      throw err;
    }

    await grantPlusDays(referrer.id, REWARD_DAYS);
    const myUntil = await grantPlusDays(req.user.id, REWARD_DAYS);

    res.json({ status: 'completed', rewardActiveUntil: myUntil, rewardDays: REWARD_DAYS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
