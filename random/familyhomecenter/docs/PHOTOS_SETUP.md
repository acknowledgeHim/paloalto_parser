# Photo slideshow setup

The slideshow reads image files (`.jpg`, `.jpeg`, `.png`, `.webp`) from the
directory named in `PHOTOS_DIR` (in `.env`), recursively — subfolders like
`PHOTOS_DIR/2024/vacation/` work fine. Each photo gets a downsized, cached
thumbnail (`server/data/thumbs/`) so slideshow playback stays smooth even with
large originals. The server generates these **in the background** (on boot,
then a re-check every 30 minutes for newly added photos) rather than only the
first time someone happens to view a photo — so once a library's warmed up,
browsing/slideshow is reading from the local cache, not re-fetching the
original over the network every time. See "Speeding up an SMB share" below if
that initial warm-up (or an occasional cache miss) still feels slow.

## Option A: local folder

Copy photos onto the Pi directly (USB drive, `scp`, Syncthing, etc.) and point
`PHOTOS_DIR` at that folder, e.g.:

```
PHOTOS_DIR=/home/pi/family-photos
```

## Option B: SMB / network share

If your family photos live on a NAS, another computer's shared folder, or a
router-attached USB drive, mount that SMB share on the Pi and point
`PHOTOS_DIR` at the mount point.

1. Install the CIFS client:

   ```bash
   sudo apt install -y cifs-utils
   ```

2. Create a mount point and a credentials file (keeps the password out of
   `/etc/fstab`, which is world-readable):

   ```bash
   sudo mkdir -p /mnt/family-photos
   sudo nano /etc/samba-family-photos.cred
   ```

   In that file:

   ```
   username=your-smb-username
   password=your-smb-password
   domain=WORKGROUP
   ```

   Then lock it down:

   ```bash
   sudo chmod 600 /etc/samba-family-photos.cred
   ```

3. Add a line to `/etc/fstab` so it mounts automatically on boot (replace
   `//nas-ip-or-hostname/share-name` with your share's path):

   ```
   //nas-ip-or-hostname/share-name /mnt/family-photos cifs credentials=/etc/samba-family-photos.cred,iocharset=utf8,vers=3.0,uid=pi,gid=pi,x-systemd.automount,_netdev,rsize=1048576,wsize=1048576,cache=loose 0 0
   ```

   The last three options (`rsize`/`wsize`/`cache=loose`) matter for speed —
   see below.

4. Mount it and verify:

   ```bash
   sudo mount -a
   ls /mnt/family-photos
   ```

5. Set in `.env`:

   ```
   PHOTOS_DIR=/mnt/family-photos
   ```

   Restart the server (`sudo systemctl restart familyhomecenter`) so it picks
   up the new path. The `x-systemd.automount,_netdev` options above make sure
   the Pi waits for the network before mounting, so it survives reboots
   cleanly.

## Speeding up an SMB share

If photos are slow to first appear (subsequent views of the *same* photo are
always fast — served from the local thumbnail cache), the original files are
likely large (multi-MB phone photos) and reading them over the network is the
actual bottleneck, not anything CPU-side on the Pi. A few things help, biggest
first:

1. **Let the background warm-up run.** The server generates thumbnails for
   every photo automatically, starting right when it boots — so the *first*
   time you browse a freshly-mounted library, give it a few minutes before
   judging it. Watch it happen: `journalctl -u familyhomecenter -f | grep photos`
   shows lines like `[photos] thumbnail warm-up: 143 ok`. A very large library
   (thousands of photos) can take a while the first time since it's
   deliberately sequential (gentle on the Pi and the share) rather than
   hammering the network in parallel — but it's a one-time cost per photo, and
   it re-checks for new ones every 30 minutes without you doing anything.

2. **Tune the SMB mount options** — `rsize`/`wsize` set the read/write buffer
   size per request (the default is often small, e.g. 64KB, causing far more
   round-trips than necessary for multi-MB photos); `cache=loose` lets the
   kernel's CIFS client cache more aggressively client-side. The fstab line
   above already includes `rsize=1048576,wsize=1048576,cache=loose` — if you
   set up your mount before this was added, edit `/etc/fstab` to add them,
   then `sudo umount /mnt/family-photos && sudo mount -a`.

3. **Wired beats Wi-Fi**, on both ends if possible — the Pi and whatever's
   hosting the share (NAS, router-attached drive, another computer). Wi-Fi
   SMB transfers are commonly the single biggest factor in "slow photos."

4. **Isolate network vs. app**: `time cp /mnt/family-photos/some-large-photo.jpg /tmp/`
   on the Pi tells you the raw SMB read speed for one file, independent of
   this app entirely — if that itself is slow, the fix is on the network/mount
   side (1-3 above), not something the app can work around further.

## HEIC photos (iPhone)

The scanner currently looks for `.jpg`/`.jpeg`/`.png`/`.webp`. If your family
shares photos straight from iPhones, either:
- turn on **Settings → Camera → Formats → Most Compatible** on the iPhones so
  they save as JPEG, or
- convert existing HEICs in bulk before copying them over, e.g. with
  `heif-convert` (`sudo apt install libheif-examples`).
