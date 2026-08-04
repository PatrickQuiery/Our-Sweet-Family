# Native Mobile Apps (iOS + Android) — Design Spec

**Date:** 2026-08-04
**Status:** Approved design — pending implementation planning
**Author:** Patrick Quiery (with Claude)

## 1. Overview

Our Sweet Family currently ships as a responsive web app (React/Vite client on Vercel,
Express/Prisma API on Railway, Neon Postgres, Clerk auth, Cloudflare R2 media). This spec
covers adding **native iOS and Android apps** built with **Expo (React Native)**.

The backend is already mobile-ready: it is a stateless REST API where every request carries
a Clerk bearer token. The mobile app is therefore a **new client against the existing API**,
not a re-architecture. The server is untouched for Phases 1–2; Phase 3 adds a few small,
additive endpoints/columns.

### Goals

- One codebase → both iOS and Android, reusing the team's React + Clerk knowledge.
- **Full feature parity** with the web app, reached in phases.
- **Native-first capabilities** that a website cannot do well: in-app capture, push
  notifications, save-to-camera-roll, deep links, and (premium) **background auto-upload**
  of the camera roll.
- A **usable app in-hand early** (phased delivery), not a big-bang parity launch.

### Non-goals

- Rebuilding or replacing the web app (it stays as-is).
- Changing the backend architecture, auth model, or storage.
- Building for tablets/desktop-class layouts as a first-class target (phones first;
  tablet layouts are a later nicety).
- Shipping the background auto-upload engine in the MVP (it is Phase 3, but the MVP is
  architected so it can be added without rework).

## 2. Framework decision

**Chosen: Expo (React Native), TypeScript.**

| Approach | Why / why not |
|---|---|
| **Expo (React Native)** ✅ | Reuses React/JS skills and much business logic; first-class `@clerk/clerk-expo` SDK (existing Google SSO works on native); same REST API + bearer-token pattern; one codebase → iOS + Android; **custom native modules via config plugins** — the escape hatch required for background photo backup. |
| Flutter ❌ | Best raw native feel, but Dart means zero reuse of React/Clerk knowledge and a whole new toolchain. |
| Capacitor (webview wrapper) ❌ | Fastest to stores but a webview **cannot** do reliable background camera-roll sync (PhotoKit/WorkManager are native-only) — it structurally blocks the headline premium feature. |

**Language:** TypeScript for the mobile app. The web client stays JavaScript; they need not
match. The background-sync engine in particular benefits from static types.

## 3. Architecture

### 3.1 Monorepo placement

- New **`mobile/`** workspace beside `client/` and `server/` (npm workspaces).
- Metro/React Native hoisting in an npm-workspaces monorepo can be finicky; if hoisting
  causes trouble, the `mobile/` app keeps its own isolated `node_modules` resolution
  (documented in the implementation plan). This is a known, solvable integration wrinkle.

### 3.2 App structure

- **Expo Router** (file-based routing, current Expo default).
- **Native bottom tab bar:** Timeline · Capture · Reels/Milestones · Settings.
- **`@clerk/clerk-expo`** for auth, tokens cached in **`expo-secure-store`**.
- An **API layer** mirroring the web client's axios interceptor: attach
  `Authorization: Bearer <clerkToken>` to every request; base URL points at the Railway API
  (`https://our-sweet-family-production.up.railway.app/api`).
- **Media viewing:** native components (`expo-image`, `expo-video`) accept an
  `Authorization` header directly on the source, so the app reads the existing authed
  `/api/memories/:id/file|thumb` endpoints without the blob-fetch workaround the web client
  uses.

### 3.3 Build & distribution

- **EAS Build** with a **custom dev client** (not plain Expo Go — social OAuth and native
  modules require a dev build).
- Local verification in the **iOS Simulator** during development.
- Real-device + store testing via **TestFlight** (iOS) and **Play internal testing** (Android).
- **Accounts required before store distribution (user-provided):** Apple Developer Program
  ($99/yr), Google Play Developer ($25 one-time). Not needed until past the simulator stage.

## 4. Phase 1 — MVP (core loop, usable end-to-end)

The smallest app that is genuinely useful: sign in, see the family feed, capture and upload.

### Screens

1. **Sign in / sign up** — Clerk (email/password + Google; Apple/Facebook when finished).
2. **Timeline** — family feed via `GET /api/memories?familyId=&page=&limit=` (pagination
   already supported), cards show media + child tags, pull-to-refresh, infinite scroll.
3. **Memory detail** — full photo/video, caption, location (respecting the family
   `showPhotoLocation` setting), reactions/comments (view first; interact is a fast-follow).
4. **Capture → upload** — the native centerpiece: `expo-camera` / `expo-image-picker` to
   shoot or pick media, tag a child, add a caption, then `POST /api/memories` (multipart),
   uploaded in the background so it survives navigating away.

### Family context

The app resolves the user's family (the web client uses `families[0]`; the app matches this
for the MVP, with a family switcher deferred to Phase 2). Child list drives capture tagging
and feed filters.

### Phase 1 exit criteria

Signing in with Google on a real iPhone, viewing the family timeline, and capturing +
uploading a photo from the app — verified in the iOS Simulator and on at least one physical
device via TestFlight.

