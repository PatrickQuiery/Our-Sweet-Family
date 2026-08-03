// Integration tests run against a REAL Postgres (the test database) with no Prisma
// mocking, so they exercise actual SQL. Kept separate from the fast, mocked unit
// suite (jest.config.js).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__integration__/**/*.test.js'],
  setupFiles: ['./src/__integration__/env.js'],
  globalSetup: './src/__integration__/globalSetup.js',
  resetMocks: false,
  // Real DB + one shared client: run serially to keep truncation deterministic.
  maxWorkers: 1,
  testTimeout: 20000,
};
