# Android tablet setup (wired kiosk + 📹 camera)

How to turn a cheap 10" Android tablet into a wall screen for the Family Home Center, on a wired
network cable, and (optionally) use its camera as a parent-only security camera.

The steps:

1. Pick the hardware
2. Give the Pi an HTTPS address (needed for the camera)
3. Set up the tablet (Android + Fully Kiosk Browser)
4. Set things up in the Family Home Center
5. Day to day

---

## 1. Hardware

**Best: a wall-mount "PoE" Android tablet** with a built-in network (RJ45) jack, about $150–250.

- One network cable from a **PoE switch** (or a ~$15 PoE injector) carries both power and network,
  so there's no power cord and no Wi-Fi.
- There's usually no battery to swell after years of being plugged in.
- **Before you buy, check the listing says:**
  - Android 11 or newer
  - at least 2 GB RAM (4 GB is better)
  - an RK3566, RK3568 or RK3576 chip
  - **a front camera**
  - **Google Play**, or that you can install APKs

**Or: a normal tablet plus a USB-C network adapter.** For example, a Samsung Galaxy Tab A9+ or a
Lenovo Tab M11, with a USB-C Ethernet adapter that also passes power through (PD). Android works with
most ASIX and Realtek adapters.

- Plug the charger into the adapter, not into the tablet.
- On Samsung, turn on **Settings → Battery → Protect battery** (stops charging at 85%). A battery
  kept at 100% all the time swells.

Mounting: put it where the front camera sees what you want watched (for example, the front hall or
the kitchen). It can't see in the dark and isn't weatherproof, so it's for indoors.

---

## 2. Give the Pi an HTTPS address

Browsers only let a web page use the camera over **HTTPS**. The plain `http://<pi>:3000` address
works for everything else, but the camera stays blocked there. It's the same requirement as the
Intercom microphone.

> **Easier:** `docs/LETSENCRYPT_SETUP.md` gets a free, trusted certificate (renews itself), so the
> tablets never warn and you can skip "Ignore SSL errors" and the certificate install below.

1. **Give the Pi a fixed address.** In your router's settings, reserve an IP for the Pi (for
   example, `192.168.1.50`). Android tablets often can't resolve `.local` names, so use the IP.

2. **Install Caddy.** On Raspberry Pi OS Bookworm (Debian 12) it's in the normal package list:

   ```bash
   sudo apt update
   sudo apt install -y caddy
   caddy version                  # should print v2.x
   systemctl status caddy         # should say active (running)
   ```

   Installing it creates `/etc/caddy/Caddyfile` and the `caddy` service for you. **If `/etc/caddy`
   doesn't exist, or you get "Unit caddy.service not found", Caddy isn't installed yet.** Don't
   create the folder by hand; run the install above. If apt asks about a Caddyfile you already
   made, answer **N** to keep yours. On older Raspberry Pi OS, where apt can't find `caddy`, use
   Caddy's own package list in step 1 of `docs/INTERCOM_SETUP.md`.

