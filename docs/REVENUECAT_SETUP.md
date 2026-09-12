# RevenueCat subscription release guide

## Implemented

Web settings offer Plus and Premium monthly/annual checkout using prices returned by RevenueCat. Existing subscribers manage their original store subscription. Native settings and paywall support purchase, restore, Customer Center and official store fallback. All purchase actions require current Clerk identity, family ownership and a trusted preflight check. Pending confirmation is shown until the API confirms the purchased tier.

The API fetches complete RevenueCat customer snapshots after webhooks and explicit owner refresh. It handles expiry, cancellation, actual billing grace, refunds, transfers, sandbox isolation, duplicate and out-of-order responses. Family feature gates project expiration at read time and retain referral boosts. Family members cannot see private owner billing details or initiate family checkout.

## Required configuration

| Location | Variable | Value |
| --- | --- | --- |
| API hosting | `REVENUECAT_API_KEY` | Server-only RevenueCat REST v1 key with customer read access; never put a secret key in either app |
| API hosting | `REVENUECAT_WEBHOOK_SECRET` | Same full Authorization header configured in RevenueCat |
| API hosting | `REVENUECAT_ALLOW_SANDBOX` | `false` in production; `true` only for an isolated test backend |
| Web build | `VITE_REVENUECAT_WEB_KEY` | Public RevenueCat Billing SDK key for the web app |
| Web test build | `VITE_REVENUECAT_ALLOW_SANDBOX` | Optional `true` only for sandbox keys/test environment |
| Native build | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Public App Store SDK key |
| Native build | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Public Google Play SDK key, when Android launches |
| Native test build | `EXPO_PUBLIC_REVENUECAT_ALLOW_SANDBOX` | Optional `true` for a dedicated Test Store build; otherwise test keys work only in development |

Keep entitlement identifiers `plus` and `premium`. Add all four products to the current offering with exact product IDs `plus_monthly`, `plus_yearly`, `premium_monthly`, `premium_yearly`. Custom package types are supported when these product IDs match. Unknown or contradictory products cannot be purchased. Configure approved prices: Plus $5.99/month or $59.99/year; Premium $13.99/month or $139.99/year. Checkout displays the actual localized price returned by the store.

Configure a webhook for all relevant events at `https://<API-host>/api/billing/revenuecat` with the shared Authorization header. TEST authenticates and returns a no-op. Failed customer reconciliation returns 503 so RevenueCat retries. Keep production and sandbox purchases on separate backend environments. Never enable sandbox access against production family accounts.

## Dashboard state verified September 12, 2026

Project `c6c99b64` (Our Sweet Family) currently has Test Store products only. Its default offering contains the four product IDs above. No real app store configuration or web payment provider is connected. The Web screen states the signed-in account cannot add app configurations.

Saved Customer Center configuration: screen title “Manage your family subscription” and purchase history enabled. Existing missing-purchase, plan-change, management and refund flows remain available.

An authorized RevenueCat administrator must connect the real App Store application (`com.oursweetfamily.app`) and store credentials, import subscription products and attach their entitlements to the offering. Configure a single Apple subscription group with appropriate upgrade/downgrade levels. Android additionally requires Play configuration. Web requires connecting Stripe for RevenueCat Billing, creating the web app/products/prices, attaching entitlements and configuring checkout branding, support and legal links. No real money checkout has been validated yet.

## Deployment sequence

1. Configure the store/web integrations and required keys on staging; confirm Clerk IDs match RevenueCat App User IDs.
2. Run `npm ci`, `npm run db:generate --workspace=server`, then apply migrations with `npx prisma migrate deploy` from `server/` against the intended database. The new migration adds three nullable columns and does not delete existing data. Production start already runs migrations.
3. Deploy API before either new client; otherwise clients will receive missing-endpoint errors. The new API requires the server key for real event reconciliation, so configure it before rollout.
4. Build/deploy web with its public key. Build a new native development/TestFlight binary with the platform key (native purchase SDK requires a native build). Do not ship the Test Store key in production.
5. Run the acceptance checks below on isolated test accounts, then release production only after real-store configuration and sandbox purchase testing pass. Railway deployment access and EAS/App Store credentials were not available in this session; no production deployment was performed.

## Acceptance checks

- Free owner buys each tier/period; UI prices match store and family access updates after trusted confirmation.
- Cancel checkout, restore with no purchases, restore a valid purchase, and retry a delayed/failed sync. No false “active” state.
- Cancel renewal: access remains until expiration. Billing grace shows a payment warning; expired grace/refunds remove access. Referral boost survives.
- Existing web/native subscriber cannot buy a second subscription. Store management and return-to-app refresh work.
- Switch signed-in accounts and active families during a slow request; previous customer data never appears. Shared members see owner access with no checkout or private management link.
- Duplicate/reordered webhooks and a transfer reconcile both accounts without stale rollback.
- Production rejects sandbox access; sandbox backend allows only its test configuration.
- Confirm live RevenueCat webhook delivery and native Customer Center behavior on a device. Automated tests use fixtures and do not replace this final store validation.

## Verification performed

All server unit tests and isolated PostgreSQL integration tests pass, including applying all 19 migrations from an empty database and concurrent old/new snapshot writes. Web component/identity tests, web production build, native tests and TypeScript checking pass. An independent review identified duplicate-native-checkout and grace-message issues; both were corrected and covered by tests. Web checkout SDK is lazy loaded; its vendor chunk produces a size warning. No real payment was made.

Reference: RevenueCat recommends fetching the current customer after webhook events: https://www.revenuecat.com/docs/integrations/webhooks
