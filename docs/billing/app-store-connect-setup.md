# App Store Connect — In-App Purchase Setup Checklist

Goal: create the real StoreKit subscriptions so production purchases run against Apple
instead of the RevenueCat Test Store. **No app code changes are needed** — this only lines
Apple's product identifiers up with what the app + RevenueCat already expect.

> The identifiers below are **exact and case-sensitive**. Apple product IDs are permanent
> once created (you cannot rename or reuse them), so type them carefully.

## What the app already expects

| Thing | Value |
|---|---|
| Bundle ID | `com.oursweetfamily.app` |
| Entitlements (RevenueCat) | `plus`, `premium` |
| Product IDs | `plus_monthly`, `plus_yearly`, `premium_monthly`, `premium_yearly` |
| Prices | Plus **$5.99/mo · $59.99/yr** · Premium **$13.99/mo · $139.99/yr** |

---

## 0. Account prerequisites (one-time, gate everything else)

- [ ] Apple Developer Program membership is **active** ($99/yr, paid).
- [ ] An **App record** exists in App Store Connect for bundle `com.oursweetfamily.app`
      (App Store Connect → Apps → **+** → New App, if not already created).
- [ ] **Paid Applications Agreement** is signed: App Store Connect → **Business** (or
      Agreements, Tax, and Banking) → accept the Paid Apps agreement.
- [ ] **Banking** details added (a bank account for payouts).
- [ ] **Tax** forms completed (at minimum U.S. tax info; add others as you sell there).

> ⚠️ Until the Paid Apps agreement + banking + tax are **all** in the "Active" state,
> your subscriptions will not be purchasable and often won't even load in sandbox.

---

## 1. Create the subscription group

All four products go in **one** group so a user can hold only one at a time (Apple then
handles upgrade/downgrade/crossgrade and proration between them automatically).

- [ ] App Store Connect → your app → **Monetization → Subscriptions** → **Create** a
      Subscription Group.
- [ ] Group Reference Name: `Our Sweet Family` (internal only — not shown to users).

---

## 2. Create the four auto-renewable subscriptions

For **each** product below: **Subscriptions → (your group) → Create**, then fill in the
Product ID, Reference Name, Duration, and Price exactly as shown.

- [ ] **Plus Monthly** — Product ID `plus_monthly` · Duration **1 Month** · Price **$5.99**
- [ ] **Plus Yearly** — Product ID `plus_yearly` · Duration **1 Year** · Price **$59.99**
- [ ] **Premium Monthly** — Product ID `premium_monthly` · Duration **1 Month** · Price **$13.99**
- [ ] **Premium Yearly** — Product ID `premium_yearly` · Duration **1 Year** · Price **$139.99**

(Reference Name is internal; a clear "Plus Monthly" etc. is fine. The **Product ID must match
the table exactly** — that is the only field the app keys on.)

---

## 3. Set the group ranking (upgrade/downgrade levels)

Within the group, rank higher-value tiers **above** lower ones so Apple treats a move up as an
immediate upgrade and a move down as a deferred downgrade:

- [ ] Rank order (top = highest): `premium_yearly`, `premium_monthly`, then `plus_yearly`,
      `plus_monthly`.

> Monthly vs. yearly of the *same* tier is a duration crossgrade; keeping Premium above Plus
> is the part that matters for correct upgrade behavior.

---

## 4. Fill each product's required metadata

Apple won't let a subscription go "Ready to Submit" until each has:

- [ ] **Localized display name** + description (English at minimum). Suggested:
      - Plus Monthly / Yearly → "Plus" — *"200 GB video, HD photos, monthly reels, milestones, export."*
      - Premium Monthly / Yearly → "Premium" — *"Everything in Plus, unlimited video, every reel type, AI face tagging, private memories."*
- [ ] **Subscription duration** (set in step 2) and **price** (set in step 2; review the
      per-territory price table Apple generates).
