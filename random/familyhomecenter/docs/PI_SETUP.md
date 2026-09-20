# Raspberry Pi 5 kiosk setup

This turns a Raspberry Pi 5 + touchscreen into a wall-mounted family dashboard:
the Node server runs in the background and Chromium opens full-screen on top
of it, with a photo-slideshow screensaver when nobody's using it.

## 1. Flash the OS

Use **Raspberry Pi Imager** to flash the latest **Raspberry Pi OS (64-bit, with desktop)**
onto the SD card/SSD. In the imager's advanced options, set a hostname (e.g. `familyhub`),
enable SSH, and set up Wi-Fi if needed — makes the rest of this much easier to do over SSH.

Also in advanced options, set the **username to `pi`**. Modern Raspberry Pi OS no longer
creates a `pi` user by default — you pick your own username at flash time — but
`scripts/familyhomecenter.service` and the rest of this guide hardcode `pi` /
`/home/pi/...`. If you use a different username, edit `User=` and `WorkingDirectory=`
in `scripts/familyhomecenter.service` (step 5) to match before installing the service,
or `systemctl start` will fail (commonly surfacing as
`Result: resources` / `activating (auto-restart)` in a loop, since the `pi` user it's
trying to run as doesn't exist).

## 2. Install prerequisites

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y chromium-browser unclutter git

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Get the code and configure it

```bash
cd ~
git clone https://github.com/acknowledgeHim/paloalto_parser.git
cd paloalto_parser/random/familyhomecenter
cp .env.example .env
nano .env   # set WEATHER_LAT/LON, PHOTOS_DIR, and any calendar credentials
```

See `GOOGLE_CALENDAR_SETUP.md`, `APPLE_CALENDAR_SETUP.md`, `PHOTOS_SETUP.md`,
`MUSIC_SETUP.md` (HiFiBerry DAC8x + MPD + librespot), `SPOTIFY_SETUP.md`, and
`INTERCOM_SETUP.md` (HTTPS via Caddy, required for the microphone) for the
optional integrations. Everything works with just the local calendar, chores,
weather, and slideshow with none of that configured — add the rest whenever
you're ready.

## 4. Install dependencies and build

```bash
cd server && npm install && npm run build && cd ..
cd client && npm install && npm run build && cd ..
```

The server serves the built client, so in production only **one process** and
**one port (3000)** are needed.

## 5. Run the server as a systemd service

```bash
sudo cp scripts/familyhomecenter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now familyhomecenter
sudo systemctl status familyhomecenter   # should say "active (running)"
```

Edit the `WorkingDirectory` and `User` lines in the unit file first if your
username or clone path differ from `pi` / `/home/pi/...`.

## 6. Launch Chromium in kiosk mode on boot

Raspberry Pi OS Bookworm's desktop uses **Wayland (labwc)** by default. Create an
autostart entry:

```bash
mkdir -p ~/.config/labwc
cat >> ~/.config/labwc/autostart <<'AUTOSTART'
unclutter -idle 1 &
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  --check-for-update-interval=31536000 \
  http://localhost:3000 &
AUTOSTART
```

If you're on the older X11 desktop instead, use `~/.config/autostart/familyhomecenter.desktop`
with an `Exec=` line running the same `chromium-browser --kiosk ...` command, and
also disable the X screensaver/blanking with `xset s off && xset -dpms` in the
same autostart script.

## 7. Disable screen blanking

The app has its own photo-slideshow screensaver (`Settings → idle timeout`), so
you want the *display* to never blank on its own:

- **Wayland/labwc**: edit `~/.config/labwc/environment` and set `WLR_NO_HARDWARE_CURSOR=1`;
  disable DPMS via `wlopm --off` is not persistent — instead add to the autostart
  script: `swaymsg -t get_outputs` isn't available on labwc, so simplest is a udev/
  `xset`-equivalent isn't present under Wayland — in practice, setting the touchscreen's
  power management off in `raspi-config` → Display Options is the most reliable route.
- **X11**: `xset s off -dpms` in the autostart script (shown above) is sufficient.

## 8. On-screen keyboard (for typing chore/task names on the touchscreen)

```bash
sudo apt install -y squeekboard
```

Squeekboard auto-shows for text inputs on GTK apps; for Chromium specifically,
enable Chromium's built-in virtual keyboard via `chrome://flags` →
"Enable virtual keyboard" (set to Enabled), then relaunch kiosk mode.

## Updating later

```bash
cd ~/paloalto_parser
git pull
cd random/familyhomecenter/server && npm install && npm run build
cd ../client && npm install && npm run build
sudo systemctl restart familyhomecenter
```
