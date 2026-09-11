# Multi-zone music setup (HiFiBerry DAC8x)

This sets up 4 independent stereo zones from one Raspberry Pi + HiFiBerry DAC8x, each zone able to
play its own local-library music or Spotify Connect independently, or be grouped to play the same
thing in sync-ish (see the note at the bottom).

## 1. Wire it up and enable the DAC8x

1. Attach the DAC8x HAT to the Pi's GPIO header, then wire your 4 pairs of hardwired speakers to its
   4 stereo outputs (check the HiFiBerry DAC8x docs for terminal numbering — outputs are typically
   labeled channels 1-8, in stereo pairs 1-2 / 3-4 / 5-6 / 7-8).
2. Disable the Pi's onboard audio and enable the DAC8x overlay. Edit `/boot/firmware/config.txt`:

   ```
   dtparam=audio=off
   dtoverlay=hifiberry-dac8x
   ```

3. Reboot, then confirm the card shows up:

   ```bash
   aplay -l
   ```

   You should see something like `card 0: sndrpihifiberry`. If it's a different card number, you'll
   adjust `asound.conf.dac8x` in step 3 below.

## 2. Install the audio stack

```bash
sudo apt update
sudo apt install -y mpd alsa-utils ffmpeg

# librespot (Spotify Connect) isn't in Raspberry Pi OS's default repos — install the prebuilt binary:
curl -L -o /tmp/librespot.tar.gz \
  https://github.com/librespot-org/librespot/releases/latest/download/librespot-linux-armv6.tar.gz
sudo tar -xzf /tmp/librespot.tar.gz -C /usr/bin librespot
librespot --version   # sanity check
```

(Pick the release asset matching your Pi's architecture — armv6 works on all Pi models; `aarch64` if
you're running a 64-bit OS and want a slightly more efficient build.)

## 3. Map the DAC8x's 8 channels into 4 zone devices

```bash
sudo cp scripts/music/asound.conf.dac8x /etc/asound.conf
```

Open it and confirm the `hw:0,0` in `pcm.dac8x_dmix` matches what `aplay -l` showed. Test each zone
one at a time (you should hear pink noise from the correct pair of speakers only):

```bash
speaker-test -D zone1 -c 2 -t wav
speaker-test -D zone2 -c 2 -t wav
speaker-test -D zone3 -c 2 -t wav
speaker-test -D zone4 -c 2 -t wav
```

If a zone is silent or noise comes from the wrong speakers, double check the `ttable` channel numbers
in `/etc/asound.conf` against how you wired the DAC8x's terminals.

## 4. Set up MPD (local library), one instance per zone

```bash
cd ~/paloalto_parser/random/familyhomecenter
./scripts/music/generate-mpd-configs.sh 4 /home/pi/music
sudo cp scripts/music/mpd-zone@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mpd-zone@{1,2,3,4}.service
sudo systemctl status mpd-zone@1.service   # should be "active (running)"
```

Copy your MP3s (or FLAC/OGG — MPD handles most common formats) into `/home/pi/music`. All 4 zones
read the same folder; only their databases and playback state are separate.

## 5. Set up librespot (Spotify Connect), one instance per zone

```bash
sudo cp scripts/music/librespot-zone@.service /etc/systemd/system/
sudo cp scripts/music/librespot-event.sh /opt/familyhomecenter/scripts/music/librespot-event.sh  # match the path in the unit file
sudo nano /etc/systemd/system/librespot-zone@.service   # set INTERNAL_API_TOKEN to match your .env
sudo systemctl daemon-reload
sudo systemctl enable --now librespot-zone@{1,2,3,4}.service
```

Once running, each zone shows up as a Spotify Connect device (e.g. "Family Hub Zone 1") in the
Spotify app on any family member's phone — tap the speaker/devices icon, pick a zone, and it starts
streaming straight from Spotify's servers to that zone. No login is required in the dashboard for
this to work; see `docs/SPOTIFY_SETUP.md` only if you also want in-dashboard playback control.

## 6. Point the app at all this

In `.env`:

```
MUSIC_LIBRARY_DIR=/home/pi/music
MUSIC_ZONE_COUNT=4
MPD_HOST=127.0.0.1
MPD_BASE_PORT=6600
INTERNAL_API_TOKEN=<same value you put in librespot-zone@.service>
```

Restart the app server. The **Music** page should now show all 4 zones, each independently
controllable, with search across your local library.

## Grouping zones ("same music everywhere")

The Music page's "play same music on selected zones" groups zones so they share one queue — the
dashboard sends play/pause/track/volume commands to every zone in the group at (almost) the same
moment. This is **not** sample-accurate synchronization: because each zone runs its own independent
MPD process and clock, you may hear a small (well under a second, typically) drift between two
grouped zones' speakers if you stand exactly between two rooms. For most family use this is fine. If
you want tighter, professional-grade sync across zones, look into replacing this MPD-per-zone setup
with **Snapcast** (one shared audio source, clock-synced clients) — a documented upgrade path, not
implemented here to keep the setup approachable.