3. **Configure Caddy.** Edit `/etc/caddy/Caddyfile` (use your Pi's IP):

   ```
   https://192.168.1.50 {
     tls internal
     reverse_proxy localhost:3000
   }
   ```

   Then restart it:

   ```bash
   sudo systemctl restart caddy
   ```

4. **Test it from a computer.** Open `https://192.168.1.50`. The browser warns about the certificate
   once, because it's your own. Click "Advanced → Proceed" and the Family Home Center opens.

**Optional: trust the certificate properly** so there's no warning at all.

**Easiest:** on the tablet (or any phone/computer), open the app → **Settings → 🔒 This device's
certificate** → **📥 Get the certificate**, and follow the 2–3 steps it shows for that device.

Or by hand:

1. Copy Caddy's root certificate off the Pi:

   ```bash
   sudo cat /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
   ```

2. Install it on the tablet: **Settings → Security → More security settings → Install from device
   storage → CA certificate**.

3. Fully Kiosk Browser also has an "Ignore SSL errors" switch (step 3 below). That's the easy way if
   you'd rather skip this.

---

## 3. Set up the tablet

### Android

1. Do the first-time setup. A Google account is optional.
2. Plug in the network cable. **Settings → Network** should show **Ethernet connected**. Then turn
   **Wi-Fi off**.
3. **Settings → Display:**
   - Screen timeout: the longest option
   - Turn off auto-rotate if it's mounted
4. **Turn on Developer options:** go to Settings → About tablet and tap **Build number** 7 times.
5. **Settings → Developer options → Stay awake:** ON. The camera only works while the screen is on.
6. Install updates now, then turn off automatic system updates. That stops it restarting in the
   middle of the night.

### Fully Kiosk Browser

Install **Fully Kiosk Browser** from Google Play, or from fully-kiosk.com if the tablet has no Play
Store. Locking the tablet down (kiosk mode) and removing the watermark needs the **PLUS license**
(about $9 per tablet, one time). You can set everything up and try it first.

Open Fully, then swipe in from the left edge → **Settings**:

| Where | Setting | Set to |
|---|---|---|
| Web Content Settings | Start URL | `https://192.168.1.50` (your Pi) |
| Web Content Settings | **Enable Webcam Access** | ON (needed for the 📹 camera) |
| Web Content Settings | Enable Microphone Access | ON if you'll use the Intercom from it |
| Web Content Settings | Autoplay Videos | ON |
| Advanced Web Settings | Ignore SSL Errors | ON, *unless* you installed Caddy's certificate |
| Device Management | Keep Screen On | ON |
| Device Management | Launch on Boot | ON |
| Motion Detection | **Visual Motion Detection** | **OFF**: the Family Home Center does its own, and Fully would take the camera |
| Screensaver | Screensaver | OFF: the Family Home Center has its own photo screensaver |
| Kiosk Mode (PLUS) | Enable Kiosk Mode | ON, and **set a Kiosk Exit PIN** |

The first time the camera is used, Android asks Fully for **camera permission**. Tap **Allow**. If
you missed it, go to Android **Settings → Apps → Fully Kiosk Browser → Permissions → Camera →
Allow**.

To leave kiosk mode later: swipe from the left edge and enter the PIN.

### Without Fully Kiosk Browser

Chrome works too. Open the HTTPS address → ⋮ → **Add to Home screen** (it opens full-screen), and
pin it with Android's **App pinning** (Settings → Security → App pinning). Chrome asks for camera
permission the first time; tap **Allow**.

---

## 4. In the Family Home Center

### Once

1. **Turn on the Settings login** (`docs/SETTINGS_LOGIN.md`). This really matters for the camera.
   Without logins, anyone at the screen can pick a parent in the person menu and open 📹 Cameras.
   With logins, only a logged-in parent can see the cameras, and the server refuses everyone else.
2. **Give the parents' emails:** Settings → Family members → each parent's email. Make sure email
   works first: Settings → 📬 Email, and `docs/GROCERY_EMAIL_SETUP.md`.
3. On the tablet, open the person menu (top right) and make sure **📱 Keep me logged in on this
   device** is *off*. A 10" tablet counts as a shared wall screen by default, so whoever's picked is
   forgotten after a few idle minutes and the photo screensaver runs.

### Make the tablet a camera (on the tablet itself)

1. On the tablet, log in as a parent, or pick a parent up top.
2. **Settings → 📹 Cameras → This device:** type a name (for example, *Kitchen*) and tap **📹 Use
   this device as a camera**. If a red note says *"This page isn't open over HTTPS"*, the tablet is
   on the `http://…:3000` address. Go back to step 2 and use the HTTPS address.
3. Pick a kid again (or log out). The camera keeps working whoever is picked, and under the
   screensaver.

Do this on each tablet you want as a camera. A phone or tablet only becomes a camera when a parent
does this step on it.

### Turn it on and watch (from any screen, as a parent)

**More ▾ → 📹 Cameras.** This menu item only shows for parents. Each camera has:

- **Camera on:** the tablet opens its camera. While it's on, the tablet shows a small **📹 Camera
  on** badge in the corner, which turns red with **👀 live** while a parent is watching.
- **The live picture:** about one picture a second. Tap it to see it full screen.
- **Save movement (and email):** the tablet watches for movement itself and sends pictures only
  while something moves. Each burst is saved as a clip. The parents get an email with the first
  picture, at most one every 10 minutes per camera. Turn the email off in Settings → 📹 Cameras.
- **Sensitivity:**
  - Turn it down if it saves clips of nothing (sunlight moving, a TV, the screen itself).
  - Turn it up if it misses people walking by.
- **Front / Back camera.**
- **Show "📹 Camera on" on the tablet:** on by default. It's kinder to keep it on, so everyone at
  home knows when the camera is on.

**🎞️ Movement** (below the cameras) lists the saved clips, newest first:

- Tap one to play it: ⏸ / ▶️, a slider to go frame by frame, and ⬇️ to save a picture.
- **Take off list** hides a clip. Its pictures stay on the Pi.

---

## 5. Day to day

- **Storage** (Settings → 📹 Cameras → 💾 Storage). **Nothing is ever removed by itself.**
  - **Where clips are kept:** on the Pi in `server/data/cameras/<camera>/`. Movement is saved as
    one picture a second (about 30–60 KB each).
  - **Compress clips older than a day** (on by default): after 24 hours a clip's pictures become one
    small video (MP4, or WebM), usually 80–95% smaller and still playable on 📹 Cameras. It needs
    `ffmpeg` on the Pi (`sudo apt install ffmpeg`; the Movies feature uses it too).
  - **The warning:** when the Pi has less than **8 GB free** (you can change the number), a red
    warning shows here. Below 1 GB free, new movement simply isn't saved until there's room.
  - **☁️ Back up to a network share (SMB):**
    1. Install smbclient on the Pi: `sudo apt install smbclient`.
    2. Enter the share (e.g. `//192.168.1.20/backups`), an optional folder, and the username and
       password. The password is never shown again or sent to the page.
    3. Tap **🔌 Test**, then **☁️ Back up now**, or tick **Back up automatically** (hourly).
    4. Compressed clips go to `<folder>/<camera>/<date>/` on the share. **Nothing on the share is
       ever removed from here.**
  - **⬇️ Download as zip:** clips older than N days, split into zips of up to 3.5 GB that open
    anywhere. Clips in a finished download are marked "downloaded".
  - **🗑️ Remove from the Pi:** only when you tap it, after a confirm that says how many clips and
    how much space. By default it only removes clips already backed up or downloaded. It refuses
    if the clips folder is itself a network share. **📜 Removed so far** lists every removal, when,
    by whom, and how much.
- **Away from home:** 📹 Cameras works on your home network. To look from outside, use a VPN into
  your home network (for example, Tailscale on the Pi and your phone). Don't open the Pi's port to
  the internet.
- **Off or not working:** on 📹 Cameras, each camera says why:
  - *Needs HTTPS:* the tablet is on the `http://` address.
  - *Camera not allowed:* allow the camera in Fully or Android permissions.
  - *No camera found.*
  - *Tablet offline:* the tablet hasn't checked in for 20 seconds. Check its cable and that the
    screen is on.
- **Stop using a tablet as a camera:** on the tablet, go to Settings → 📹 Cameras → *Stop using this
  device as a camera*. Its clips are kept.
- **Server log:**

  ```bash
  journalctl -u familyhomecenter -n 50 | grep cameras
  ```
