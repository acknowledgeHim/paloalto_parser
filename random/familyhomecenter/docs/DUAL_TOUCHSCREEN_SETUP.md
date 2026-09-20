# Two touchscreens, one Pi, different content on each

A Raspberry Pi 5 has two independent micro-HDMI outputs, so it can drive two
separate touchscreens showing two different pages of the dashboard at once
(e.g. a kitchen screen on **Family Board** and a hallway screen on **Meals**).
This builds on [PI_SETUP.md](PI_SETUP.md) and
[TOUCHSCREEN_SETUP.md](TOUCHSCREEN_SETUP.md) — do those first, then come back
here for the second screen.

If each screen is far from the Pi, each one gets its **own** HDMI+USB-over-Cat6
extender kit (one kit is point-to-point for one screen — see
TOUCHSCREEN_SETUP.md's Path B — so two screens need two kits and two Cat6
runs). You'll need a micro-HDMI-to-HDMI adapter/cable for each of the Pi's two
outputs feeding into each extender's transmitter.

## 1. Confirm both displays are detected

With both screens connected (directly or through their extenders), open a
terminal on the Pi and run:

```bash
xrandr -q
```

You should see two outputs listed as `connected` — typically `HDMI-1` and
`HDMI-2` (names can vary; use whatever `xrandr` actually reports from here on).
Raspberry Pi OS's Chromium runs through XWayland even under the labwc Wayland
compositor, so `xrandr`/`xinput` (X11 tools) work for this even though the
desktop itself is Wayland.

## 2. Lay out the two displays

They don't need to be positioned to match their physical arrangement — each
one will just get its own fullscreen kiosk window — but `xrandr` needs *some*
non-overlapping layout:

```bash
xrandr --output HDMI-1 --auto --output HDMI-2 --auto --right-of HDMI-1
```

Note the resolution `xrandr -q` reports for `HDMI-1` (e.g. `1920x1080`) — you
need its width for step 4.

## 3. Map each touchscreen to its own display

By default X11 doesn't know which USB touch controller belongs to which
screen — without this step, touches can land on the wrong display or only
ever hit one of them. List the input devices:

```bash
xinput list
```

Look for two entries that are touchscreens (often named after the touch
controller chipset, e.g. `ILITEK... Touchscreen` or similar — generic HID
names are normal, especially through a USB extender). If you can't tell them
apart, unplug one screen's USB temporarily and see which entry disappears.
Then map each to its display:

```bash
xinput map-to-output "First Touchscreen Device Name" HDMI-1
xinput map-to-output "Second Touchscreen Device Name" HDMI-2
```

## 4. Launch two Chromium kiosk windows, one per screen

Each instance needs its own `--user-data-dir` (so they don't fight over the
same browser profile/lock file), a `--window-position` matching that display's
offset from step 2, and can point at a **different route** of the dashboard —
this app uses hash-based routing, so `#/board`, `#/meals`, `#/tasks`, etc. all
work as direct URLs:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  --user-data-dir=/home/pi/.chromium-screen1 \
  --window-position=0,0 \
  "http://localhost:3000/#/board" &

chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  --user-data-dir=/home/pi/.chromium-screen2 \
  --window-position=1920,0 \
  "http://localhost:3000/#/meals" &
```

Replace `1920` with the actual width `xrandr` reported for `HDMI-1` in step 2
(so the second window's position lands on `HDMI-2`, not overlapping the
first). Pick whichever two routes you want on each screen.

## 5. Put it all together in autostart

Combine steps 2-4 into the same `~/.config/labwc/autostart` file from
[PI_SETUP.md](PI_SETUP.md#6-launch-chromium-in-kiosk-mode-on-boot), replacing
its single `chromium-browser` line. Add a short delay before the `xinput`
calls — USB touch controllers (especially through an extender) can take a
moment to enumerate after the display server starts:

```bash
unclutter -idle 1 &
xrandr --output HDMI-1 --auto --output HDMI-2 --auto --right-of HDMI-1
sleep 3
xinput map-to-output "First Touchscreen Device Name" HDMI-1
xinput map-to-output "Second Touchscreen Device Name" HDMI-2

chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  --check-for-update-interval=31536000 \
  --user-data-dir=/home/pi/.chromium-screen1 \
  --window-position=0,0 \
  "http://localhost:3000/#/board" &

chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  --check-for-update-interval=31536000 \
  --user-data-dir=/home/pi/.chromium-screen2 \
  --window-position=1920,0 \
  "http://localhost:3000/#/meals" &
```

## Beyond two screens

A Pi 5 only has two video outputs, so a third screen can't be added to the
same Pi this way. For 3+ screens, the simpler and more reliable path is one
small Pi (or other kiosk device) per additional screen, each just running its
own single-screen kiosk (per PI_SETUP.md) pointed at
`http://<main-pi-ip>:3000/#/<route>` over your network — the main Pi stays the
one server everything reads from, so there's nothing to keep in sync. That
also sidesteps all the `xrandr`/`xinput` multi-monitor juggling above entirely.
