# Logging in

By default, **nothing** in this app requires a login — that's deliberate for a home kiosk kids and
guests use freely. Anyone can optionally set their own password, self-service, from the 🔑 icon
next to their name in the profile switcher (top of every page):

- **A parent's password** additionally gates the **Settings** page and the configuration actions
  it exposes (see below) — as soon as any parent has one set, Settings requires being logged in as
  a parent.
- **A kid's password** (fully optional) just protects switching into *their own* profile — picking
  their name then requires their password, so a sibling can't act as them. It never grants Settings
  access.

Configuration actions gated once a parent has a password:

- Adding, editing, or removing family members
- Connecting a Google Calendar or Spotify account
- Changing the idle-timeout / slideshow-interval
- Setting Prize Bank rewards (how many stars/how much money a chore pays) and managing the
  prize catalog — the chores themselves stay open to add/complete either way, just the payout
  amounts are gated
- Uploading a custom completion-sound MP3

Everything else — checking off chores, adding to-dos, browsing/adding calendar events, controlling
music playback and zone grouping, browsing photos, and paging on the intercom — stays open to
everyone, logged in or not.

## Setting your own password

Open the profile switcher (top of any page) and tap the 🔑 next to your name. The first time, you
can set any password immediately — no approval needed (a family roster is a trusted starting
point, same spirit as the rest of this app). Changing or removing it later requires the current
one.

Picking a name that has no password set works exactly like before: tap it, you're switched in,
nothing to type.

## Logging in as a parent

Tap a parent's name in the profile switcher; if they have a password set, it prompts for it before
switching. A successful login both picks that profile *and* unlocks Settings for as long as that
login lasts (up to 30 days, or until it auto-clears — see below).

## Auto-clear on idle

Whenever the dashboard goes idle (same trigger as the photo-slideshow screensaver — see
`idle_timeout_seconds` in Settings), whoever was picked is cleared back to "Who's this?" and any
parent login is logged out. Coming back from the screensaver always starts from a clean slate,
so a parent's unlocked Settings session doesn't linger after they've walked away.

## Recovering access if every parent forgets their password

Set the legacy household recovery password in `.env`:

```
ADMIN_PASSWORD=something-only-parents-know
```

Restart the server. Now Settings' login screen also accepts this one password (shared by the whole
household, not tied to a specific person) as a fallback — enter it there directly, without picking
a profile first. Once in, set a fresh password for whichever parent needs one, from their own 🔑
icon.

## How it works

- Passwords are hashed (scrypt with a random salt per person) before being stored — never in
  plain text, never sent back to the browser.
- A successful login gets a random session token in an `httpOnly` cookie, so client-side JavaScript
  (and anyone poking at browser dev tools) can't read or forge it.
- This is a home appliance's login, not meant to withstand a targeted attack. Don't reuse a
  password you use anywhere security-sensitive.

## Turning it off again

Remove a parent's password (their own 🔑 icon, or have another parent's Settings session do it via
editing that family member) and unset `ADMIN_PASSWORD` in `.env` — once no parent has one and the
recovery password is blank, Settings goes back to fully open. Kids' own optional passwords are
unaffected either way — they only ever protect switching into that person's profile.
