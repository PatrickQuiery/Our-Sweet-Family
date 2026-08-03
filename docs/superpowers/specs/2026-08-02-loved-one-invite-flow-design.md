# Loved-One Invite Flow — Design

_2026-08-02 · Our Sweet Family_

## Problem

Inviting a loved one currently creates a real `User` row with a random password and
no way to set one (`server/src/routes/members.js`). The invitee can never log in, and
their email is squatted (blocks their own future signup). The whole loved-one login
journey is broken; the demo only works because the seed sets grandma's password
directly.

## Goals

- A loved one invited by email can securely gain access by setting their own password.
- No real `User` is created for an unverified email until they accept.
- Existing registered users are added to the family immediately (they can already log in).
- The owner can share the invite even before transactional email is configured.

Non-goals: changing the permission/role model; multi-family; email deliverability
infrastructure beyond the existing SMTP mailer.

## Decisions (confirmed with owner)

1. **Delivery:** email the link when SMTP is configured **and** always return a
   copyable `inviteUrl` the Family page shows the owner. Works today without SMTP.
2. **Existing users:** if the invited email already has an account, add them directly
   as a `FamilyMember` (no token, matches current UX).

## Data model

New Prisma model:

```prisma
model Invitation {
  id             String    @id @default(uuid())
  familyId       String
  email          String
  permissions    Permission @default(view_only)
  accessPerChild Json       @default("\"all\"")
  tokenHash      String     @unique   // sha256(rawToken); raw token only in the link
  invitedById    String
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime   @default(now())

  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  @@index([familyId])
  @@index([email])
}
```

`Family` gains `invitations Invitation[]`. The placeholder-`User` creation is removed
from the invite path.

## Endpoints

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| POST | `/api/members` | owner | Existing user → create `FamilyMember`, return `{ member }`. New email → create `Invitation` (random token, hash stored), email link best-effort, return `{ invitation, inviteUrl }`. Already a member → 409. Pending invite for same email → re-issue token. |
| GET | `/api/invitations/:token` | public | Validate token (hash lookup, not expired, not accepted) → `{ email, familyName, inviterName }`. 410 if expired/used, 404 if unknown. |
| POST | `/api/invitations/:token/accept` | public | Body `{ name, password(min 8) }`. Create `User` (loved_one, hashed pw) + `FamilyMember`, set `acceptedAt` (single-use), return `{ token, user }` (auto-login). If a user with that email now exists → link membership to it, mark accepted, return `{ existingAccount: true }` (no password set). |
| GET | `/api/invitations?familyId=` | owner | List pending (unaccepted, unexpired) invitations. |
| DELETE | `/api/invitations/:id` | owner | Revoke a pending invitation. |

`inviteUrl = ${CLIENT_URL}/accept-invite?token=<raw>`.

## Client

- **Family page** (`Family.jsx`): on inviting a new email, surface the copyable
  `inviteUrl` with a "Copy link" affordance; add a **Pending invitations** section
  (email + revoke). Existing-user invites still just appear in the members list.
- **New public page** `AcceptInvite.jsx` at `/accept-invite?token=…`: fetch invite
  info (shows family name + email); form for name + password; on submit call accept,
  store the returned JWT, redirect to `/dashboard`. Handle expired/invalid (message +
  link to sign in) and the `existingAccount` case (prompt to sign in).
- Route registered as public in `App.jsx`.

## Security

- Token: 32 random bytes (hex). Only the SHA-256 **hash** is stored; the raw token
  lives only in the emailed/copied link. 7-day expiry. Single-use (`acceptedAt`).
- Accept + get-info are token-gated public endpoints; list/revoke are owner-only.
- Accept endpoint validated (name required, password ≥ 8) and covered by the existing
  rate limiters (global; auth-tier not applicable since path is `/api/invitations`).
- Generic responses for invalid tokens (no email enumeration beyond what the owner
  already supplied).

## Testing (unit, mocked Prisma)

- invite new email → creates invitation, returns inviteUrl
- invite existing user → creates member directly, no invitation
- invite already-a-member → 409
- get-info: valid → data; expired/used → 410; unknown → 404
- accept valid → creates user + member, marks accepted, returns token
- accept expired/invalid → 4xx, no user created
- accept when email now has an account → links membership, `existingAccount: true`
- list pending (owner) / revoke (owner, 403 for non-owner)

## Rollout note

Existing placeholder `User` rows from the old flow (if any in production) are left as-is;
they simply won't be able to log in until re-invited under the new flow. A one-off
cleanup script can be added later if needed (out of scope here).
