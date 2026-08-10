# Deploying Our Sweet Family

Production is **not** auto-deployed on push — each surface is triggered manually.
The production branch is **`claude/family-photo-sharing-app-RfJto`**.

---

## 1. Web client → Vercel

The Vercel project root is **`client/`** (see `client/vercel.json`).

> ⚠️ **Account note:** oursweetfamily.com lives under a **personal Vercel account**, not
> the "IntelliShift" team. If `vercel whoami` shows an IntelliShift scope, log into the
> account that owns the project first.

### CLI

```bash
vercel login                      # use the account that owns oursweetfamily.com
cd client
vercel link                       # select the "Our Sweet Family" project (first time only)
vercel --prod                     # deploy to production
```

After it reports `READY`, hard-refresh https://oursweetfamily.com to confirm.

### Dashboard (alternative)

Vercel → the Our Sweet Family project → **Deployments → Redeploy** (or trigger a
new build from the production branch).

---

## 2. API server → Railway

The Express/Prisma API in `server/` runs on Railway.

```bash
# from repo root, with the Railway CLI linked to the project:
railway up                        # deploy the server
railway run npx prisma migrate deploy   # apply any pending migrations
```

Verify: `GET https://<api-host>/api/health` returns `{ "status": "ok" }`.

---

## 3. Mobile app → Expo

The React Native app is in `mobile/`.

```bash
cd mobile

# Local run (simulator / device with the dev client):
npx expo run:ios          # or: npx expo run:android

# Store builds via EAS:
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios         # submit the build to the store
```

Fonts (Poppins, Dancing Script) and the theme load at the JS layer, so a JS-only
change can also ship as an **EAS Update** (`eas update`) without a native rebuild.

---

## Notes

- Merging a PR into the production branch does **not** trigger a deploy — run the
  steps above.
- The logo everywhere is the original `client/public/logo.svg`, used unchanged.
