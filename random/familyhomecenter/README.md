# Family Home Center

A touchscreen family dashboard built for a Raspberry Pi 5, covering:

- 📅 **Shared calendar** — merges a local calendar, Google Calendar, and
  Apple/iCloud Calendar into one view. Add local-only events with no cloud
  account needed, or connect Google/Apple to pull in the family calendars you
  already use.
- ✅ **Chores & to-dos** — parents can add recurring chores (daily, weekdays,
  weekends) and assign them; anyone can add a one-off to-do and assign it to
  any family member (or leave it unassigned). Tap to check things off.
- 🌤️ **Weather** — current conditions + 5-day forecast via Open-Meteo (no API
  key required).
- 🖼️ **Photo slideshow / screensaver** — after a configurable idle period, the
  dashboard fades into a fullscreen slideshow of family photos from a local
  folder or an SMB network share. Tap anywhere to return to the dashboard.
- 👪 **No-login profile switcher** — family members pick their name from a
  list to attribute what they add/complete. This is a home appliance, not a
  bank — there are no passwords.
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
