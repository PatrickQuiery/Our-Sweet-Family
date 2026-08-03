const crypto = require('crypto');

// Invite links carry a high-entropy random token. Only its SHA-256 hash is stored
// in the database, so a leaked DB never exposes usable invite links.

function hashInviteToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateInviteToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashInviteToken(raw) };
}

const INVITE_TTL_DAYS = 7;

function inviteExpiry(fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();
  return new Date(base.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

module.exports = { generateInviteToken, hashInviteToken, inviteExpiry, INVITE_TTL_DAYS };
