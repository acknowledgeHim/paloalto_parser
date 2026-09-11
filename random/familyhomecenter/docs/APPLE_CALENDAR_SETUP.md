# Apple / iCloud Calendar setup

The app connects to iCloud's CalDAV server using an **app-specific password**,
so your real Apple ID password is never stored.

## 1. Generate an app-specific password

1. Sign in at [appleid.apple.com](https://appleid.apple.com/).
2. Under **Sign-In and Security → App-Specific Passwords**, click **Generate an
   App-Specific Password**, name it "Family Home Center", and copy it.
   (This requires two-factor authentication to be enabled on the Apple ID.)

## 2. Configure the app

In `.env`:

```
APPLE_ID=you@icloud.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Restart the server. There's no interactive "connect" step for Apple — as soon
as those two variables are set, the background sync job pulls events from
**every calendar on that iCloud account** (so use/share a family calendar in
the Calendar app on iOS/macOS the same way you would with Google).

## Notes

- iCloud shared calendars that other family members have shared *to* this
  account also come through automatically.
- If sync isn't picking up a calendar, check the server logs
  (`sudo journalctl -u familyhomecenter -f`) for `[appleCalendar]` warnings.
