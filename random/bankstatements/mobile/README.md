# Mobile — Expo (iOS + Android)

React Native app (TypeScript, expo-router) for linking bank accounts via
Plaid Link and reviewing synced statements / uploading check images.

## Why "dev client" and not Expo Go

`react-native-plaid-link-sdk` ships a native module, so plain Expo Go can't
run this app. You need a custom dev client build once, then `expo start
--dev-client` works like Expo Go from there on.

## First-time setup

```bash
cd mobile
npm install
npx expo prebuild            # generates ios/ and android/ native projects
npx expo run:ios             # or: npx expo run:android
```

Point the app at your local backend:

```bash
# .env (create this file) — use your machine's LAN IP for a physical device,
# not localhost, unless you're on a simulator/emulator.
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8000/api
```

## Screens

- `app/login.tsx` — JWT login against the Django backend
- `app/select-organization.tsx` — shown after login when the user belongs to
  more than one organization (`GET /api/organizations/`); skipped
  automatically when there's only one
- `app/index.tsx` — linked accounts list, entry point to link a new bank
- `app/link-bank.tsx` — Plaid Link flow. **Bank login happens inside Plaid's
  own webview here** — this screen and the backend it talks to never see a
  bank username/password.
- `app/account/[id].tsx` — statements (auto-synced) + check images (manually
  uploaded) for one account
- `app/account/[id]/upload.tsx` — manual check-image upload: pick a file the
  user already downloaded from their bank's portal, send it to the backend

## Before submitting to app stores

- Apple Developer Program ($99/yr) + App Store Connect record
- Google Play Console ($25 one-time) + a signed release build (`eas build`)
- Fill in real bundle identifiers in `app.json` (currently
  `com.yourcompany.bankstatements` placeholders)
- Swap `EXPO_PUBLIC_API_BASE_URL` to your production backend's HTTPS URL
