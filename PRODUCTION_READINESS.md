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

### Loved-one invite flow (was the #1 pre-launch blocker) — now shipped
- Invites no longer create a fake placeholder `User`. A new email creates a
  pending `Invitation` (random token, only its SHA-256 hash stored, 7-day expiry,
  single-use). Existing users are added directly.
- Public `/accept-invite?token=…` page: the invitee sets their own password, the
  real `User` + `FamilyMember` are created, and they're auto-logged-in.
- The owner gets a **copyable invite link** (works before SMTP is set up) plus a
  best-effort email; the Family page lists **pending invitations** with revoke.
- Endpoints: `GET/POST /api/invitations/:token`, `GET /api/invitations`,
  `DELETE /api/invitations/:id`. See
  `docs/superpowers/specs/2026-08-02-loved-one-invite-flow-design.md`.

### Private media access (was the top data-exposure risk) — now shipped
- Media is stored under opaque **keys** (not public URLs); `express.static('/uploads')`
  is removed. Nothing serves media unauthenticated.
- Photos/videos are streamed only by authenticated endpoints
  `GET /api/memories/:id/file` and `/thumb`, which run the same access gate as the
  memory (owner/member + classified + per-child).
- The client fetches media with its bearer token and renders it from a blob
  (`AuthedImage` / `AuthedVideo`); external seed/stock URLs still render directly.
- In production the **S3 bucket must be private** — the server proxies the bytes.
- See `docs/superpowers/specs/2026-08-03-private-media-access-design.md`.

**Tests:** 134 passing (was 99/101 with 2 failing). Added IDOR, contact,
profile/password, full invite-flow, and media access-control regression tests.

---

## 3. Still open before launch ⚠️

_The former HIGH blockers (invite flow, private media) shipped; authentication has
been migrated to **Clerk** (email/password with strength + breach detection, Google/
Apple/Facebook, MFA-ready). Remaining items:_

### Auth (needs owner action — see CLERK_SETUP.md)
Auth requires a Clerk account: set `VITE_CLERK_PUBLISHABLE_KEY` (client) and
`CLERK_SECRET_KEY` (server), and enable Google/Apple/Facebook + the password policy in
the Clerk dashboard. Live end-to-end sign-in/up (incl. one social provider) must be
validated with these keys before merge/launch.

### MEDIUM — recommended
1. **Multi-family support** — the client only ever uses `families[0]`; add a family
   switcher (data model already supports multiple).
2. **Global `role` vs per-family role** — client owner-only UI shows for a user who
   is a loved one in another family (server correctly rejects; UI is misleading).
3. **Video is fetched as a full blob** (no HTTP range/seek). Add `Range` support to
   the media endpoint and serve video via a tokenized URL for large files.

### LOW
4. Reels slideshow ignores video length / has no pause. 5. Onboarding family-name
default uses the 2nd word of the name.

_(JWT-in-localStorage is resolved — Clerk manages session tokens and refresh.)_

### Testing
Both a fast mocked **unit** suite (134 tests) and a real-Postgres **integration**
suite (6 tests, run via `npm run test:integration`) now exist. The integration suite
executes real SQL — it catches the query-layer bugs the mocked unit tests cannot
(and was verified to fail on the reintroduced `path:'$'` bug). Wiring both into CI is
recommended; see "Testing" in the README.

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
