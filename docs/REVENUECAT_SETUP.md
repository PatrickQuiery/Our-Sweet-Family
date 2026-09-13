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

## Dashboard state verified September 13, 2026

RevenueCat project `c6c99b64` (Our Sweet Family) has a saved RevenueCat Billing web app, `appee814d54a3`, connected to the live Our Sweet Family Stripe account. The default offering preserves the existing Test Store products and includes all four real web products. The account is an Owner; the Apple store connection remains pending.

| Web product | RevenueCat ID | USD price |
| --- | --- | --- |
| `plus_monthly` | `prod649311c930` | $5.99/month |
| `plus_yearly` | `prod76042bae8e` | $59.99/year |
| `premium_monthly` | `prod0697df5325` | $13.99/month |
| `premium_yearly` | `prod5ab6b72cc6` | $139.99/year |

Created canonical lowercase entitlements `plus` (`entl590e90d26f`) and `premium` (`entl40801f22ae`) to match both clients and the server. Each has its two web and two Test Store products attached. Existing uppercase and legacy entitlements were preserved. All four web products are mapped into the existing packages of default offering `ofrng4f89206671`.

Saved plan-change rules for all four web products: tier upgrades and same-tier monthly-to-yearly changes apply immediately; tier downgrades and same-tier yearly-to-monthly changes apply at the next renewal. RevenueCat describes immediate upgrades as refunding unused time from the previous period. No customer subscription was changed. USD is the default currency; automatic tax, free trials, and introductory periods were not configured.

Saved Customer Center configuration: screen title “Manage your family subscription” and purchase history enabled. Existing missing-purchase, plan-change, management and refund flows remain available.

Apple setup saved:

- Registered explicit bundle ID `com.oursweetfamily.app` with In-App Purchase capability.
- Created iOS app **Our Sweet Family**, App Store ID `6811645857`, SKU `our-sweet-family-ios`, primary language English (U.S.).
- Created subscription group **Our Sweet Family Plans**, ID `22382338`, with English (U.S.) display localization.
- Created all four auto-renewable subscriptions with English display names/descriptions and the approved USD prices. Apple calculated other currency prices; store availability remains unset pending the owner's U.S.-only versus worldwide choice.

| Product | Apple subscription ID | Duration | U.S. price | Service level |
| --- | --- | --- | --- | --- |
| `premium_monthly` | `6811646084` | 1 month | $13.99 | 1 |
| `premium_yearly` | `6811647270` | 1 year | $139.99 | 1 |
| `plus_monthly` | `6811647544` | 1 month | $5.99 | 2 |
| `plus_yearly` | `6811648002` | 1 year | $59.99 | 2 |

The subscription drafts are **Prepare for Submission**. No review submission, build upload, Apple Family Sharing activation, or annual installment plan was made. Review screenshots and the app's release metadata are still required.

With explicit owner approval, generated and downloaded the Apple In-App Purchase key named **RevenueCat Our Sweet Family**. Uploading it to RevenueCat was blocked by Chrome's file-upload permission. The RevenueCat App Store form is prepared but unsaved. The key contents have not been printed or added to this repository. Enable **Allow access to file URLs** for the ChatGPT browser extension before retrying the authorized upload.

Apple Business shows the Paid Apps Agreement as **New** and requires the owner to update legal entity information first. Banking/tax and agreement completion remain owner tasks. EU distribution additionally requires the trader declaration.

Stripe lists **Our Sweet Family** in Live mode. The latest account-status page shows **Verified** and **No active tasks for your account**; the previous review and payment/payout pause notices are no longer present. No real payment has been attempted.

With explicit owner consent, installed RevenueCat in Stripe Live mode and linked the Stripe account to RevenueCat. The web billing configuration is saved with USD, app name **Our Sweet Family**, and support contact `contact@oursweetfamily.com`. Checkout branding and end-to-end sandbox validation remain to be checked before release.

With explicit owner approval, generated the V1 secret key **Our Sweet Family Railway server** and installed it as `REVENUECAT_API_KEY` in Railway production. Also set `REVENUECAT_ALLOW_SANDBOX=false`. The existing `REVENUECAT_WEBHOOK_SECRET` is retained, and the RevenueCat webhook destination matches the production `/api/billing/revenuecat` endpoint. No secret key has been printed or committed. The web public SDK key is configured in Vercel's Production environment as `VITE_REVENUECAT_WEB_KEY`.

## Web production release verified September 13, 2026

- Merged PR #18 as `2f64cf3db459111006f69c1ddb413a56fcff3a2c`. Railway successfully deployed the backend before the new website.
- Vercel production deployment `dpl_94cgppAGv4Av2Hfai5mqvswLFNcw` is Ready and aliased to `https://oursweetfamily.com`.
- Completed a Stripe sandbox payment through the actual RevenueCat web SDK using an isolated test identity. RevenueCat returned `plus_monthly` and the expected lowercase `plus` entitlement. No real payment was submitted. Other tier/period purchase, renewal, refund and plan-change scenarios were not all exercised against the external provider.
- Fixed web sandbox key validation (`rcb_sb_` is accepted only with explicit sandbox configuration); all 17 web tests and the production build passed.
- Signed-in production Settings returned all four correct prices. **Refresh plan** successfully reconciled the account through the live server key. Live annual checkout loaded at $59.99 and cancellation returned to the unchanged Free plan.
- RevenueCat's **Send Test Event** returned HTTP 200 from the deployed webhook. Backend health returned `status: ok`; unauthenticated billing status correctly returned HTTP 401. Vercel's recent error-log query returned no logs.
- Native App Store purchases are not released. The Apple key upload retry still failed at the browser file chooser; Apple business requirements, store availability, build and review work remain pending.

After the Apple credential is connected, attach real Apple products to `plus`/`premium` and the default offering. Android additionally requires Play configuration. No real-money checkout has been validated.

## Deployment sequence

1. Configure the store/web integrations and required keys on staging; confirm Clerk IDs match RevenueCat App User IDs.
2. Run `npm ci`, `npm run db:generate --workspace=server`, then apply migrations with `npx prisma migrate deploy` from `server/` against the intended database. The new migration adds three nullable columns and does not delete existing data. Production start already runs migrations.
3. Deploy API before either new client; otherwise clients will receive missing-endpoint errors. The new API requires the server key for real event reconciliation, so configure it before rollout.
4. Build/deploy web with its public key. Build a new native development/TestFlight binary with the platform key (native purchase SDK requires a native build). Do not ship the Test Store key in production.
5. Web is now deployed with the verification limits recorded above. Continue the remaining acceptance checks on isolated test accounts. EAS access and native store validation remain incomplete. App Store Connect draft product setup is saved as described above.

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

All server unit tests and isolated PostgreSQL integration tests pass, including applying all 19 migrations from an empty database and concurrent old/new snapshot writes. Web component/identity tests, web production build, native tests and TypeScript checking pass. After merging the latest production photo/video/homepage fixes into this branch on September 13, all 17 web tests and the production build passed again; the Vercel preview check also passed. An independent review identified duplicate-native-checkout and grace-message issues; both were corrected and covered by tests. Web checkout SDK is lazy loaded; its vendor chunk produces a size warning. No real payment was made.

Reference: RevenueCat recommends fetching the current customer after webhook events: https://www.revenuecat.com/docs/integrations/webhooks
