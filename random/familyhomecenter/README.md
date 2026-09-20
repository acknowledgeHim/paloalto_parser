# Family Home Center

A touchscreen family dashboard built for a Raspberry Pi 5, covering:

- 📅 **Shared calendar** — merges a local calendar, Google Calendar, and
  Apple/iCloud Calendar into one view. Add local-only events with no cloud
  account needed, or connect Google/Apple to pull in the family calendars you
  already use. A local event can be tagged "for" a specific family member, or
  left as a whole-family event.
- ✅ **Chores & to-dos** — parents can add recurring chores (daily, weekdays,
  weekends) and assign them; anyone can add a one-off to-do and assign it to
  any family member, or leave it unassigned for anyone to **claim** with one
  tap. The Chores & Tasks page groups everything into a column per person
  (plus an Unassigned column); the **Family Board** page shows the same
  chores/to-dos alongside each person's calendar side by side, for a
  glance-and-go "what's everyone got going on" view.
- 🌤️ **Weather** — current conditions + 5-day forecast via Open-Meteo (no API
  key required).
- 🖼️ **Photo slideshow / screensaver** — after a configurable idle period, the
  dashboard fades into a fullscreen slideshow of family photos from a local
  folder or an SMB network share. Tap anywhere to return to the dashboard.
  There's also a **Photos** page for browsing the same library on demand — a
  thumbnail grid, tap-to-view-fullscreen with prev/next, and a button to kick
  off the same fullscreen slideshow manually.
- 👪 **No-login profile switcher** — family members pick their name from a
  list to attribute what they add/complete. Everyday use (chores, calendar,
  music, photos, intercom) never requires a login. An optional password
  (`ADMIN_PASSWORD`) can gate just the **Settings** page and its
  configuration actions (family roster, calendar/Spotify connect, timing) —
  see docs/SETTINGS_LOGIN.md.
- 🎵 **Multi-zone music** — a HiFiBerry DAC8x drives 4 independently
  hardwired stereo zones. Each zone plays your own local library (search,
  queue, play) or Spotify (cast from anyone's phone via Spotify Connect, or
  control in-dashboard with a connected Premium account), and zones can be
  grouped to play the same thing or left independent — picked per listen.
- 🎙️ **Whole-home intercom** — press-and-hold push-to-talk paging into one,
  several, or all zones at once, from the touchscreen or from a phone (the
  dashboard installs as a home-screen app — see docs/INTERCOM_SETUP.md).
  One-way paging: the DAC8x's zones are output-only, so this is an
  announcement system, not a two-way call — see that doc for the scope note.
- 🍽️ **Meals & recipes** — plan breakfast/lunch/dinner per day, optionally
  assigned to a specific family member (or left as a whole-family meal).
  A meal can be typed in freehand with its own ingredient list, built from
  one or more recipes (which add their ingredients automatically), or both.
  The **Recipes** tab holds your own recipe library and can search/import
  from TheMealDB's free public API (no account needed); each recipe has a
  serving count you can scale up/down (ingredient quantities recalculate).
  A **Converter** tab handles metric ⇄ US kitchen unit conversions (volume,
  weight, oven temperature).
- 🏆 **Prize Bank** — any chore/to-do can optionally pay out stars or money on
  completion; a kid can earn it by doing an assigned chore or claiming an
  unassigned one. Prizes cost either a number of banked stars or doing a
  specific task a set number of times, and are redeemed from the **Prize
  Bank** page once eligible (checked server-side against the real balance —
  not just a client-side gate). The Dashboard shows each person a
  completed-today progress bar for their reward chores. Reward amounts and
  the prize catalog live in **Settings** behind the same optional
  `ADMIN_PASSWORD` gate as the rest of the app's configuration — see
  docs/SETTINGS_LOGIN.md — so kids can't see or change payout rates once
  it's set.

## Project layout

