# Google Calendar setup

The app reads every calendar on one Google account (read-only) — point it at a
**shared family calendar** and everyone who's added to that calendar shows up here.

## 1. Create an OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create
   a new project (e.g. "Family Home Center").
2. **APIs & Services → Library** → enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (fine for personal use).
   - Fill in the app name/support email.
   - Under **Test users**, add the Google account whose calendars you want to read.
     (While the app is in "Testing" mode, only test users can authorize it —
     that's fine, you don't need to publish it.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://<pi-hostname-or-ip>:3000/api/calendar/google/callback`
     (must exactly match `GOOGLE_REDIRECT_URI` in your `.env`).
5. Copy the generated **Client ID** and **Client secret**.

## 2. Configure the app

In `.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://<pi-hostname-or-ip>:3000/api/calendar/google/callback
```

Restart the server after editing `.env`.

## 3. Connect

Open the app → **Settings → Calendar sources → Connect Google Calendar**.
This opens Google's consent screen; sign in with the account you added as a
test user and approve access. Once approved, the tab shows "connected" and you
can close it — events start syncing within 15 minutes (or immediately, via
`POST /api/calendar/sync`).

Tokens are stored in the local SQLite database (`server/data/familyhomecenter.db`),
which never leaves the Pi.
