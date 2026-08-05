# Deep-link association files

These files let a tapped invite link (`https://oursweetfamily.com/accept-invite?token=…`)
open the native app instead of the website (iOS Universal Links / Android App Links).
They must be served from `https://oursweetfamily.com/.well-known/…` over HTTPS.

## Before they work — fill in the placeholders

1. **`apple-app-site-association`** — replace `REPLACE_WITH_APPLE_TEAM_ID` with the
   Apple Developer **Team ID** (found in the Apple Developer portal, Membership tab).
   Final `appID` looks like `A1B2C3D4E5.com.oursweetfamily.app`.
   - Served with `Content-Type: application/json` and **no** file extension.
2. **`assetlinks.json`** — replace the fingerprint with the **SHA-256** of the Android
   app-signing certificate: `eas credentials` (or Play Console → App integrity) prints it.

## Vercel serving note

`apple-app-site-association` has no extension. Add this to `vercel.json` so Vercel serves
it as JSON:

```json
{
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    }
  ]
}
```

## App side

`mobile/app.json` already declares the matching `ios.associatedDomains` and
`android.intentFilters`. They take effect on the next `expo prebuild` / EAS build — a
custom scheme link (`oursweetfamily://accept-invite?token=…`) already routes today.