```
familyhomecenter/
├── server/    Express + TypeScript API, SQLite storage, calendar/weather/photo/music sync,
│              intercom WebSocket relay
├── client/    React + TypeScript touch UI (Vite), installable as a PWA
├── docs/      Setup guides (Pi kiosk mode, Google/Apple calendar, photos/SMB, music/DAC8x,
│              Spotify, intercom/HTTPS)
└── scripts/   systemd units + install helpers for the Pi (app, MPD zones, librespot zones,
               ALSA zone mapping)
```

## Quick start (development, on any machine)

Requires **Node.js 20 LTS** (npm comes bundled with it) — install from
[nodejs.org](https://nodejs.org/) or via [nvm](https://github.com/nvm-sh/nvm);
on Debian/Ubuntu you can also use NodeSource, as in
[docs/PI_SETUP.md](docs/PI_SETUP.md#2-install-prerequisites).

```bash
cp .env.example .env      # edit at least WEATHER_LAT/LON if you're not near Palo Alto
cd server && npm install && npm run dev &     # http://localhost:3000 (API)
cd client && npm install && npm run dev        # http://localhost:5173 (UI, proxies /api)
```

Open http://localhost:5173. Go to **Settings** and add your family members
first — the chore/to-do assignee list and profile switcher are empty until you
do.

## Deploying to a Raspberry Pi 5 kiosk

See **[docs/PI_SETUP.md](docs/PI_SETUP.md)** for the full walkthrough: OS
flashing, systemd service, Chromium kiosk autostart, and disabling screen
blanking. In production, `npm run build` in both `server/` and `client/` and
run `node server/dist/index.js` — it serves the built UI itself, so only one
process/port (3000) is needed on the Pi.

Optional integrations, each with its own guide:
- [docs/GOOGLE_CALENDAR_SETUP.md](docs/GOOGLE_CALENDAR_SETUP.md)
- [docs/APPLE_CALENDAR_SETUP.md](docs/APPLE_CALENDAR_SETUP.md)
- [docs/PHOTOS_SETUP.md](docs/PHOTOS_SETUP.md) (local folder or SMB share)
- [docs/MUSIC_SETUP.md](docs/MUSIC_SETUP.md) (HiFiBerry DAC8x, ALSA zone mapping, MPD + librespot)
- [docs/SPOTIFY_SETUP.md](docs/SPOTIFY_SETUP.md) (in-dashboard playback control, needs Premium)
- [docs/INTERCOM_SETUP.md](docs/INTERCOM_SETUP.md) (HTTPS via Caddy — required for phone
  microphone access — and installing the dashboard as a phone app)
- [docs/SETTINGS_LOGIN.md](docs/SETTINGS_LOGIN.md) (optional password on just the Settings page)
- [docs/TOUCHSCREEN_SETUP.md](docs/TOUCHSCREEN_SETUP.md) (picking a touch-capable monitor, and
  wiring it to the Pi — including over Ethernet/Cat6 if there's real distance between them)
- [docs/DUAL_TOUCHSCREEN_SETUP.md](docs/DUAL_TOUCHSCREEN_SETUP.md) (drive two touchscreens with
  different content from one Pi 5's two HDMI outputs)

## Data & privacy

Everything lives in one SQLite file (`server/data/familyhomecenter.db`) on the
Pi itself — family members, tasks, local events, a synced-events cache, zone/
group config, and (if connected) Google and Spotify OAuth tokens. Nothing is
sent anywhere except the calendar/weather/Spotify APIs you explicitly
configure, and Spotify's own servers for whatever a family member casts from
their own phone.

## Tech stack

Node.js + Express + better-sqlite3 on the backend; React + TypeScript + Vite
on the frontend; `googleapis` for Google Calendar, `tsdav` + `ical.js` for
CalDAV/iCloud, Open-Meteo for weather, `sharp` for photo thumbnailing, a
hand-rolled MPD protocol client + librespot for multi-zone music, and
`ffmpeg`/ALSA (`aplay`) for the intercom's audio relay.
