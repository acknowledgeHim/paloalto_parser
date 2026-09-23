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
one — unless a parent is already logged in, in which case they can reset *anyone's* password
(including another parent's) from that person's 🔑 icon without knowing the old one. See
"Recovering access" below for what to do when no parent is logged in at all.

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

**If another parent remembers theirs:** have them log in as themselves, then tap the forgetful
parent's 🔑 icon in the profile switcher and set a new password — no need to know the old one (see
above).

**If `ADMIN_PASSWORD` is set in `.env`:** Settings' login screen also accepts that one password
(shared by the whole household, not tied to a specific person) as a fallback — enter it there
directly, without picking a profile first. Once in, tap the locked-out parent's 🔑 icon and set a
fresh password for them.

```
ADMIN_PASSWORD=something-only-parents-know
```

(Restart the server after adding/changing this in `.env`.)

**If neither of those applies** — no other parent, and no `ADMIN_PASSWORD` configured (or that's
forgotten too) — there's a command-line escape hatch that clears a password directly in the
database, for whoever has shell/SSH access to the machine running the server (the Pi, typically —
same trust level as editing `.env` or the database file by hand). From the `server/` directory:

```
npm run reset-password -- <name or id>
```

Run it with no name to list everyone and whether they have a password set:

```
npm run reset-password
```

This clears that person's password (and logs out any session currently signed in as them) — it
doesn't set a new one. Afterwards, open the app, tap their name in the profile switcher (no
password needed now), then their 🔑 icon to set a new password. The script talks directly to
`server/data/familyhomecenter.db`; it doesn't need the server to be running, but do run it on the
machine that actually hosts that database file.

## How it works

- Passwords are hashed (scrypt with a random salt per person) before being stored — never in
  plain text, never sent back to the browser.
- A successful login gets a random session token in an `httpOnly` cookie, so client-side JavaScript
  (and anyone poking at browser dev tools) can't read or forge it.
- This is a home appliance's login, not meant to withstand a targeted attack. Don't reuse a
  password you use anywhere security-sensitive.

## Turning it off again

Remove every parent's password (their own 🔑 icon, leaving the new-password field blank — or
another logged-in parent's 🔑 tap on their behalf) and unset `ADMIN_PASSWORD` in `.env` — once no
parent has one and the recovery password is blank, Settings goes back to fully open. Kids' own
optional passwords are unaffected either way — they only ever protect switching into that person's
profile.

## Bank privacy

Each kid's Bank page (`/person/:id/bank`) is private to that kid and any parent once *that specific
kid* has their own password set (or a parent logs in) — everyone else is turned away, same
self-or-parent rule as Settings. A kid who's never set a password keeps their balance visible to
the household, same open default as everything else, even after a parent sets up their own
password elsewhere. Adding or removing a manual transaction by hand is always parent-only,
regardless of whether any password exists — kids can still track savings goals and transfer their
own earned Prize Bank money themselves.
