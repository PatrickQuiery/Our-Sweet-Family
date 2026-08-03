// Runs (setupFiles) before the test module — and therefore before the app/prisma
// singleton is required — so the real Prisma client connects to the TEST database.
process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'local';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret-key-1234567890';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://postgres@localhost:5433/our_sweet_family_test?host=/tmp';
