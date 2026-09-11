# Intercom setup

Push-to-talk paging into one or more zones' speakers, from the touchscreen itself or from a phone
(install the dashboard as a PWA — see below). This reuses the same DAC8x zone outputs as the music
system, so finish `docs/MUSIC_SETUP.md` first (it installs `ffmpeg` and `alsa-utils`, both required
here too).

## The hard requirement: HTTPS

Browsers only allow microphone access (`getUserMedia`) on a **secure context** — HTTPS, or
`localhost`. The dashboard normally runs on plain `http://<pi-ip>:3000`, which is secure enough for
`localhost` on the Pi itself, but a phone on the same Wi-Fi hitting `http://<pi-ip>:3000` is *not*
`localhost`, so its browser will silently block the microphone. The fix is to put a local HTTPS
reverse proxy in front of the app. **Caddy** is the simplest option — it can mint and serve a locally
trusted certificate with almost no config.

### 1. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 2. Configure it to proxy to the app

Edit `/etc/caddy/Caddyfile` (replace `familyhub.local` with your Pi's actual hostname or IP):

```
familyhub.local {
  reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Caddy automatically generates a local certificate authority (CA) and serves HTTPS on port 443 using
it — no internet/public domain needed for a home network.

### 3. Trust Caddy's local CA on family members' phones

The first time, phones will show a certificate warning (the CA is locally-generated, not
publicly trusted). Two options:

- **Easiest**: tap through the browser's "proceed anyway" warning once. Fine for a phone that's
  always on your home Wi-Fi.
- **Cleaner**: export Caddy's root CA (`sudo cat /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`),
  AirDrop/email it to each phone, and install it as a trusted profile (iOS: Settings → General → VPN
  & Device Management, then also enable full trust under Settings → General → About → Certificate
  Trust Settings; Android: Settings → Security → Encryption & Credentials → Install a certificate).

### 4. Use `https://familyhub.local` from now on

Once Caddy is trusted, visit `https://familyhub.local` (not the `:3000` address) from phones — that's
the URL the microphone will actually work from. The touchscreen kiosk can point at either; it doesn't
need the microphone unless you also want to page *from* it.

## Installing the dashboard as an app on a phone

- **iOS (Safari)**: open the HTTPS URL → Share → **Add to Home Screen**.
- **Android (Chrome)**: open the HTTPS URL → menu (⋮) → **Install app** / **Add to Home screen**.

This gives a normal-looking home screen icon that opens full-screen — no app store involved (see the
project README for why this is a PWA rather than a native app).

## Using it

**Intercom** page → pick one or more zones (or "All zones") → press and hold **Talk**. Whatever's
playing in the target zone(s) automatically ducks down while you talk, and resumes after you let go.

## Scope note: one-way paging, not two-way calling

The DAC8x is an output-only DAC — a zone's hardwired speakers have no microphone to talk back
through, so this is a paging/announcement system (like an intercom or overhead page), not a two-way
phone call. True two-way audio is possible between two *app* endpoints (e.g. two phones, or a phone
and the touchscreen, since both have microphones) — the same WebSocket relay could support that with
some extension, but it isn't built here.
