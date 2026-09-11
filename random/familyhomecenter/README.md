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

## Project layout

```
familyhomecenter/
├── server/    Express + TypeScript API, SQLite storage, calendar/weather/photo sync
├── client/    React + TypeScript touch UI (Vite)
├── docs/      Setup guides (Pi kiosk mode, Google/Apple calendar, photos/SMB)
└── scripts/   systemd unit + install helper for the Pi
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

## Data & privacy

Everything lives in one SQLite file (`server/data/familyhomecenter.db`) on the
Pi itself — family members, tasks, local events, a synced-events cache, and
(if connected) Google OAuth tokens. Nothing is sent anywhere except the
calendar/weather APIs you explicitly configure.

## Tech stack

Node.js + Express + better-sqlite3 on the backend; React + TypeScript + Vite
on the frontend; `googleapis` for Google Calendar, `tsdav` + `ical.js` for
CalDAV/iCloud, Open-Meteo for weather, `sharp` for photo thumbnailing.
