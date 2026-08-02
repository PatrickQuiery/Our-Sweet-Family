# Production Readiness — Our Sweet Family

Status of the app for a production launch, the security/bug work already completed,
and the items that still need attention before go-live.

_Last updated: 2026-08-02._

---

## 1. Architecture & components

| Component | Technology | Where it runs |
|-----------|-----------|----------------|
| Frontend | React 18 + Vite + TailwindCSS + React Router v6 | **Vercel** (static SPA; `client/vercel.json` rewrites all routes to `index.html`) |
| Backend API | Node.js + Express | **Railway** (`railway.json`; Nixpacks build) |
| Database | PostgreSQL + Prisma ORM | Railway Postgres (or any managed Postgres) |
| File storage | Local disk **or** S3 / Cloudflare R2 (S3-compatible) | `STORAGE_PROVIDER=local|s3` |
| Auth | JWT (bearer token in `localStorage`) | — |
| Email | SMTP via nodemailer (contact form) | any provider (SES, Resend, Mailgun, Postmark…) |
| Image processing | Sharp (thumbnails), exifr (capture date) | in the API |

**Request flow:** Vercel serves the SPA → the SPA calls the Railway API at
`VITE_API_BASE_URL` → the API talks to Postgres and to storage (disk/S3). CORS on
the API allows `oursweetfamily.com`, `www.oursweetfamily.com`, `localhost:5173`, and
`CLIENT_URL`.

### Database structure (Prisma models)
`User` (role: owner/loved_one, plan: free/plus/premium) → owns `Family` → has
`Child`ren, `FamilyMember`s (loved ones; `permissions` + `accessPerChild` JSON),
and `Memory`s (photo/video; `childIds` JSON array; `isClassified`). `Memory` has
`Reaction`s and `Comment`s. `Milestone`s hang off `Child`. `ContactMessage` stores
contact-form submissions. Schema-to-DB is now managed by **migrations**
(`prisma/migrations/`), not `db push`.

---

## 2. Fixed in this pass ✅

### Critical correctness / security
- **Per-child JSON filter crashed on Postgres** — `childIds` filters used MySQL
  `{ path: '$', array_contains }` syntax, 500-ing the child filter and every
  restricted-loved-one request. Now `{ array_contains: [id] }`.
- **IDOR on reactions & comments** — any logged-in user could react/comment on any
  memory by UUID. Now gated by a shared `loadAccessibleMemory` access check
  (owner/member + classified + per-child).
- **Reels ignored per-child access** — a restricted loved one saw other children's
  memories via reels. Now enforces `accessPerChild`.
- **Plan gating used the caller's plan, not the family owner's** — loved ones
  (always free) were locked out of paid features their family paid for, and a
  relative's upload to a Premium family lost original quality. Now keyed to the
  owner's plan (milestones, reels, `originalQuality`, classified).

### Hardening
- **Auth rate limiting** (20/15min) + contact limiter (5/hr) + global backstop.
- **Security headers** via `helmet` (HSTS, `nosniff`, `X-Frame-Options`).
- **`JWT_SECRET` fail-fast** at boot (missing / <16 chars / example value → exit).
- **Error messages no longer leak** internals in production.
- **`prisma db push` on prod start → `prisma migrate deploy`** (no more silent
  schema force-sync / data-loss risk). Baseline migration committed.
- **Input hardening** — pagination coerced/clamped; `accessPerChild` validated on
  write; `childIds` JSON parse guarded (400 not 500).
- **Orphaned data cleanup** — deleting a memory now deletes its files; deleting a
  child strips its id from memory tags.

### Correctness
- **Age labels were timezone-dependent** — computed in local time over UTC-stored
  dates, so US users saw wrong ages at month boundaries. Now UTC-consistent.
- **Liking a card reset the feed to page 1** and could drift negative — fixed.
- **Settings "save name" / "change password" were fake** (`setTimeout`, no API).
  Real `PATCH /api/auth/me` and `POST /api/auth/change-password` endpoints added
  and wired.

**Tests:** 114 passing (was 99/101 with 2 failing). Added IDOR, contact, and
profile/password regression tests.

---

## 3. Still open before launch ⚠️

### HIGH — must address
1. **Loved-one invite / account model.** Inviting a loved one creates a real
   `User` row with a random password and no way to set one — the invitee can never
   log in, and their email is squatted (blocks their own future signup). **Needs an
   invitation-token flow**: email a signed, expiring link → invitee sets their own
   password → then the `User` + `FamilyMember` are created. (`members.js`)
2. **Private media is served unauthenticated.** `/uploads` (local) and a public
   bucket (S3) let anyone with a file URL download any photo — including classified
   / per-child-restricted media — bypassing all API access control. **Fix:** private
   bucket + short-lived **presigned URLs** generated after an access check (the S3
   presigner dependency is already installed), or an authenticated media proxy
   route. This is the top data-exposure risk for a privacy product.

### MEDIUM — recommended
3. **JWT in `localStorage`** is XSS-exfiltratable. Consider httpOnly+Secure+SameSite
   cookies, and/or shorter token TTL with refresh.
4. **Multi-family support** — the client only ever uses `families[0]`; add a family
   switcher (data model already supports multiple).
5. **Integration tests against a real Postgres.** The unit suite mocks Prisma, so it
   **cannot catch query-syntax bugs** (that's how the `path:'$'` bug shipped green).
   Add a small Testcontainers/CI-Postgres suite for the query paths.
6. **Global `role` vs per-family role** — client owner-only UI shows for a user who
   is a loved one in another family (server correctly rejects; UI is misleading).

### LOW
7. Reels slideshow ignores video length / has no pause. 8. Onboarding family-name
default uses the 2nd word of the name. 9. Signup reveals whether an email exists.

---

## 4. Pre-launch environment checklist

**API (Railway):**
- [ ] `DATABASE_URL` → managed Postgres
- [ ] `JWT_SECRET` → strong random value (boot will refuse to start otherwise)
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL=https://oursweetfamily.com`
- [ ] `STORAGE_PROVIDER=s3` + `AWS_*` (private bucket) for durable media
- [ ] `CONTACT_TO=Contact@oursweetfamily.com`
- [ ] `SMTP_HOST/PORT/USER/PASS/FROM` for contact-form delivery (verify sending domain)

**Client (Vercel):**
- [ ] `VITE_API_BASE_URL=https://<api-domain>`

**DB:** migrations run automatically via `migrate deploy` on start.
