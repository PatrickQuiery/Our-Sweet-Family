# Subscription Management Implementation Plan

> **For agentic workers:** Use executing-plans / subagent-driven-development to implement the independently testable tasks below.

**Goal:** Complete the approved two-tier RevenueCat subscription system across web, mobile and API.
**Architecture:** RevenueCat customer snapshots are the source of truth; the database stores a time-ordered, expiration-aware projection for authorization. Both apps identify with Clerk IDs, display family-owner access, and direct existing subscribers to the originating store to avoid duplicate subscriptions.
**Tech Stack:** Express/Prisma/Postgres; React/Vite with purchases-js; Expo 57 with existing native Purchases SDK.
**Spec:** docs/superpowers/specs/2026-08-17-subscription-billing-design.md, with current implementation decisions below.

## Global constraints
- Preserve Free, Plus ($5.99 monthly/$59.99 annual), Premium ($13.99/$139.99), entitlements plus/premium and native design.
- Prices displayed for checkout must come from store offerings, not local estimates.
- No client-provided plan or customer ID may grant backend access.
- Non-owner family members see shared plan but never receive owner management URLs or initiate family purchases.
- Existing subscribers use store management for plan changes; don't open a second subscription in another store.
- Read Expo v57 documentation before mobile edits. No Expo upgrade.
- Dashboard keys, payment-engine linkage and real-store verification remain explicit release gates if credentials are unavailable.

## Task 1 — trusted billing projection (root)
Files: server/src/lib/billing/{entitlements,applyEntitlement,revenuecat,status}.js, server/src/routes/billing.js, server/src/lib/plan.js, Prisma migration, billing tests.
- [x] Add tests for highest active entitlement, expiration/grace/refund, sandbox exclusion, malformed snapshots, duplicate/older snapshot protection and transfers without product IDs.
- [x] Fetch GET /v1/subscribers/{encoded Clerk ID} with server-only REVENUECAT_API_KEY, timeout and sanitized failure. No event-product inference. Webhook TEST is a no-op; authenticate all other events and reconcile affected users/transfer arrays.
- [x] Persist subscriptionManagementUrl and subscriptionSyncedAt; conditional update prevents an older fetched snapshot overwriting newer state. Preserve referral boost. Enforce expiration at effectivePlan read time.
- [x] GET /api/billing/status?familyId=... returns plan, effectivePlan, subscriptionStatus, subscriptionStore, subscriptionProductId, subscriptionExpiresAt, subscriptionWillRenew, canManage, hasSubscription, managementURL, syncAvailable, planBoostUntil. Without familyId it describes current user. Family membership checked; only owner canManage and sees managementURL; shared members get effectivePlan with private billing metadata redacted.
- [x] POST /api/billing/sync?familyId=... is authenticated, owner-only if family given, rate limited, and returns same status shape after trusted RevenueCat refresh. Reject body-based customer overrides; always use authenticated owner's Clerk ID. If key unavailable return 503, not invented access.
- [x] Replace historical event-only tests with snapshot-based integration/route tests and run server suite plus migration checks.

## Task 2 — web checkout and management (web worker)
Files confined to client/; root package-lock coordinated by root.
- [x] Add @revenuecat/purchases-js; isolated adapter identifies signed-in Clerk user and serializes identity changes; no previous-user customer data leaks.
- [x] Replace inert settings plan buttons with a themed subscription component. Fetch above status for active family, display status/renewal/access end/payment issue/referral boost, clear loading/error/retry states.
- [x] For owner with no current subscription, load offering packages with VITE_REVENUECAT_WEB_KEY; identify tier via exact product/package mapping, show live monthly/annual prices, purchase through SDK. Disable unknown packages. Public production key configured separately; absent configuration gives honest unavailable state.
- [x] After purchase, call server sync and refresh user/family data, with bounded retry/pending messaging for propagation. Cancellation is not an error. Existing subscribers open managementURL (HTTPS only) or official Apple/Google management URL based on store; never a second checkout.
- [x] Add meaningful web tests for package selection, management routing, identity guard, disabled/member state and purchase sync failure. Build web.

## Task 3 — mobile lifecycle/management (mobile worker)
Files confined to mobile/.
- [x] Fix ready so it means identified with current Clerk user; reset on account changes and guard stale async results. Serialized SDK identity operations; accept purchase-returned CustomerInfo immediately.
- [x] Guard paywall until SDK identity and owner status are ready. Remove obsolete pro/product fallback; unknown packages unavailable. Prevent double actions and duplicate subscriptions. Preserve visual style; store prices authoritative, no fixed discount claim.
- [x] Add subscription status component consuming API above. Show owner/shared plan accurately, renewal/expiry/payment issues, restore loading/error/no-purchases distinctly. Refresh on foreground and return from management. Existing subscriptions manage through supported native customer center/store URLs; no external web purchase calls in native UI.
- [x] Purchases and restore trigger trusted /billing/sync and family refresh. Pending backend propagation must not claim fully active access. Show retry when sync fails.
- [x] Verify Expo typecheck and mobile tests, including auth switch and purchase readiness scenarios.

## Task 4 — release readiness (root)
- [x] Reconcile account access, public SDK vs private server keys, dashboard setup and webhook configuration.
- [x] Add operational setup guide including migration, key setup, test/store separation and sandbox acceptance checklist.
- [x] Review changes; run server/web/mobile checks and local visual preview with fixtures if authenticated live testing is blocked.
- [x] Commit changes on isolated branch, publish draft PR if available. No production rollout until required configuration and reviewable result are ready.

## Release outcome
Implementation and automated checks complete. See docs/REVENUECAT_SETUP.md for verified account limitations and production activation gates. Real-store acceptance testing and deployment remain pending external configuration/access.
