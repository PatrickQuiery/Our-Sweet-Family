# Our Sweet Family

A private, secure family photo and video sharing platform focused on children's memories. Built as a mobile-first full-stack web application.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, React Router v6 |
| Backend | Node.js, Express |
| Database | PostgreSQL + Prisma ORM |
| File Storage | AWS S3 or local disk (configurable) |
| Auth | Clerk (email/password + Google/Apple/Facebook + MFA) |
| Image Processing | Sharp (thumbnails + compression) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- (Optional) AWS S3 bucket for production storage

### 1. Clone and install

```bash
git clone <repo-url>
cd our-sweet-family
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/our_sweet_family"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# "local" uses ./server/uploads/ directory, "s3" uses AWS
STORAGE_PROVIDER="local"

# Required only when STORAGE_PROVIDER=s3
AWS_BUCKET="your-bucket"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY="..."
AWS_SECRET_KEY="..."

PORT=3001
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"

# Contact form (email delivery is optional locally — messages are still saved to the DB)
CONTACT_TO="Contact@oursweetfamily.com"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="no-reply@oursweetfamily.com"
```

> **Security:** `JWT_SECRET` must be a strong, unique value of at least 16
> characters. The server refuses to start with a missing, short, or example secret.

### 3. Set up the database

```bash
# Create the database
createdb our_sweet_family

# Apply migrations (production uses `prisma migrate deploy`)
cd server
npx prisma migrate deploy

# Seed with demo data
npm run db:seed
```

### 4. Run the app

```bash
# From root (runs both client + server concurrently)
npm run dev

# Or individually:
cd server && npm run dev    # http://localhost:3001
cd client && npm run dev    # http://localhost:5173
```

Open http://localhost:5173

---

## Testing

Two suites:

```bash
cd server

# Unit tests — fast, Prisma is mocked. No database required.
npm test

# Integration tests — run against a REAL Postgres (the test database), so they
# exercise actual SQL (JSON array_contains filters, access control, pagination).
npm run test:integration

# Both
npm run test:all
```

Integration tests need a Postgres database. Locally, create it once:

```bash
createdb our_sweet_family_test
```

By default they connect to `postgresql://postgres@localhost:5432/our_sweet_family_test`.
Override with `DATABASE_URL_TEST` (e.g. point it at a CI Postgres service). Migrations
are applied automatically before the run, and every test truncates the tables so runs
are isolated and order-independent.

> Why both? The unit suite mocks the database, so it can't catch query-layer bugs
> (a MySQL-vs-Postgres JSON filter once shipped green). The integration suite runs
> real queries and would have caught it.

---

## Demo Accounts

Authentication is via Clerk, so sign up (or sign in) through the app using one of the
seeded emails below — on first sign-in the Clerk identity is **linked** to the seeded
family and its memories (there is no password to migrate). Set up Clerk first
([CLERK_SETUP.md](CLERK_SETUP.md)).

Seeded family emails:

| Role | Email | Password |
|------|-------|----------|
| Parent (Owner) | parent@demo.com | password123 |
| Grandma (Loved one) | grandma@demo.com | password123 |

---

## Project Structure

```
our-sweet-family/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── pages/             # Route-level pages
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Onboarding.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Upload.jsx
│   │   │   ├── MemoryDetail.jsx
│   │   │   ├── Children.jsx
│   │   │   ├── Family.jsx
│   │   │   ├── Reels.jsx
│   │   │   ├── Milestones.jsx
│   │   │   └── Settings.jsx
│   │   ├── components/        # Shared UI components
│   │   │   ├── AppLayout.jsx  # Sidebar navigation shell
│   │   │   └── MemoryCard.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── lib/
│   │       └── api.js         # Axios instance
│   └── ...
│
└── server/                    # Express backend
    ├── src/
    │   ├── routes/
    │   │   ├── auth.js        # POST /api/auth/signup, /login, GET /me
    │   │   ├── families.js    # CRUD families
    │   │   ├── children.js    # CRUD children
    │   │   ├── memories.js    # Upload, list, reactions, comments
    │   │   ├── members.js     # Invite/manage loved ones
    │   │   ├── milestones.js  # Height, weight, stories (Plus+)
    │   │   └── reels.js       # Memory reel generation
    │   ├── middleware/
    │   │   └── auth.js        # JWT authentication middleware
    │   └── lib/
    │       ├── prisma.js      # Prisma client singleton
    │       ├── storage.js     # Local disk / S3 upload abstraction
    │       └── ageLabel.js    # Age calculation utility
    └── prisma/
        ├── schema.prisma      # Full database schema
        └── seed.js            # Demo data seeder
```

