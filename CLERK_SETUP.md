# Clerk Setup

Authentication (email/password, Google, Apple, Facebook, MFA, breach detection) is
handled by [Clerk](https://clerk.com). This is the one-time setup the owner must do —
it needs a Clerk account and can't be automated.

## 1. Create a Clerk application
1. Sign up at https://dashboard.clerk.com and **Create application**.
2. Under **Email, phone, username**, enable **Email address** + **Password**.
3. Copy the API keys from **API Keys**:
   - **Publishable key** (`pk_test_…`) → client env `VITE_CLERK_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_…`) → server env `CLERK_SECRET_KEY`

## 2. Set environment variables
- `client/.env`: `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
- `server/.env`: `CLERK_SECRET_KEY=sk_test_...` (and `CLERK_PUBLISHABLE_KEY=pk_test_...`)

The API refuses to start without `CLERK_SECRET_KEY`; the client throws without the
publishable key.

## 3. Enable social sign-in (Google / Apple / Facebook)
In the Clerk dashboard → **User & Authentication → Social Connections**:

- **Google** and **Facebook**: toggle on. In **development**, Clerk provides shared
  OAuth credentials so you can test immediately. For **production**, add your own:
  - Google: create OAuth credentials in Google Cloud Console; paste Client ID/Secret.
  - Facebook: create an app at developers.facebook.com (Facebook Login) and add its
    App ID/Secret. (This also covers the Instagram/Meta audience — Instagram is not a
    standalone login provider and returns no email.)
- **Apple**: requires a paid **Apple Developer** account. Create a Services ID + key
  and paste them into Clerk. (Apple only returns the user's name on first sign-in.)

Once enabled, the social buttons appear automatically in the `<SignIn/>`/`<SignUp/>`
components — no code change.

## 4. Strengthen the password policy (the "password security" upgrade)
In **User & Authentication → Password**:
- Clerk enforces **strength (zxcvbn)** and **breach detection (HaveIBeenPwned)** by
  default — leave these on.
- Optionally raise the minimum length and require a minimum strength score.
- (Optional) Enable **Multi-factor** under **Multi-factor** for TOTP/SMS 2FA — no code
  change needed; Clerk's `<UserProfile/>` exposes enrollment.

## 5. Production domains
In **Domains**, add `oursweetfamily.com` (and your Vercel/Railway URLs). Set the
allowed redirect origins to your client URL. Clerk issues production keys
(`pk_live_…`/`sk_live_…`) for the production instance — swap them into prod env.

## How it fits together
- The client uses Clerk's `<SignIn/>`, `<SignUp/>`, `<UserButton/>`, `<UserProfile/>`.
- The API verifies Clerk session tokens (`@clerk/express`) and, on first authenticated
  request, creates/links a local `User` row (by email) so families, memories and
  memberships keep working. See `GET /api/auth/me`.
- Invites: the invitee signs up via Clerk (email prefilled), then the app calls
  `POST /api/invitations/:token/claim` to link them to the family.

## Existing/demo data
Pre-launch, the seed users (e.g. `parent@demo.com`) have no Clerk identity. Signing
up in Clerk with that same email **links** to the seeded family and its memories on
first sign-in. There is no password to migrate — Clerk owns passwords now.
