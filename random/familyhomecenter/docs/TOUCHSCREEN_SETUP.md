# Choosing and wiring a touchscreen

This dashboard is built for a touchscreen (see [PI_SETUP.md](PI_SETUP.md)),
but "HDMI touchscreen" hides a few gotchas worth getting right before you
buy or wire anything.

## HDMI carries video only — touch needs a separate USB connection

Almost every external USB-touch monitor needs **two** cables to the host:
HDMI (or DisplayPort) for video, and a separate USB cable for the touch
digitizer's data. HDMI has no channel for touch input at all, so if only
HDMI is connected, touch will not work no matter how the Pi is configured —
there's no software fix for a cable that isn't there.

## Confirm the monitor is actually touch-capable

Not every monitor with "USB ports" is a touch monitor — a plain USB hub
(for plugging in peripherals) looks similar on a spec sheet but has no touch
digitizer. Before buying, check the product page explicitly lists a **touch**
feature (e.g. "10-point capacitive touch") — a generic "USB 3.2 Type-A hub"
line is not that. (This is exactly what tripped up an ASUS VA27EQSB in this
project's history — a solid non-touch monitor, but no touch hardware at all.)

A good, currently-available 24"+ pick: **ViewSonic TD2455** — 24" 1080p IPS,
10-point capacitive touch, HDMI + DisplayPort for video, USB-B for touch data.
Other brands with the same HDMI-video + USB-touch pattern (Dell P2418HT,
Planar PCT2485, Elo 2494L) work identically — any generic USB HID touchscreen
works with a Pi, no special drivers needed.

## Three ways to connect it to the Pi

**A. Pi sits right behind/near the screen (simplest).** Just run a normal
HDMI cable + USB cable a few meters, directly — this is what
[PI_SETUP.md](PI_SETUP.md) assumes.

**B. Real distance between the Pi and the screen, want to use existing wired
Ethernet (Cat6) runs.** Use a dedicated HDMI+USB **KVM extender** kit — a
transmitter box near the Pi, a receiver box near the screen, connected by a
single Cat6/6a/7 cable (up to ~70m/230ft on most kits, so 30-50ft runs are
comfortably within range). This is a point-to-point signal extension, not
real network traffic:

```
Pi ──(short HDMI + short USB)──> [Transmitter] ══(one Cat6/6a cable)══> [Receiver] ──(short HDMI + short USB)──> Touch monitor
```

- Recommended kit (explicitly touch-capable): [SIIG 4K HDMI KVM Extender over Cat6, with touch-screen support](https://siig.com/products/4k-60hz-hdr-hdmi-kvm-over-cat6-extender-with-spdif-touch-screen-support).
- **If you already have wired in-wall Cat6 jacks**, this works great — plug
  the transmitter into the jack near the Pi, the receiver into the jack near
  the screen. The one requirement: that run must be a straight, passive
  copper path end-to-end (a patch panel is fine; an active network switch
  port is not — this isn't real Ethernet/IP traffic, just raw signal over the
  copper pairs, so it can't be routed through switched network gear).
- **Sound**: HDMI carries audio as part of the same signal, so a monitor's
  built-in speakers work over the same cable automatically. Kits like the one
  above also have a dedicated S/PDIF/3.5mm audio-extraction port if you'd
  rather send audio to a separate soundbar instead — optional.
- **Power**: both boxes typically need their own 5V adapter (included),
  unless the kit advertises PoC ("Power over Cable"), which lets one end
  power both — handy if only one side is near an outlet.
- **Software**: nothing changes on the Pi. It sees a normal HDMI display and
  a normal USB HID touch device plugged in locally at the transmitter end —
  everything in PI_SETUP.md applies unchanged.

**C. The dashboard needs to live somewhere the Pi's video cable can't
practically reach at all** (e.g. a different room served by network but not
by a clean cable run). Skip video-cable extension entirely: since this app is
just a web server on the Pi (`http://<pi-ip>:3000`), put a small networked
touch-capable device *at* the screen instead (a second Pi, a tablet, an
all-in-one touch PC) and point its browser at the main Pi over your actual
LAN. This is genuinely "over Ethernet" (real TCP/IP, any distance your
network reaches) and needs no special extender hardware at all — the main Pi
becomes a pure server and can live anywhere.

## Driving more than one touchscreen

A Pi 5 has two independent HDMI outputs, so it can drive **two** touchscreens
— each optionally showing different content. See
[docs/DUAL_TOUCHSCREEN_SETUP.md](DUAL_TOUCHSCREEN_SETUP.md). Beyond two
screens, use one small Pi per additional screen (Path C above), each pointed
at the same main Pi's server.
