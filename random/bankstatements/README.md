# Bank Statement Sync

A bookkeeping tool for a business: iOS/Android apps for linking bank/credit
union accounts, a Django backend that syncs statements automatically, and a
manual-upload path for check images.

```
┌─────────────────┐        ┌──────────────────────┐        ┌─────────┐
│  Expo app        │  JWT   │  Django API           │        │ Plaid   │
│  (iOS/Android)    │──────▶│  (accounts/banking/    │◀──────▶│         │
│                    │        │   documents/api)       │        │         │
│  Plaid Link webview│◀──────▶│  Celery worker         │        └─────────┘
└─────────────────┘  Plaid  └──────────────────────┘
                      SDK              │
                                       ▼
                              MySQL + S3/media
                          (statements, encrypted Plaid
                           tokens, uploaded check images)
```

## How bank data actually gets in

- **Statements & transactions**: the app opens **Plaid Link**, which shows the
  bank's *own* login screen inside a secure webview. Neither the app nor the
  Django backend ever sees a bank username or password — the backend receives
  a Plaid `access_token` (a scoped, revocable credential Plaid issues), stores
  it encrypted, and a Celery task uses it to pull new statements on a
  schedule and via Plaid webhooks.
- **Check images**: no aggregator (Plaid included) offers these as a product.
  Someone with portal access logs into the bank/credit union themselves, in
  their own browser, downloads the check image/PDF, and uploads it through
  the app (`app/account/[id]/upload.tsx` → `POST /api/check-images/`). This is
  deliberate — see "Why not automate check images" below.

## Repo layout

- `backend/` — Django + DRF + Celery. See `backend/README.md` to run it.
- `mobile/` — Expo/React Native (TypeScript). See `mobile/README.md` to run it.

## Getting a working end-to-end demo

1. `cd backend && cp .env.example .env`, fill in a Plaid **sandbox**
   client ID/secret (free, https://dashboard.plaid.com), then
   `docker-compose up --build` — migrations and (if you set the
   `DJANGO_SUPERUSER_*` vars) an admin account are created automatically.
   Create one `Organization` + `Membership` row via `/admin/`.
2. `cd mobile && npm install && npx expo prebuild && npx expo run:ios`
   (or `run:android`), pointed at the backend via `EXPO_PUBLIC_API_BASE_URL`.
3. Log in, tap **Link a bank**, and use a Plaid Sandbox test institution
   (fake login `user_good` / `pass_good`) — no real bank needed to verify the
   whole pipeline works before ever touching production credentials.
4. Once linked, `celery-worker` pulls sandbox statements automatically
   (`celery-beat` is what schedules that job); check the account's detail screen.
5. Try **Upload a check image** with any test file to see the manual path.

## Why not automate check images

Doing that would mean the backend capturing real bank usernames/passwords
(even transiently, per-session) and driving automated logins against dozens
of different bank/credit-union websites — most of which explicitly prohibit
this in their ToS, actively fight it with bot detection/CAPTCHAs/MFA, and
will flag or lock accounts it's used against. Not persisting the password to
disk doesn't change that the mechanism itself — an app capturing and
replaying a bank login on the user's behalf — is functionally the same thing
banking-credential-phishing tools do. It's also not a one-time build: any UI
or MFA change on the bank's end breaks it, forever, per institution.

If a specific bank/credit union you use turns out to expose an official
document or treasury-management API for check images (some larger banks do,
via direct business enrollment), that's addable later as one deliberate
`banking/<bank>_client.py` adapter for that institution — a real integration
project, not a generic scraper.

## What you'll need to supply

- A [Plaid](https://dashboard.plaid.com) developer account (sandbox is free;
  production access requires Plaid's approval process)
- Apple Developer Program + Google Play Console accounts, once you're ready
  to move past local dev-client testing
- MySQL, Redis, and S3-compatible storage for a real deployment (the repo
  ships a `docker-compose.yml` for local dev only)