---

## API Endpoints

### Auth
Authentication (email/password, Google, Apple, Facebook, MFA, breach detection) is
handled by **[Clerk](https://clerk.com)** on the client. The API verifies Clerk
session tokens and syncs a local user row. See [CLERK_SETUP.md](CLERK_SETUP.md).

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/me | Current user (created/linked from Clerk on first request) |

### Contact
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contact | Public contact form → persists + emails `CONTACT_TO` |

### Families
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/families | List user's families |
| POST | /api/families | Create family |
| GET | /api/families/:id | Get family detail |
| PUT | /api/families/:id | Update family name |

### Children
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/children?familyId= | List children |
| POST | /api/children | Add child |
| PUT | /api/children/:id | Update child |
| DELETE | /api/children/:id | Remove child |

### Memories
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/memories?familyId=&childId=&page=&type= | Paginated feed |
| POST | /api/memories | Upload photo/video (multipart) |
| GET | /api/memories/:id | Single memory with comments/reactions |
| GET | /api/memories/:id/file | Authenticated media stream (original) — access-checked |
| GET | /api/memories/:id/thumb | Authenticated media stream (thumbnail) — access-checked |
| DELETE | /api/memories/:id | Delete memory |
| POST | /api/memories/:id/reactions | Toggle love reaction |
| DELETE | /api/memories/:id/reactions | Remove reaction |
| POST | /api/memories/:id/comments | Add comment |
| DELETE | /api/memories/:memoryId/comments/:commentId | Delete comment |

### Members (Loved ones)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/members?familyId= | List members |
| POST | /api/members | Invite by email (existing user → added directly; new email → pending invitation + link) |
| PUT | /api/members/:id | Update permissions |
| DELETE | /api/members/:id | Revoke access |

### Invitations
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/invitations?familyId= | Owner: list pending invitations |
| GET | /api/invitations/:token | Public: invite info for the accept page |
| POST | /api/invitations/:token/claim | Clerk-authenticated: link the signed-in invitee to the family |
| DELETE | /api/invitations/:id | Owner: revoke a pending invitation |

### Milestones (Plus+)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/milestones?childId= | List milestones |
| POST | /api/milestones | Add milestone |
| DELETE | /api/milestones/:id | Delete milestone |

### Reels
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reels?familyId=&type=annual|monthly|birthday|holiday | Generate reels |

---

## Feature Plans

| Feature | Free | Plus | Premium |
|---------|------|------|---------|
| Photo uploads (compressed) | ✓ | ✓ | ✓ |
| Video storage | 20GB | 200GB | Unlimited |
| Original quality photos | — | ✓ | ✓ |
| Annual Memory Reel | ✓ | ✓ | ✓ |
| Monthly Memory Reel | — | ✓ | ✓ |
| Birthday & Holiday Reels | — | — | ✓ |
| Milestones tracker | — | ✓ | ✓ |
| Export originals | — | ✓ | ✓ |
| AI face tagging | — | — | ✓ |
| Classified memories | — | — | ✓ |

---

## Key Behaviors

- **EXIF date extraction**: Upload date falls back to file upload time if EXIF `DateTimeOriginal` is unavailable
- **Age labels**: Auto-calculated from child DOB → memory capture date (e.g. "2 years, 3 months")
- **Per-child access**: Loved ones only see memories tagged to children they're allowed to see
- **Classified memories**: Only visible to users with `role = owner`; hidden from all loved ones (Premium)
- **Thumbnail generation**: Sharp creates 400×400 JPEG thumbnails for all photo uploads
- **Private media**: files are stored under opaque keys and served only through the
  authenticated, access-checked `/api/memories/:id/file` and `/thumb` endpoints (the
  client fetches them with its bearer token). In production the S3/R2 bucket must be
  **private** — there is no public/static media path.
