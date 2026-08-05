# Our Sweet Family — Mobile (Expo / React Native)

Native iOS + Android client for Our Sweet Family. It talks to the same production
REST API as the web client, authenticating with Clerk (bearer token on every request).

## Important: location

**This app must live OUTSIDE an iCloud-synced folder** (e.g. `~/Developer`, not
`~/Documents`). iCloud stamps `com.apple.FinderInfo` extended attributes on files,
and `codesign` rejects them on macOS Tahoe ("resource fork, Finder information, or
similar detritus not allowed"), breaking the iOS build. If a build fails with that
error, run `xattr -rc .` and confirm the repo is outside `~/Documents`.

It is a **standalone npm install**, NOT a workspace of the monorepo root — hoisting
the React Native tree alongside the web client nests `expo-modules-core` out of
Metro's resolver.

## Environment

Create `mobile/.env` (git-ignored):

```
EXPO_PUBLIC_API_BASE_URL=https://our-sweet-family-production.up.railway.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...   # from the Clerk dashboard → API Keys
```

## Run

```bash
cd mobile
npm install
npx expo run:ios     # first build is slow (prebuild → CocoaPods → Xcode)
```

Requires a UTF-8 locale for CocoaPods:
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`.

The app builds a **custom dev client** (not Expo Go) — Clerk OAuth and the native
modules require it. Metro serves JS on `:8081`; edits hot-reload without a rebuild.

## Test / typecheck

```bash
npm test          # jest-expo unit suite (lib: config, tokenCache, api, memories)
npm run typecheck # tsc --noEmit
```

## Auth notes

- Sign in with **email/password** or **Google** (Clerk `useSSO`).
- Google SSO on native needs the mobile redirect **`oursweetfamily://sso-callback`**
  added to the Clerk dashboard → **Native applications → Allowlist for mobile SSO redirect**.
- Accounts created via Google have no password — use the Google button for those.

## Structure

- `app/` — Expo Router routes: `(auth)/sign-in`, `(app)/` tab group (Timeline / Capture /
  Settings), `memory/[id]` detail.
- `src/lib/` — `config`, `tokenCache` (SecureStore), `api` (bearer fetch client),
  `memories` (families/feed/upload), `types`.
- `src/hooks/` — `useApi`, `useMemories`.
- `src/components/` — `AuthedImage` (expo-image + bearer header), `MemoryCard`.
