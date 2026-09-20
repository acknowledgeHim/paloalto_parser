# Settings login

By default, **nothing** in this app requires a login — that's deliberate for a home kiosk kids and
guests use freely. Setting `ADMIN_PASSWORD` adds one password gate around just the **Settings**
page and the configuration actions it exposes:

- Adding, editing, or removing family members
- Connecting a Google Calendar or Spotify account
- Changing the idle-timeout / slideshow-interval
- Setting Prize Bank rewards (how many stars/how much money a chore pays) and managing the
  prize catalog — the chores themselves stay open to add/complete either way, just the payout
  amounts are gated

Everything else — checking off chores, adding to-dos, browsing/adding calendar events, controlling
music playback and zone grouping, browsing photos, and paging on the intercom — stays open to
everyone, logged in or not.

## Enable it

In `.env`:

```
ADMIN_PASSWORD=something-only-parents-know
```

Restart the server. Opening **Settings** now shows a password prompt instead of the settings
content. Enter the password once per browser/device — it stays logged in for 30 days (there's a
**Log out** button on the Settings page if you want to lock it again sooner).

## How it works

- The password itself is only ever compared server-side (constant-time comparison, so a wrong guess
  can't be timed to learn how many characters matched) — it's never sent to the browser.
- A successful login gets a random session token in an `httpOnly` cookie, so client-side JavaScript
  (and anyone poking at browser dev tools) can't read or forge it.
- This is **one shared password for the household**, not per-person accounts — appropriate for a
  home appliance, not meant to withstand a targeted attack. Don't reuse a password you use anywhere
  security-sensitive.

## Turning it off again

Remove (or blank out) `ADMIN_PASSWORD` in `.env` and restart — Settings goes back to fully open.
