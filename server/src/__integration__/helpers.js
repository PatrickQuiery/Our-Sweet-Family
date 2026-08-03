const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Real client bound to the test DB (DATABASE_URL is set by env.js setupFiles).
const prisma = new PrismaClient();

const counters = { user: 0, family: 0, child: 0, memory: 0 };

// TRUNCATE all tables so each test starts clean, order-independent.
async function truncateAll() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Reaction","Comment","Memory","Milestone","Child","FamilyMember","Invitation","ContactMessage","Family","User" RESTART IDENTITY CASCADE'
  );
}

async function makeUser({ email, name, role = 'owner', plan = 'free', password = 'password123' } = {}) {
  const n = ++counters.user;
  return prisma.user.create({
    data: {
      email: email || `user${n}@test.com`,
      passwordHash: await bcrypt.hash(password, 10),
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

function tokenFor(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET);
}

module.exports = {
  prisma,
  truncateAll,
  makeUser,
  makeFamily,
  makeChild,
  makeMember,
  makeMemory,
  tokenFor,
};
