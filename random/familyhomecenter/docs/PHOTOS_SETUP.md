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

## Albums and favorites

Tap a photo and use **☆** to add it to **⭐ Favorites**, or **📁** to add it to any album (or make a
new one right there). For lots at once, **☑ Select photos** on the Photos page → tap photos →
**⭐ Favorite** or **📁 Albums…**. The chips above the grid switch between All photos, Favorites, and
each album.

Albums live only in the app's database (`server/data/familyhomecenter.db`) — a photo "in" an album
is just a note of its path. **Nothing on PHOTOS_DIR is ever moved, copied, renamed, or deleted**, and
deleting an album only deletes the album. Anyone can add/remove photos; renaming or deleting an
album is for whoever made it or a parent. Favorites can't be renamed or deleted.

Movies and photo documents can pick **From an album**.

## Sorting, filing, and hiding

Above the Photos grid:

- **Sort** — Library order, Date taken (newest / oldest first), or Folder / filename.
- **Albums** — All photos, **Not in any album**, or **In an album** (Favorites counts).
- **Show hidden photos** — off by default.

**Hiding** a photo (🙈 in the photo viewer, or **☑ Select photos → 🙈 Hide** for many) keeps it out
of sight: out of the grid unless *Show hidden photos* is on (then it's dimmed, with 👁 to unhide),
and out of the slideshow/screensaver, On this day, and the movie and document pickers. Like albums,
it's only a note in the app's database — the file isn't moved or changed.

**Going through photos to file them:** set **Albums → Not in any album**, open the first photo, and
for each one either **📁** it into album(s) or **🙈** hide it. Filing keeps the photo on screen (so
you can add it to more than one album) until you tap **›**; hiding moves straight on. Either way it
drops out of the list, so what's left is only what still needs sorting.

## On this day

When there are photos taken on today's date in past years, the Dashboard shows an **On this day**
strip ("3 years ago"). Tap one to see it full size.

## Blurry photos and duplicates

In the background, alongside the thumbnail warm-up, each photo gets a quick check for blur and a
"fingerprint" for spotting near-duplicates (the same shot taken a few times, or a re-saved copy).
Wherever you browse or pick photos — the Photos page, the movie maker, the document picker — you'll
see **Possibly blurry** / **Duplicate** tags and these options:

- **Blurry photos: Include / Exclude**
- **Duplicates: Include all / Keep only the best of each** (the highest-resolution, sharpest copy)

It's a heuristic: a deliberately soft photo (fog, a plain sky) can be flagged, which is why the
default is to include everything. Photos not checked yet are always included. A large library takes
a while to analyze the first time; after that only new or changed photos are checked.

## People (face recognition) — optional

**Photos → 👥 People** finds faces in your photos and suggests who's who once you've named a few.

1. A parent taps **Turn on face recognition**. The Pi downloads two small face models once (~40 MB,
   from OpenCV's official model collection) and starts looking through your photos in the
   background — the first pass over a big library can take hours on a Pi; after that, only new
   photos are checked. The People page shows how far it's got.
2. Under **Who's this? (groups)**, faces nobody's named yet are grouped by who they probably are.
   Every face starts picked (✓); tap any that don't belong to un-pick them (or **None**, then tap
   the right ones), type a name, **Name these**. If a group isn't one person at all, tap
   **Different people** — those faces won't be grouped again and wait for you photo by photo.
   **Ignore picked** is for things that aren't faces, strangers in the background, posters, etc.
   (the count shows at the top, with **Bring back** if you change your mind).
   Only clear, front-on faces are grouped; the rest are left for photo by photo.
   (Faces found before this "facing the camera" check existed get it filled in automatically in
   the background — the People page shows *Updating face scores: X of Y photos* meanwhile. Names
   aren't touched, and no rescan or turning off/on is needed.)
3. **Name faces photo by photo** goes through every photo with unnamed faces (busiest photos first):
   each face gets a numbered box on the photo and a row beside it — type a name, ✓ / ✗ a suggestion,
   or 🚫 Ignore — then **Next photo**. A few names here is the best way to teach it someone.
4. Once someone has a name, their other photos show up as suggestions: open them on the People
   page (**Is this Sam?** ✓ / ✗ / **Yes to all**), or in the photo viewer, where faces show along the
   bottom — a name, a "Sam?" to ✓ or ✗, **Who's this?** to name it right there, or 🚫 to ignore it.
   A suggestion is only made when one person is a clear match — if two people (say, siblings) look
   about equally likely, it doesn't guess.
5. Then: **Person** filter on the Photos page, **See their photos** on someone's People card, and
   **With a person** as a way to pick photos for movies and documents.

Nothing is ever tagged without someone confirming it. Kids are the hardest case (faces change a lot
year to year) — confirming a few photos of each child from different ages helps a lot.

**Privacy — nothing leaves the Pi.** Finding and comparing faces happens entirely on the Pi; no
photo, face, or faceprint is sent anywhere. The only internet use is that one-time model download.
The face library (ONNX Runtime) includes Microsoft usage telemetry; the app switches it off
(`ORT_DISABLE_TELEMETRY=1`, also set in the service file) — verified by running the server with every
internet connection and hostname lookup logged and blocked at the operating-system level: zero
attempts while scanning faces (and 10 attempts to Microsoft's telemetry server without the switch).

**Never downloading anything:** put the two model files in `server/data/models/` yourself before
turning it on, and the Pi won't fetch them:

- `face_detection_yunet_2023mar.onnx` (232,589 bytes) — from
  https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- `face_recognition_sface_2021dec.onnx` (38,696,353 bytes) — from
  https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface

**Turning it off** stops scanning; names and tags are kept (turn it back on to carry on). **Forget
this person** on someone's page removes the name only — their faces go back to unnamed. Photos
themselves are never changed. Everything is in the app's database, so `npm run backup` covers it
(face thumbnails and models rebuild/re-download on their own).
