import api from './api';

// A referral code arrives as ?ref=CODE on the signup link. We stash it locally
// through the (Clerk-hosted, redirect-heavy) signup flow and redeem it once the
// new user creates their family.
const REF_KEY = 'osf_ref';

export function storeRefCode(code) {
  try {
    if (code) localStorage.setItem(REF_KEY, code);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

export function getStoredRefCode() {
  try {
    return localStorage.getItem(REF_KEY) || '';
  } catch {
    return '';
  }
}

function clearRefCode() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}

// Redeem a pending referral (best-effort — never block or break onboarding).
export async function completeReferralIfPending() {
  const code = getStoredRefCode();
  if (!code) return;
  try {
    await api.post('/referrals/complete', { code });
  } catch {
    /* a bad/expired code shouldn't disrupt onboarding */
  } finally {
    clearRefCode();
  }
}
