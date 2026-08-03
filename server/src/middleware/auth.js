const { getAuth, clerkClient } = require('@clerk/express');
const prisma = require('../lib/prisma');

// Create (or link) the local User row that backs a Clerk identity. All app data
// (families, memories, memberships) references User.id, so every Clerk user needs
// exactly one local row. An existing row with the same email — a seed user, or a
// loved one invited before they had a Clerk account — is linked rather than
// duplicated.
async function syncUser(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = (
    clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    ''
  ).toLowerCase();
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    (email ? email.split('@')[0] : 'Member');

  try {
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return await prisma.user.update({
          where: { id: existing.id },
          data: { clerkUserId, name: existing.name || name },
        });
      }
    }
    return await prisma.user.create({ data: { clerkUserId, email, name, role: 'owner' } });
  } catch (err) {
    // On a user's first sign-in, concurrent authenticated requests (e.g. /auth/me
    // firing alongside an invite claim) can both try to create this row, and one
    // hits a unique-constraint race. Re-fetch the now-existing row instead of failing.
    const byClerk = await prisma.user.findUnique({ where: { clerkUserId } });
    if (byClerk) return byClerk;
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        return byEmail.clerkUserId
          ? byEmail
          : prisma.user.update({ where: { id: byEmail.id }, data: { clerkUserId } });
      }
    }
    throw err;
  }
}

// Authenticate via Clerk, then resolve the local User onto req.user so existing
// routes (which read req.user) are unchanged.
async function authenticate(req, res, next) {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not signed in' });

    let user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) user = await syncUser(clerkUserId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { authenticate, syncUser };
