const prisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  family: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  referral: {
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  child: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  familyMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  memory: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  contactMessage: {
    create: jest.fn(),
    update: jest.fn(),
  },
  reaction: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  comment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  milestone: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  invitation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  transcodeJob: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  $queryRawUnsafe: jest.fn(),
};

module.exports = prisma;
