# Real-Postgres Integration Tests — Design

_2026-08-03 · Our Sweet Family_

## Problem

The unit suite mocks Prisma (`jest.mock('../../lib/prisma')`), so it validates route
logic but never executes a real query. That is exactly why the `childIds` MySQL
`path:'$'` bug shipped green — the mock returned canned data regardless of the query
shape. We need tests that run real SQL against a real Postgres to catch query-layer
regressions (JSON `array_contains`, access filters, pagination).

## Approach (confirmed with owner)

A dedicated test database on the existing local Postgres, driven through the real
Prisma client — kept entirely separate from the fast mocked unit suite.

Rejected: Testcontainers / ephemeral Docker Postgres — Docker is unavailable in this
environment. The design still works in CI by pointing `DATABASE_URL_TEST` at a
Postgres service.

## Components

### Test database
- Database `our_sweet_family_test` on the same Postgres instance.
- `DATABASE_URL_TEST` env var selects it; falls back to
  `postgresql://postgres@localhost:5433/our_sweet_family_test?host=/tmp` for local dev.
- Migrations applied once before the run via `prisma migrate deploy` against
  `DATABASE_URL_TEST`.

### Jest config
- New `server/jest.integration.config.js`:
  - `testMatch: ['**/__integration__/**/*.test.js']`
  - **No** prisma auto-mock, `resetMocks:false`.
  - `globalSetup`: point `DATABASE_URL` at the test DB and run `prisma migrate deploy`.
  - `globalTeardown`: disconnect.
  - `setupFilesAfterEach`/helper: `truncateAll()` run in `beforeEach` (TRUNCATE every
    table `RESTART IDENTITY CASCADE`) so tests are isolated and order-independent.
- The default `jest.config.js` (unit) excludes `__integration__` so `npm test` stays
  fast and mocked.
- Scripts: `test` (unit, unchanged), `test:integration`, `test:all`.

### Test helpers (`__integration__/helpers.js`)
- A shared real `PrismaClient` bound to the test DB.
- Factory functions: `makeUser`, `makeFamily`, `makeChild`, `makeMemory`,
  `makeMember` — thin wrappers over `prisma.*.create` with sane defaults.
- `truncateAll()`.
- `tokenFor(userId)` — signs a JWT with the test `JWT_SECRET` for supertest requests.

### Coverage (query-layer behaviour the mocks can't see)
1. `GET /memories?childId=` returns exactly the memories tagged with that child
   (the `array_contains` query that used to 500).
2. Restricted loved-one (`accessPerChild=[childB]`) sees only child B's memories via
   `GET /memories` — and gets 200, not 500.
3. Reels enforce per-child access (restricted member never sees other children).
4. Classified memory is absent from a non-owner's real `GET /memories` result.
5. Pagination: real rows across pages, correct `total`/`pages`.
6. Invite → accept creates a real `User` + `FamilyMember`; that user can then
   `POST /auth/login` and `GET /memories` for the family.

### Value demonstration
After green, temporarily restore the `path:'$'` filter in `memories.js`, run the
integration suite to show tests 1–2 go red, then revert. (Documented, not committed.)

## Docs

README gains a "Running integration tests" section: create the test DB once, then
`npm run test:integration`; note `DATABASE_URL_TEST` for CI.

## Non-goals

Not converting existing unit tests; not adding CI config files (documented, left to
the owner's CI of choice). Not testing S3 (local storage path only).
