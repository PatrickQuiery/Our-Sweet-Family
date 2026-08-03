const { PrismaClient } = require('@prisma/client');

// Real client bound to the test DB (DATABASE_URL is set by env.js setupFiles).
const prisma = new PrismaClient();

const counters = { user: 0, family: 0, child: 0, memory: 0 };

// TRUNCATE all tables so each test starts clean, order-independent.
async function truncateAll() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Reaction","Comment","Memory","Milestone","Child","FamilyMember","Invitation","ContactMessage","Family","User" RESTART IDENTITY CASCADE'
  );
}

async function makeUser({ email, name, role = 'owner', plan = 'free', clerkUserId } = {}) {
  const n = ++counters.user;
  return prisma.user.create({
    data: {
      email: email || `user${n}@test.com`,
      clerkUserId: clerkUserId || `clerk_${n}`,
      name: name || `User ${n}`,
      role,
      plan,
    },
  });
}

async function makeFamily(ownerId, { name = 'Test Family' } = {}) {
  return prisma.family.create({ data: { name, ownerId } });
}

async function makeChild(familyId, { name = 'Child', dateOfBirth = '2021-01-01' } = {}) {
  const n = ++counters.child;
  return prisma.child.create({
    data: { familyId, name: `${name} ${n}`, dateOfBirth: new Date(dateOfBirth) },
  });
}

async function makeMember(familyId, userId, { permissions = 'view_only', accessPerChild = 'all' } = {}) {
  return prisma.familyMember.create({ data: { familyId, userId, permissions, accessPerChild } });
}

async function makeMemory(
  familyId,
  uploadedById,
  {
    childIds = [],
    fileType = 'photo',
    capturedAt = '2024-01-01',
    caption = null,
    isClassified = false,
    fileUrl = 'memories/x.jpg',
    thumbnailUrl = null,
  } = {}
) {
  const n = ++counters.memory;
  return prisma.memory.create({
    data: {
      familyId,
      uploadedById,
      childIds,
      fileType,
      capturedAt: new Date(capturedAt),
      caption: caption || `Memory ${n}`,
      isClassified,
      fileUrl,
      thumbnailUrl,
    },
  });
}

// Header that authenticates as `user` (the mocked @clerk/express reads it).
function authHeader(user) {
  return ['x-clerk-user-id', user.clerkUserId];
}

module.exports = {
  prisma,
  truncateAll,
  makeUser,
  makeFamily,
  makeChild,
  makeMember,
  makeMemory,
  authHeader,
};
