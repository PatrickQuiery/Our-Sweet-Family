# Subscription Billing & Management — Design

**Date:** 2026-08-17
**Status:** Approved (key decisions confirmed) — ready for implementation planning
**Author:** Patrick + Claude

## Goal

Fully integrated subscription management and billing across the **web app**, **mobile apps (iOS + Android)**, and the **marketing site**, so a family can purchase and manage a premium subscription on any surface and have entitlements apply everywhere.

## The decision: RevenueCat as the entitlement layer

RevenueCat sits in front of all three purchase channels and is the single source of truth for "what is this user entitled to." Our Postgres `User.plan` remains the authoritative flag the app *reads*; RevenueCat is the billing brain that *sets* it via webhooks.

### Why (the binding constraint)

Apple (StoreKit) and Google (Play Billing) **require their in-app purchase systems for digital subscriptions consumed in-app** — Stripe is not permitted for the subscription inside the iOS/Android apps. Stripe is allowed on the web only. That leaves three purchase channels — Apple IAP, Google IAP, Stripe (web) — that must all resolve to one entitlement. Building that unification (three receipt-validation + renewal + grace-period systems) in-house is a large, perpetual maintenance burden. RevenueCat provides it as a managed service with a unified SDK, entitlements API, and one webhook stream.

As of April 2026, **RevenueCat Web Billing sells Stripe Billing products directly, including Stripe Managed Payments (merchant-of-record)** — so web, iOS, and Android all flow through one RevenueCat customer and one webhook stream.

### Cost

- RevenueCat: **free under $2,500/mo tracked revenue, then 1%.** Effectively free at our stage.
- Store cut: **Apple/Google 15%** (small-business programs, under $1M/yr). **Stripe on web ~2.9% + 30¢** (a bit more with Managed Payments/MoR). Web purchases net materially more margin, so premium is offered on the marketing site (Stripe) as well as via IAP in the apps.

## Confirmed product decisions

1. **Tiers & cadence:** Existing `Plan` enum is `free | plus | premium`. Premium (and Plus, if sold) offered as **monthly + annual**, annual discounted. Exact price points set at store-config time. Placeholder product IDs used during backend build.
2. **Web merchant of record:** **Stripe Managed Payments via RevenueCat** — Stripe/RevenueCat handle global sales tax & VAT.
3. **Identity:** RevenueCat `app_user_id` = our `User.id` (the paying user, typically the family owner). Clerk gives us a stable id before purchase, so no anonymous-id aliasing headaches.

## Entitlement model (how it maps to our code)

- `User.plan` (free/plus/premium) stays the authoritative flag; **all existing gating via `effectivePlan(user)` is unchanged.**
- `effectivePlan` already returns the **max of base plan and the referral boost** (`planBoostUntil`). A paid subscription and a referral boost coexist correctly: on subscription expiry we set `User.plan = 'free'`, and any still-active boost continues to apply at read time. Paid premium (rank 2) is never downgraded by a boost (rank 1).
- RevenueCat **entitlement identifier → tier** mapping (config, not code): entitlement `premium` → `User.plan = 'premium'`; entitlement `plus` → `'plus'`; no active entitlement → `'free'`.

### New persisted fields (on `User`)

Billing metadata so support/UX can show status and renewal without calling RevenueCat live:

- `subscriptionStatus String?` — `active | in_grace | billing_issue | canceled | expired | null`
- `subscriptionStore String?` — `app_store | play_store | stripe`
- `subscriptionProductId String?` — the purchased product identifier
- `subscriptionExpiresAt DateTime?` — current period end / expiration
- `subscriptionWillRenew Boolean?` — auto-renew on/off

These are **descriptive**; `plan` remains the gate. `canceled` (auto-renew off but not yet expired) still means `plan` is the paid tier until `subscriptionExpiresAt`.

## Architecture

```
 Apple IAP ─┐
 Google IAP ─┼─► RevenueCat (entitlements, receipt validation, renewals) ─► webhook ─► our Express server ─► Postgres User.plan + subscription* fields
 Stripe web ─┘                                                                        ▲
                                                                                      └── app reads User.plan via effectivePlan() (unchanged)
```

### Server (store-agnostic core — needs no store accounts to build)

- **`POST /api/billing/revenuecat`** — webhook receiver. Verifies RevenueCat's `Authorization` header (shared secret), parses the event, and calls the sync service. Idempotent (events may be redelivered).
- **`lib/billing/entitlements.js`** — pure mapping: a RevenueCat event/entitlement snapshot → `{ plan, subscriptionStatus, subscriptionStore, subscriptionProductId, subscriptionExpiresAt, subscriptionWillRenew }`. Fully unit-testable with fixture payloads.
- **`lib/billing/applyEntitlement.js`** — writes the mapping to the `User` row by `app_user_id` (our user id). Never throws on unknown users (logs + 200 so RevenueCat doesn't hammer retries).
- **`GET /api/billing/status`** — authed endpoint returning the current user's `plan` + subscription\* fields for the manage-subscription UI.
- Events handled: `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION` (auto-renew off), `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED`, `TRANSFER`.

### Mobile (Expo)

- Add `react-native-purchases` (RevenueCat SDK; native module → native rebuild, same flow as our AsyncStorage add).
- Configure with the RevenueCat public API key; identify with `Purchases.logIn(user.id)` after Clerk auth.
- Paywall screen (Settings → "Upgrade") listing the current offering; `Purchases.purchasePackage()` drives StoreKit/Play Billing.
- Entitlement is authoritative from our backend (webhook-updated `plan`); the SDK is used for the purchase flow and an optimistic local refresh.

### Web

- RevenueCat Web SDK / Web Purchase Link on the marketing site and the in-app upgrade screen, backed by Stripe Billing + Managed Payments.
- "Manage subscription" links to the store-appropriate management surface: Apple/Google deep links for IAP subscribers; Stripe customer portal for web subscribers.

## Phasing

- **Phase 1 — Store-agnostic backend (no accounts needed):** schema fields + migration, entitlements mapping (TDD with fixtures), webhook endpoint with signature verification + idempotency, `GET /api/billing/status`, tests. *This is what we build now.*
- **Phase 2 — RevenueCat + store setup (needs your accounts):** RevenueCat project, App Store Connect + Play Console products, Stripe connection, entitlement/offering config, webhook secret into Railway env.
- **Phase 3 — Mobile paywall:** `react-native-purchases`, identify, paywall UI, purchase + restore, native rebuild.
- **Phase 4 — Web paywall + manage:** Web SDK/purchase links, upgrade screen, manage-subscription surface.
- **Phase 5 — Polish:** billing-issue banners, grace-period messaging, receipt/restore edge cases, analytics.

## Out of scope (for now)

- Family-shared entitlement (one purchase covering multiple member logins) — v1 gates on the owner's plan, which already governs family features. Revisit if members need to purchase.
- Proration/upgrade-downgrade flows beyond what the stores/RevenueCat handle natively.
- Promo codes / win-back offers.

## Risks & mitigations

- **Webhook is the source of truth; missed events cause drift.** Mitigate with idempotent handlers, a periodic reconciliation job (RevenueCat REST `GET /subscribers/{app_user_id}`), and never trusting the client SDK alone for entitlement.
- **App Store review** requires a functional paywall + restore purchases; ensure both before submitting.
- **Anonymous → identified aliasing:** always `logIn` with our user id before purchase to avoid orphaned anonymous customers.
