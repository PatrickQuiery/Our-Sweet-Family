# Subscription Billing — Phase 1 (Store-Agnostic Backend) Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the store-agnostic billing backend — schema, entitlement mapping, RevenueCat webhook receiver, and status endpoint — that flips `User.plan` from RevenueCat events. Buildable and testable with zero store/RevenueCat accounts.

**Architecture:** RevenueCat is the entitlement source of truth; a signed webhook updates our Postgres `User` row. `User.plan` stays the authoritative gate (read via existing `effectivePlan`). Pure mapping is unit-tested with fixture payloads; the endpoint is idempotent and never fails RevenueCat's retries fatally.

**Tech Stack:** Node/Express, Prisma/Postgres, Jest + supertest (existing patterns).

---

### Task 1: Schema — subscription fields on User

**Files:**
- Modify: `server/prisma/schema.prisma` (User model)
- Create: `server/prisma/migrations/20260817000000_add_user_subscription_fields/migration.sql`

- [ ] **Step 1:** Add to `User`:
```prisma
  subscriptionStatus     String?   // active | in_grace | billing_issue | canceled | expired
  subscriptionStore      String?   // app_store | play_store | stripe
  subscriptionProductId  String?
  subscriptionExpiresAt  DateTime?
  subscriptionWillRenew  Boolean?
```
- [ ] **Step 2:** Migration SQL:
```sql
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStore" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionProductId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscriptionWillRenew" BOOLEAN;
```
- [ ] **Step 3:** `npx prisma generate` — expect success.
- [ ] **Step 4:** Commit.

---

### Task 2: Entitlement mapping (pure, TDD)

**Files:**
- Create: `server/src/lib/billing/entitlements.js`
- Test: `server/src/__tests__/lib/billing/entitlements.test.js`
- Fixtures: `server/src/__tests__/lib/billing/fixtures.js`

Maps a RevenueCat webhook event body → `{ appUserId, plan, subscriptionStatus, subscriptionStore, subscriptionProductId, subscriptionExpiresAt, subscriptionWillRenew }`.

Rules:
- Entitlement tier from the event's product/entitlement ids via a config map `PRODUCT_TIER` (env-overridable): premium products → `premium`, plus products → `plus`.
- `type` → status/plan:
  - `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` → status `active`, plan = tier, willRenew true.
  - `CANCELLATION` (auto-renew off, still in period) → status `canceled`, plan = tier (keep access until expiry), willRenew false.
  - `BILLING_ISSUE` → status `billing_issue`, plan = tier (grace), willRenew true.
  - `SUBSCRIPTION_PAUSED`, `EXPIRATION` → status `expired`, plan `free`, willRenew false.
  - `TRANSFER` → returns `{ transfer: true, from, to }` for special handling (see Task 4).
- `store` from event `store` (`APP_STORE`→`app_store`, `PLAY_STORE`→`play_store`, `STRIPE`→`stripe`).
- `subscriptionExpiresAt` from `expiration_at_ms` (epoch ms → Date) or null.

- [ ] **Step 1:** Write fixtures (INITIAL_PURCHASE premium app_store, RENEWAL, CANCELLATION, BILLING_ISSUE, EXPIRATION, PRODUCT_CHANGE plus→premium, TRANSFER, unknown-product).
- [ ] **Step 2:** Write failing tests asserting the mapping for each fixture.
- [ ] **Step 3:** Run tests — expect FAIL (module missing).
- [ ] **Step 4:** Implement `mapEvent(body)` + `PRODUCT_TIER` config.
- [ ] **Step 5:** Run tests — expect PASS.
- [ ] **Step 6:** Commit.

---

### Task 3: Apply entitlement to the DB (TDD, mocked prisma)

**Files:**
- Create: `server/src/lib/billing/applyEntitlement.js`
- Test: `server/src/__tests__/lib/billing/applyEntitlement.test.js`

`applyEntitlement(prisma, mapped)`:
- Finds the user by id = `appUserId` (fallback: `clerkUserId`). If not found → log + return `{ applied: false, reason: 'user_not_found' }` (never throw — RevenueCat gets 200).
- Updates `plan` + the four `subscription*` fields. Leaves `planBoostUntil` untouched (referral boost coexists).
- Returns `{ applied: true, userId, plan }`.

- [ ] **Step 1:** Failing tests: applies premium to a found user; returns not-found for a missing user without throwing; expiration sets plan free but does not clear planBoostUntil.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit.

---

### Task 4: Webhook route (TDD, supertest)

**Files:**
- Create: `server/src/routes/billing.js`
- Modify: `server/src/app.js` (mount `/api/billing`)
- Test: `server/src/__tests__/routes/billing.test.js`

`POST /api/billing/revenuecat`:
- Verify `Authorization` header equals `process.env.REVENUECAT_WEBHOOK_SECRET` (constant-time compare). Missing/mismatch → 401. If the secret env is unset, refuse (500 + log) rather than accept blindly.
- Body shape `{ event: {...} }`. Map via Task 2, apply via Task 3. `TRANSFER` → move subscription fields from `from` user to `to` user (both mapped to entitlement of the transferred product).
- Always respond 200 on handled events (even user-not-found) so RevenueCat stops retrying; 400 only on unparseable body.
- Idempotent: applying the same event twice yields the same row state (no counters).

- [ ] **Step 1:** Failing tests: 401 without/with wrong secret; 200 + user upgraded to premium on INITIAL_PURCHASE; 200 + downgraded to free on EXPIRATION; 200 (not 500) when user not found; TRANSFER moves entitlement.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement route + mount.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit.

---

### Task 5: Status endpoint (TDD)

**Files:**
- Modify: `server/src/routes/billing.js`
- Test: `server/src/__tests__/routes/billing.test.js`

`GET /api/billing/status` (authenticated): returns `{ plan, effectivePlan, subscriptionStatus, subscriptionStore, subscriptionProductId, subscriptionExpiresAt, subscriptionWillRenew }` for `req.user`.

- [ ] **Step 1:** Failing test: authed user gets their plan + subscription fields; 401 unauthenticated.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement (reuse `authenticate` middleware + `effectivePlan`).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit.

---

### Task 6: Full suite + wrap-up

- [ ] **Step 1:** `npx jest` — expect all green.
- [ ] **Step 2:** Update `server/.env.example` with `REVENUECAT_WEBHOOK_SECRET=` and `PRODUCT_TIER_*` notes.
- [ ] **Step 3:** Commit.

---

## Self-review notes

- `plan` remains the only gate; `subscription*` fields are descriptive. Confirmed all mapping paths set `plan`.
- `EXPIRATION` sets `plan='free'` but never touches `planBoostUntil` (referral boost intact) — asserted in Task 3.
- Webhook is idempotent and returns 200 on user-not-found to avoid retry storms — asserted in Task 4.
- No store SDK/account is required for any task here; live product ids are configured in Phase 2.
