# Privacy: what leaves the Pi

**Short version:** out of the box, with **Settings → Privacy → Show the weather** off, the app sends
**nothing** off your network. Photos, movies, documents, albums, faces, chores, meals, contacts,
Prize Bank, Internet controls, and settings all live in `server/data/` on the Pi. Data only goes
out for outside services *you* choose to set up, listed below with exactly what each one sends.

## How this was checked

Every outgoing connection was audited in the code, every installed package was scanned for
telemetry, and the whole server was run with a guard underneath it (an `LD_PRELOAD` shim — below
JavaScript *and* compiled libraries) that logs and blocks every internet connection and hostname
lookup, while every page was opened, a contact with a street address was saved, face recognition
scanned photos, and background jobs ran for a minute:

| Setup | Internet attempts |
|---|---|
| Default (weather on) | 2 — `api.open-meteo.com` (weather, area rounded to ~7 miles) |
| Weather switched off | **0** |

This also caught one real problem, now fixed: the face-recognition library (ONNX Runtime) tried
to send Microsoft usage telemetry; it's switched off (`ORT_DISABLE_TELEMETRY`), verified 10
attempts → 0.

## On by default

| What | Sends | To | Turn off |
|---|---|---|---|
| Weather | Your area (lat/lon rounded to ~7 miles) | Open-Meteo | Settings → Privacy → Show the weather |

## Only when you set them up

| Feature | Sends | To |
|---|---|---|
| Google / Apple calendars | Your sign-in token; reads your events (read-only) | Google / Apple iCloud |
| Spotify | Your sign-in token; playback commands, music searches | Spotify |
| Email (grocery digest, weekly Internet report) | The grocery list / the kids' online-time report | Your email provider (SMTP), then each recipient's |
| Texting a contact (email-to-SMS) | The message and their phone number | Your email provider, then their mobile carrier |
| Browser calling | The call itself (Twilio's call-quality stats are switched off) | Twilio |
| Contacts: "how far away" | A contact's street address, when added/changed | OpenStreetMap — **off by default** (Settings → Privacy) |
| Recipe search online | What you typed in the search box; pictures are fetched through the Pi and saved there on import | TheMealDB |
| Settings: find your weather coordinates | The place name you typed | Open-Meteo |

## Downloads only (nothing about you is sent)

- **Face models** — once, when a parent turns face recognition on (~40 MB from GitHub/Hugging Face);
  or copy them in by hand and nothing is fetched (see [PHOTOS_SETUP.md](PHOTOS_SETUP.md)).
- **Pi-hole blocklists** — Pi-hole itself downloads the filter lists it's told to use.
- **Installing / updating** — `git pull`, `npm install` (a few packages fetch their own prebuilt
  program files), and `apt` updates, all when you run them.

Any of these reveal your home internet address to the site you're downloading from, as with any
download — but no family data.

## The kiosk browser

Chromium normally talks to Google in the background (updates, Safe Browsing lists, field trials,
translate, metrics). The kiosk command in [PI_SETUP.md](PI_SETUP.md) and
[DUAL_TOUCHSCREEN_SETUP.md](DUAL_TOUCHSCREEN_SETUP.md) includes flags that switch that off
(`--disable-background-networking`, `--disable-component-update`, `--disable-sync`, `--no-pings`, …).
If you set up the kiosk before these were added, update your autostart file. Phones and laptops
opening the dashboard use their own browsers, with whatever privacy settings those have.

## Outside this app

The Raspberry Pi OS itself (time sync, `apt`), Pi-hole's own update checks, and your router are
separate from this app — worth a look if you want the whole network locked down; Pi-hole's query
log (Internet page) is a good way to see what every device on the network is talking to.