## 5. Phase 2 — Parity

New screens over **existing** endpoints (minimal/no server work):

- **Reels** — video-only feed (vertical, swipeable), existing memories filtered to `video`.
- **Milestones** — per-child milestone timeline (existing endpoints).
- **Children & Family management** — add/edit children (name, gender, DOB, avatar); co-parent
  "Parent (full access)" role; member list; **family switcher** (removes the `families[0]`
  simplification).
- **Invites** — generate/share an invite link, and **accept an invite by opening the link on
  a phone**. Requires **deep linking** (universal links / app links) so a tapped invite routes
  into the app (falls back to web if the app is not installed).
- **Settings** — plan & usage meter, photo-location toggle, referrals, Clerk profile +
  sign-out, and **download originals → save to camera roll** (`expo-media-library`),
  role-gated exactly as on web.
- **Tags & fuzzy search** across the feed (existing `search` query param).

## 6. Phase 3 — Native premium

### 6.1 Push notifications

- **`expo-notifications`**; device push tokens registered server-side.
- Triggers: new memory posted, new comment/reaction, invite accepted, milestone added.
- Tapping a notification deep-links to the relevant screen.

### 6.2 Background auto-upload sync engine (paid tier — headline feature)

Automatically upload new camera-roll photos/videos in the background for paid families.

- **Asset enumeration:** `expo-media-library` reads the camera roll.
- **Sync cursor:** last-synced asset id + timestamp persisted locally (`expo-sqlite`), so each
  run processes only *new* assets.
- **Background execution:** `expo-task-manager` → iOS Background Tasks (`BGProcessingTask` /
  Background App Refresh) and Android `WorkManager`. On each background wake **or** app-open:
  diff new assets since the cursor → upload → advance the cursor.
- **User controls:** choose albums / a start date (today-forward vs backfill), **Wi-Fi-only**
  toggle, battery-aware scheduling. Photo-library + background-refresh permissions requested
  with graceful degradation if denied.
- **Premium gate:** enabled only for paid plans (`effectivePlan`); free users retain manual
  capture/upload.

**Platform reality (explicitly designed around):**

- **Android** — close to "always on": `WorkManager` (+ a foreground service for large batches)
  watches the roll and uploads reliably in the background.
- **iOS** — Apple does **not** run arbitrary code while an app is force-killed. Behavior is
  *best-effort*: iOS periodically wakes the app, and each wake enumerates "new since last
  sync" and uploads. New photos land reliably, just not the instant the shutter clicks if the
  app has been killed for a long time. This matches how third-party backup apps behave; it is
  a platform limit, not a defect.

### 6.3 Server changes required by Phase 3 (small, additive)

1. **`DeviceToken` model** — `{ id, userId, token, platform, createdAt }`; `POST /api/devices`
   to register (and remove on sign-out); a push-send hook fired when a memory/comment is
   created.
2. **Auto-upload dedupe** — optional `clientAssetId` (+ content hash) on `Memory`, unique per
   family; the upload endpoint upserts/skips duplicates so the same photo never double-uploads
   across wakes or reinstalls.

> **Deep-link association files** (`apple-app-site-association`, `assetlinks.json`, hosted on
> `oursweetfamily.com` via Vercel) are **introduced in Phase 2** alongside invite deep links —
> they are a static hosting change, not an API change. Phase 1 requires no server changes;
> Phase 2 requires only the hosted association files; the API/schema additions above are
> Phase 3.

## 7. Verification strategy

- **During development:** build and drive the app in the **iOS Simulator** for each slice
  (auth, feed render, capture/upload round-trip against the live API).
- **Per phase:** exit criteria verified on the simulator and at least one physical device via
  TestFlight / Play internal track.
- **API round-trips** reuse the live production API (same endpoints the web app is already
  verified against).

## 8. Risks & open questions

- **npm-workspaces + Metro hoisting** — may need isolated resolution for `mobile/`; solvable,
  flagged in the plan.
- **Large video uploads on cellular/background** — MVP uses simple multipart; resumable
  uploads (e.g. tus) may be warranted for Phase 3 background sync of large videos. Decide when
  we reach it.
- **iOS background cadence** — set user expectations in-product (see 6.2); consider a
  "last backed up" indicator so users understand best-effort timing.
- **Clerk session longevity on device** — confirm token refresh + secure-store caching
  behave for long-lived mobile sessions (validate in Phase 1).
- **Deep-link + Clerk OAuth redirect** — native OAuth uses an app scheme / universal link;
  confirm the Clerk redirect configuration for the dev client and production builds.
- **Store review** — a family app handling children's photos may draw extra App Store review
  scrutiny (privacy labels, data-collection disclosures); budget time for privacy manifests
  and store metadata.

## 9. Phasing summary

| Phase | Scope | Server work |
|---|---|---|
| **1 — MVP** | Auth (incl. Google), timeline, memory detail, native capture→upload | None |
| **2 — Parity** | Reels, milestones, children/family mgmt, family switcher, invites (deep links), settings, download-to-roll, tags/search | Hosted deep-link association files (static, no API change) |
| **3 — Native premium** | Push notifications, background auto-upload sync engine (paid) | `DeviceToken`, `clientAssetId` dedupe |
