# Mobile Phase 3 — Native Premium Implementation Plan

> **For agentic workers:** execute task-by-task at the EAS-build stage. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Push notifications + background camera-roll auto-upload for the mobile app.

**Architecture:** Expo custom dev client (NOT Expo Go — notifications and background tasks require native modules). The server groundwork is already merged (DeviceToken, `/api/devices`, push-send hooks, `clientAssetId` upload dedupe). This plan is the **device-gated** mobile half.

**Tech stack:** `expo-notifications`, `expo-device`, `expo-task-manager`, `expo-background-task` (or `expo-background-fetch`), `expo-media-library`, `expo-sqlite`.

---

## Prerequisites (why this is gated)

- **EAS dev build** — `eas build --profile development`. Expo Go cannot host these native modules.
- **Store/developer accounts** (for real-device + push): Apple Developer ($99/yr) for APNs, Google Play ($25) for FCM; configure push credentials with `eas credentials`.
- **Already done (server, PR merged):** `DeviceToken` model + migration, `POST/DELETE /api/devices`, push fired on new memory (to family) and new comment (to uploader), and `clientAssetId` dedupe on `POST /memories`. Mobile data layer `src/lib/devices.ts` (`registerDevice`/`unregisterDevice`) is in place.

## Task 1 — Install native modules & config plugins

- [ ] `npx expo install expo-notifications expo-device expo-task-manager expo-background-task expo-media-library expo-sqlite`
- [ ] `app.json`: add the `expo-notifications` plugin (icon/color), `expo-media-library` plugin (photo permission + `NSPhotoLibraryUsageDescription`), and background modes — iOS `UIBackgroundModes: ["fetch", "processing"]`, Android `WorkManager` is automatic. Add a `BGTaskSchedulerPermittedIdentifiers` entry for the processing task.
- [ ] `eas build --profile development` for iOS + Android; install the dev client on a real device.

## Task 2 — Push registration

- [ ] `src/lib/notifications.ts`: `registerForPush(api)` — check `Device.isDevice`, request permissions (`Notifications.requestPermissionsAsync`), get `Notifications.getExpoPushTokenAsync({ projectId })`, then `registerDevice(api, token, Platform.OS)`. On Android, create the default notification channel.
- [ ] Call it from `FamilyProvider` (or a `useNotifications` hook) once signed in; call `unregisterDevice` on sign-out (before Clerk `signOut`).
- [ ] Foreground handler: `Notifications.setNotificationHandler` (show alert + sound).
- [ ] Tap handling: `Notifications.addNotificationResponseReceivedListener` → route by `data.type` (`memory` → `/memory/:id`, `comment` → `/memory/:id`) using `expo-router`.

## Task 3 — Background auto-upload engine (premium)

- [ ] **Cursor store** (`src/lib/syncCursor.ts`) via `expo-sqlite`: persist `{ lastAssetId, lastCreationTime }` so each run processes only new assets.
- [ ] **Enumerate** (`src/lib/autoUpload.ts`): `MediaLibrary.getAssetsAsync({ createdAfter: cursor, sortBy: creationTime, mediaType: [photo, video] })`; for each new asset, resolve a local URI (`getAssetInfoAsync`) and upload via the existing `uploadMemory` **passing `clientAssetId: asset.id`** (server dedupes). Advance the cursor after each success.
- [ ] **Background task** (`expo-task-manager` + `expo-background-task`): define a task that runs the enumerate→upload→advance loop; register it on app start when auto-upload is enabled. iOS is best-effort (runs on periodic wake); Android uses WorkManager. Also run the loop on app foreground.
- [ ] **User controls** (Settings → new "Auto-upload" screen, premium-gated on `effectivePlan`): master toggle, album selection, start date (today-forward vs backfill), **Wi-Fi-only** (`expo-network`), and a "Last backed up" indicator. Request photo-library + background permissions with graceful degradation.
- [ ] **Premium gate:** enabled only when the family owner's plan is Plus/Premium; free users keep manual capture. Surface the gate in the Auto-upload screen.

## Task 4 — Verify on device

- [ ] Push: post a memory/comment from a second account → notification arrives on device; tapping deep-links to the memory.
- [ ] Auto-upload: take a photo → appears in the feed within a background wake (foreground immediately); confirm no duplicates across app relaunch/reinstall (server dedupe).
- [ ] Wi-Fi-only + start-date controls behave; free plan shows the upgrade gate.
- [ ] TestFlight (iOS) / Play internal testing for real-device validation.

## Notes / platform reality

- **iOS** does not run code while the app is force-killed; background sync is *best-effort* (new photos land on the next wake, not the instant the shutter clicks). Set expectations in-product via the "Last backed up" indicator. **Android** (WorkManager + foreground service for large batches) is closer to always-on.
- Large videos on cellular: consider resumable uploads (tus) later; the MVP reuses the existing multipart XHR upload.
