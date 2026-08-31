const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { effectivePlan } = require('../lib/plan');
const { mapEvent } = require('../lib/billing/entitlements');
const { applyEntitlement } = require('../lib/billing/applyEntitlement');

const router = express.Router();

// Constant-time comparison of the provided Authorization header against our shared
// secret (configured identically in the RevenueCat dashboard).
function secretsMatch(provided, secret) {
  if (!provided || !secret) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const CLEARED = {
  plan: 'free',
  subscriptionStatus: 'expired',
  subscriptionStore: null,
  subscriptionProductId: null,
  subscriptionExpiresAt: null,
  subscriptionWillRenew: false,
};

// RevenueCat webhook receiver. RevenueCat is the entitlement source of truth; this
// endpoint syncs the change onto our User row. Idempotent (events may be redelivered)
// and it answers 200 even for unknown users so RevenueCat stops retrying — but 500s
// on transient failures so a genuinely missed write is retried.
router.post('/revenuecat', async (req, res) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('REVENUECAT_WEBHOOK_SECRET is not set — refusing webhook.');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  if (!secretsMatch(req.headers.authorization, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const mapped = mapEvent(req.body);

  try {
    if (mapped.transfer) {
      await applyEntitlement(prisma, { appUserId: mapped.from, ...CLEARED });
      const grant = await applyEntitlement(prisma, {
        appUserId: mapped.to,
        plan: mapped.plan,
        subscriptionStatus: mapped.subscriptionStatus,
        subscriptionStore: mapped.subscriptionStore,
        subscriptionProductId: mapped.subscriptionProductId,
        subscriptionExpiresAt: mapped.subscriptionExpiresAt,
        subscriptionWillRenew: mapped.subscriptionWillRenew,
      });
      return res.status(200).json({ ok: true, transfer: true, ...grant });
    }

    const result = await applyEntitlement(prisma, mapped);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('billing webhook error:', e.message);
    return res.status(500).json({ error: 'Failed to apply entitlement' });
  }
});

// Current user's subscription snapshot for the manage-subscription UI.
router.get('/status', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    plan: u.plan,
    effectivePlan: effectivePlan(u),
    subscriptionStatus: u.subscriptionStatus ?? null,
    subscriptionStore: u.subscriptionStore ?? null,
    subscriptionProductId: u.subscriptionProductId ?? null,
    subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
    subscriptionWillRenew: u.subscriptionWillRenew ?? null,
  });
});

module.exports = router;
