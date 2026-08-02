# Our Sweet Family

A private, secure family photo and video sharing platform focused on children's memories. Built as a mobile-first full-stack web application.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, React Router v6 |
| Backend | Node.js, Express |
| Database | PostgreSQL + Prisma ORM |
| File Storage | AWS S3 or local disk (configurable) |
| Auth | JWT-based |
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

## Demo Accounts

After seeding, these accounts are available:

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
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Get current user |
| PATCH | /api/auth/me | Update display name |
| POST | /api/auth/change-password | Change password (verifies current) |

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
| POST | /api/invitations/:token/accept | Public: set password, create account, join family |
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
