# Deploying Our Sweet Family

Production is **not** auto-deployed on push — each surface is triggered manually.
The production branch is **`claude/family-photo-sharing-app-RfJto`**.

---

## 1. Web client → Vercel

Vercel project: **`our-sweet-family-client`** (under the personal
**`patrickquiery-9100's projects`** account — *not* the IntelliShift team).
Its **Root Directory** is set to `client/` in the Vercel project settings.

> ⚠️ **Account note:** if `vercel whoami` / `vercel teams ls` shows an IntelliShift
> scope, the OSF project won't be visible — `vercel login` to the personal account first.

### CLI

The repo is already linked (`.vercel/` at the **repo root**, git-ignored). Deploy
**from the repo root** — Vercel applies the `client/` Root Directory itself, so do
**not** `cd client` (that produces a `client/client does not exist` error).

```bash
cd ~/Developer/Our-Sweet-Family        # repo ROOT, not client/
vercel --prod --yes --archive=tgz      # deploy to production
```

- **`--archive=tgz` is required.** Without it the upload includes the `mobile/` tree
  and exceeds Vercel's 15,000-file limit (`missing_archive` error). The tgz flag
  bundles + compresses the upload instead.
- First-time / re-link: `vercel link --yes --project our-sweet-family-client` from the repo root.

After it reports `READY` and `Aliased: https://oursweetfamily.com`, hard-refresh the
site to confirm.

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

## 3. Mobile app → Expo (EAS)

The React Native (Expo) app is in `mobile/`. Build profiles are in `mobile/eas.json`.

> ⚠️ **Auth-gated — must be run by you.** `eas login` is interactive, and store
> builds/submits need Apple Developer (iOS, + 2FA) and Google Play (service-account
> key) credentials. As of first setup the app is **not yet linked** to an EAS project
> (`app.json` `owner` / `extra.eas.projectId` are empty until `eas init`).

**One-time setup:**
```bash
cd mobile
eas login                 # your Expo account (interactive)
eas init                  # links the app -> writes owner + extra.eas.projectId into app.json
```

**Local run** (simulator / device with the dev client — no account needed):
```bash
npx expo run:ios          # or: npx expo run:android
```

**Store builds (EAS cloud):**
```bash
cd mobile
eas build --platform ios --profile production        # Apple Developer creds (EAS can manage them)
eas build --platform android --profile production    # EAS generates/holds the keystore
eas submit --platform ios                            # -> App Store Connect (your Apple auth)
eas submit --platform android                        # -> Google Play (service-account key)
```

**OTA JS update** (after ≥1 production build exists — ships JS/theme/font changes
with no native rebuild, since fonts + theme load at the JS layer):
```bash
eas update --branch production -m "message"
```

---

## Notes

- Merging a PR into the production branch does **not** trigger a deploy — run the
  steps above.
- Brand logos live in `client/public/brand/` (6 lockups × original / sunrise / white,
  plus a mark-only and a tagline-free lockup). The app uses the **sunrise** variants via
  the `Logo` / `LogoMark` components; the mobile sign-in uses the compact lockup PNG.