- [ ] **App Store promotion image** (1024×1024) — optional unless you promote the sub on the
      store page; skip for launch if not promoting.
- [ ] **Review information** → a screenshot of the paywall (take one from the sim: the
      "Unlock every memory" screen) and a note (see step 8).

---

## 5. Generate the StoreKit shared secret (for RevenueCat)

RevenueCat validates Apple receipts with your app-specific shared secret:

- [ ] App Store Connect → your app → **Monetization → In-App Purchases** (or the
      Subscriptions page) → **App-Specific Shared Secret** → generate/copy it.
- [ ] In **RevenueCat → Project → Apps → (your iOS app)** → paste the **App-Specific Shared
      Secret**, and confirm the **Bundle ID** is `com.oursweetfamily.app`.

---

## 6. Link products → RevenueCat → entitlements

This is what actually makes a purchase unlock the tier. (RevenueCat dashboard, not Apple.)

- [ ] **Product catalog → Products**: import/create the 4 App Store products
      (`plus_monthly`, `plus_yearly`, `premium_monthly`, `premium_yearly`).
- [ ] **Entitlements**: attach `plus_monthly` + `plus_yearly` to the **`plus`** entitlement;
      attach `premium_monthly` + `premium_yearly` to the **`premium`** entitlement.
      *(This is the step whose absence would show "premium in the DB but Free in the app" —
      the exact thing we watched for during end-to-end testing.)*
- [ ] **Offering**: in your current offering, put the monthly products in the **Monthly
      ($rc_monthly)** package and the yearly products in the **Annual ($rc_annual)** package.
      The paywall's Monthly/Annual toggle reads the RevenueCat package type, so using the
      standard package slots keeps the toggle working.

---

## 7. Swap the app's RevenueCat key to the real Apple key

Today the app uses the **Test Store** key (`test_…`). For real StoreKit:

- [ ] RevenueCat → **API keys** → copy the **App Store** public SDK key (starts with `appl_`).
- [ ] Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (or `EXPO_PUBLIC_REVENUECAT_KEY`) to that `appl_`
      key in `mobile/.env` **and** in your EAS build env (EAS → project → environment
      variables), then rebuild. *(This is a config value, not a secret — safe in the client.)*

---

## 8. Sandbox test with real StoreKit

- [ ] App Store Connect → **Users and Access → Sandbox → Testers** → create a sandbox Apple ID
      (use an email you control that is **not** already an Apple ID).
- [ ] On the device/simulator, sign out of the App Store, install the build using the `appl_`
      key, open the paywall, and purchase — sign in with the **sandbox** tester when prompted.
- [ ] Confirm the same end-to-end chain we verified with the Test Store: purchase →
      `INITIAL_PURCHASE` webhook (200) → `plan:premium` on the User row → app shows Premium.
      Unlike the Test Store, the entitlement should reflect **live** (no relaunch needed).

Review note to paste into each product's **Review Information** and the app's review notes:

> "Auto-renewing subscription unlocking additional storage and features (Plus/Premium tiers).
>  Purchases are validated via RevenueCat. Sandbox tester credentials provided for review."

---

## 9. Submit

- [ ] Each subscription shows **"Ready to Submit"**.
- [ ] Submit the subscriptions **with your next app version** (Apple reviews IAPs alongside a
      build for the first submission).
- [ ] After approval, do one **production** purchase (you can refund yourself) to confirm the
      live path, then you're done.

---

### Quick reference — the 4 products

| Product ID | Tier | Duration | Price | RevenueCat entitlement |
|---|---|---|---|---|
| `plus_monthly` | Plus | 1 month | $5.99 | `plus` |
| `plus_yearly` | Plus | 1 year | $59.99 | `plus` |
| `premium_monthly` | Premium | 1 month | $13.99 | `premium` |
| `premium_yearly` | Premium | 1 year | $139.99 | `premium` |
