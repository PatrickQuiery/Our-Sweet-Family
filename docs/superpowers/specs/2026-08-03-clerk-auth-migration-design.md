# Auth Migration to Clerk — Design

_2026-08-03 · Our Sweet Family_

## Goal

Increase password security and let people sign up / sign in with Google, Apple, and
Facebook (covers the Meta/Instagram audience). Decided: adopt **Clerk** as the hosted
identity provider and **move email/password fully to Clerk**. Clerk delivers the
"password security" upgrade directly — strength estimation (zxcvbn) and **breach
detection (HaveIBeenPwned) on by default**, plus MFA as a toggle.

"Instagram" is not a standalone auth provider (Meta routes it through Facebook Login,
and Instagram Basic Display returns no email); Facebook covers it.

## Principle

Clerk owns **credentials + social + password policy + MFA**. The app keeps its local
`User` table (all data FKs reference `User.id`) and owns **app identity**: role, plan,
family links. Local users are synced from Clerk.

## Data model

```prisma
model User {
  id           String  @id @default(uuid())
  email        String  @unique
  clerkUserId  String? @unique   // Clerk subject; null only for un-migrated seed rows
  passwordHash String?           // now optional — Clerk owns passwords
  name         String
  ...unchanged (role, plan, avatarUrl, relations)
}
```

Migration `add_clerk_user_id`: add nullable `clerkUserId` unique, make `passwordHash`
nullable. Pre-launch → no data migration; existing seed users are linked by email on
first Clerk sign-in (see Sync).

## Server

- `@clerk/express` `clerkMiddleware()` applied globally in `app.js` (reads the Clerk
  session token from `Authorization`).
- **`authenticate` (rewritten `middleware/auth.js`)** = `getAuth(req)` →
  `resolveUser`:
  - No Clerk session → 401.
  - Load local `User` by `clerkUserId`. If none: fetch email/name from Clerk
    (`clerkClient.users.getUser`), **link an existing local row by email** (set
    `clerkUserId`) if present, else **create** a new local `User` (`role: owner`).
  - Set `req.user` (local user) — **every existing route keeps working unchanged.**
- **Retire** `POST /auth/signup`, `POST /auth/login`, `POST /auth/change-password`,
  `PATCH /auth/me` (Clerk owns these). **Keep** `GET /auth/me` → synced local user
  (role/plan). Boot check switches from `JWT_SECRET` to `CLERK_SECRET_KEY`.
- **Invite flow rework:**
  - `POST /members` unchanged in spirit: existing user (local, by email) → add member;
    new email → pending `Invitation` + copyable link + email.
  - `GET /api/invitations/:token` (public) unchanged — info for the accept page.
  - **Replace** `POST /invitations/:token/accept` (set-password) with
    **`POST /invitations/:token/claim`** (Clerk-authenticated): the invitee has just
    signed up via Clerk; verify the token, link `req.user` as `FamilyMember`, mark
    accepted. Email match between invite and Clerk account is enforced.

## Client

- `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>` wraps
  the app (`main.jsx`).
- Replace `/login`, `/signup` pages with Clerk `<SignIn/>` / `<SignUp/>` (social +
  password + strength/breach out of the box). `<UserButton/>` in `AppLayout` (profile,
  password, MFA, connected accounts). Settings' custom name/password forms removed in
  favor of Clerk's `<UserProfile/>`.
- `AuthContext` becomes a thin layer over Clerk `useAuth()`/`useUser()` that also
  fetches `GET /api/auth/me` for role/plan and the family. Route guards use Clerk's
  `<SignedIn>/<SignedOut>` / `useAuth().isSignedIn`.
- Axios request interceptor gets the token via Clerk `getToken()` instead of
  `localStorage`.
- `AcceptInvite` page: mount Clerk `<SignUp/>` with the invited email prefilled; after
  auth, call `POST /invitations/:token/claim`, then route to the dashboard.

## Password security (goal Part A) — delivered by Clerk

- Strength (zxcvbn) + **breach detection (HIBP)** are Clerk defaults on sign-up.
- Configure the password policy (min length, etc.) in the Clerk dashboard (documented).
- MFA (TOTP/SMS) is a Clerk toggle — documented as an easy follow-up, not built here.

## What needs the owner (can't be automated)
- A Clerk account + `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.
- Enable Google / Apple / Facebook in the Clerk dashboard (Clerk supplies shared dev
  credentials for Google & Facebook to test immediately; production uses your own
  provider apps; Apple needs the Apple Developer account).
- Set the password policy. Full step-by-step in README + `CLERK_SETUP.md`.

## Testing

- Manual mock `server/__mocks__/@clerk/express.js` (auto-applied): `clerkMiddleware`
  no-op; `getAuth(req)` returns `{ userId: req.headers['x-clerk-user-id'] || null }`;
  `clerkClient.users.getUser` a jest.fn. Route tests set `x-clerk-user-id` instead of a
  Bearer JWT; existing `prisma.user.findUnique` user mocks are reused.
- New unit tests: `resolveUser` sync (create; link-by-email), and invite `claim`
  (links member; rejects email mismatch / expired / used).
- Integration tests: auth via the same header; DB-query coverage unchanged.
- Live end-to-end (social + password) requires the owner's Clerk keys — validated
  together after handoff.

## Rollout

Branch `feature/clerk-auth`, own PR. Not merged until the owner adds Clerk keys and we
validate sign-in/up + one social provider live. Because it's pre-launch, no user data
migration is needed.

## Non-goals
Building MFA UI (Clerk toggle); migrating existing password hashes into Clerk;
server-side Clerk webhooks (lazy on-request sync is enough at this scale — a
`user.created` webhook can be added later to pre-create local rows).
