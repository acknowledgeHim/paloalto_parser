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

- **Sort** — Library order, Date taken (newest / oldest first), or Folder / filename. Each photo's
  date is read once and remembered (even across restarts); the very first time on a big library
  that takes a while, and the page says *Reading photo dates…* until the sort can apply.
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

## Tabs: Photos, Movies, Animate, Documents

The Photos page has four tabs across the top. **Movies**, **Animate**, and **Documents** each list
what the family has made, with **Sort** (newest, oldest, title, by owner, longest/shortest — for
documents, most/fewest pictures) and an **Owner** filter. "By owner" splits the list under each
person's name. Each entry shows its length, the date it was made, and who made it.

## Living photos (✨ Animate)

Bring one photo to life as a short clip that loops seamlessly: open a photo and tap **✨** in the
viewer (or **+** on the Animate tab), then pick:

- **Movement** — 🔍 *Zoom to faces* (moves in on the people and back out), 🌊 *Gentle drift* (a
  slow pan), 🌄 *3-D depth* (glides into the scene — a depth map of the photo makes near things move
  more than far ones), or 📷 *Still* (only painted areas and floating things move).
- **Animated areas** (optional) — 🖌️ paint over part of the photo and pick what it is: 💧 flowing
  water (choose which way it flows), 🔥 flames, 🌿 sway (leaves, grass), 🌫️ shimmer (heat haze, a
  pool), ☁️ drifting clouds (paint the sky), or 💡 twinkle (lights, glints). Up to six areas; paint
  just that part — anything painted moves. A brush-size slider and an eraser help.
- **Floating over it** — nothing, ✨ sparkles, ❄️ snow, 🌧️ rain, 💖 hearts, 🫧 bubbles, or 🌸 petals.
- **Length** — 5, 8, or 12 seconds.

**The depth map** comes from *Depth Anything V2 Small* (Apache-2.0, 27 MB), downloaded once from
Hugging Face the first time a 🌄 3-D clip is made (pinned to one version and checked by its hash),
then run on the Pi like the face models — the photo never leaves it. Without internet that first
time, 3-D falls back to lifting just the people (found by face recognition).

It's made on the Pi (one at a time, a few minutes each — 3-D and painted areas take longest; the list shows progress) using the faces
face recognition found, if it's on. A finished clip can be watched, downloaded, played as the
**📺 screensaver**, or made someone's **🙂 avatar** — a small square cut around the faces that plays
on the bigger avatar spots (Family Board, profile) and shows as a still in small ones. Needs ffmpeg,
like movies (docs/MOVIES_SETUP.md). The photo itself is only read, never changed.

## A photo as your avatar

In the photo viewer, **🙂** makes that photo the avatar of whoever is picked in **Who's this?**
(the button only shows once someone is). It's cropped square around their face if it's named
after them in People, otherwise around the biggest face, otherwise the middle of the photo.

## On this day

When there are photos taken on today's date in past years, the Dashboard shows an **On this day**
strip ("3 years ago"). Tap one to see it full size; **🙈 Hide** there hides it (same as hiding it on
the Photos page). Hidden photos never show here — nor do near-identical copies of them (see
*Blurry photos and duplicates*), and of a set of copies only one shows. The strip refreshes every
few minutes, so a photo hidden on another screen drops out on its own.

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
4. Once someone has a name, their other photos show up as suggestions. Each person's card shows
   how many faces are **confirmed** and how many are **to check**; tap the card to see both —
   **To check — is this Sam?** (yellow border: ✓ / ✗, or **Yes to all shown**) and then
   **Confirmed Sam** (60 at a time, **Show more** for the rest).
   A suggestion is only made when one person is a clear match — if two people (say, siblings) look
   about equally likely, it doesn't guess.
   To choose someone's picture on the People page, open them and tap ⭐ on one of their faces
   (otherwise the clearest, biggest one is used).
5. **Right in the photo viewer** (Photos → open any photo), the faces in that photo show along the
   bottom — handy when you know who's in a particular photo:
   - an unnamed face: **Who's this?** to name it (a new name adds that person), or 🚫 to ignore it;
   - a suggestion ("Sam?"): ✓ or ✗;
   - a named face: tap the name (✎) to change it to someone else, or **Not Sam** to un-name it
     (either way it stops suggesting Sam for that face);
   - **+ Someone else** — for people in the photo whose face wasn't found: the back of their head,
     a side view, too small or blurry. Type or pick a name; they show as a chip with × to take it off.
     There's no face to learn from, so this doesn't help suggestions — it just counts the photo as
     theirs (and their People card shows *N tagged*). A face rescan never removes these.
6. Then: **Person** filter on the Photos page, **See their photos** on someone's People card, and
   **With a person** as a way to pick photos for movies and documents — including photos they're
   tagged in with **+ Someone else**.
   **Person → Nobody** shows the photos with no one named or tagged in them yet (an unconfirmed
   "Sam?" suggestion doesn't count) — handy for finding who's left to add.

**Someone not showing up in the groups yet?** Groups only hold clear, front-on, not-too-small faces,
and only the biggest groups are shown — so someone with fewer photos (or mostly in the background)
can be missing. Start them yourself: open a photo of them in the viewer and tap **Who's this?** on
their face (or find one under **Name faces photo by photo**). After 3–5 names from different ages,
their other photos start showing up under **To check** on their card.

**Photos that can't be read** (damaged, empty, or e.g. an iPhone HEIC saved as `.jpg`) are skipped
and counted as looked at — the People page shows *N couldn't be read*; tap it for the list and a
**Try them all again** button. A photo that takes more than 3 minutes to read (a stuck network share)
is skipped too, so one bad file can't stall the rest.

**Speed with a big library:** after a server restart the Pi works out everyone's suggestions once
in the background (a few seconds to a minute or so, depending on library size); after that, naming
or confirming only re-checks what changed.

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

**Turning it off** stops scanning; names and tags are kept (turn it back on to carry on).

**How it finds faces:** each photo is looked at whole, and big photos also in four overlapping
quarters, so small faces in group shots are found too (photos scanned before this get a one-time
top-up in the background — the People page shows its progress; names already given are kept).
Overnight (11pm–6am) scanning uses all four cores, so it goes faster when nobody's using the screen.
Someone is only suggested once per photo, and never for a face in a photo where they're already
named. **Duplicate copies** of a photo (a resized copy, a re-save, a burst) share names: naming,
ignoring, or "Not them" on one copy applies to the same face in the others, and the extra copies'
faces don't show up in the naming lists.

**Managing people** — tap someone on the People page, then:
- **✏️ Rename** — fix or change their name (a name someone else already has is refused; combine instead).
- **🔗 Combine with someone…** — the same person named twice ("Sam" and "Samuel"): pick the other
  one and which name should stay. Their confirmed faces, "+ Someone else" tags, and "not them"
  answers all become one person.
- **🗑️ Delete** — removes the name only: their faces go back to unnamed and their hand tags go away.

Photos themselves are never changed. Everything is in the app's database, so `npm run backup` covers it
(face thumbnails and models rebuild/re-download on their own).

## 📍 Where photos were taken, and the 🗺️ map

- **GPS:** many phone photos carry their GPS position (latitude and longitude) in the photo's EXIF
  data. The Family Home Center reads it once per photo, in the background with the dates, and keeps
  it in its database (`photo_gps`). The photo files are only ever read, never changed.
- **Country and US state:** worked out on the Pi itself from built-in borders
  (`server/geo/places.json`, from Natural Earth, which is public domain). **No photo location is
  sent anywhere.** A photo taken on a beach or just offshore still counts for the nearest country
  within about 25 km.
- **In the photo viewer:** a 📍 line shows the state and country, the date, and the GPS numbers. The
  numbers are a link to OpenStreetMap, which opens only if you tap it.
- **Fixing it by hand (✏️):** set the country (and the state, in the US) when the photo has no GPS,
  or the year (and month) when its date is wrong, for example a scanned print or a camera with the
  wrong clock.
  - Saved only in the database (`photo_place_edits`). The photo file isn't changed.
  - A fixed year counts everywhere: sorting, On this day, and movies.
  - "Use what the photo says" goes back to the original.
- **Photos page:**
  - Sort by **📍 Country** or **📍 State** (photos with no location last).
  - The **📍 Where** filter picks a country or US state, or **No location set**, to find the
    photos that still need one.
- **Progress:** the top of the 🗺️ Map tab shows how far reading has got ("Reading where photos
  were taken: 1,234 of 5,000"), with a bar that updates by itself until it's done, then how many
  photos have GPS, a place, or no location. Face recognition progress is on 👥 People.
- **🗺️ Map tab:**
  - Every photo with a place is a circle on a map drawn right on the page, with no outside map
    service. Hollow circles are photos placed by a hand-set country or state.
  - Drag to move; scroll, pinch or use ＋/－ to zoom.
  - Tap a circle to see its photos, then "Show all from … in Photos".

## 📁 Settings → Photo library (parents only)

This section shows `PHOTOS_DIR` and, if it's on a network share, the share it's mounted from and
its `/etc/fstab` line.

- **💾 Save what's set up now** keeps those details in the database, along with your own notes.
- **How to set it up again** gives the exact commands for rebuilding the mount the same way on a
  new or rebuilt Pi.
- The share password is never stored there. It belongs only in the credentials file on the Pi;
  keep a copy in your password manager.

## 📤 Add photos and 📥 the Inbox: new photos filed as YEAR/Month

New photos go into the library as `<PHOTOS_DIR>/<YEAR>/<Month>/`, by the date they were taken.

- **The date** comes from the photo itself (EXIF). If the photo has no date: for 📤 Add photos it's
  the date the phone gives the file; for the Inbox it's the file's own date.
- **Month folders:** an existing folder for that month is used whatever it's called (`Aug`,
  `aug`, `August`, `Sept`). A new one is always the full name with a capital first letter
  (`August`).
- **Nothing is ever deleted:**
  - Filing from the Inbox *moves* the photo (a rename on the share), so it's never lost and never
    stored twice.
  - An exact copy of a photo already in that month folder is moved to `Inbox/Duplicates/`
    instead.
  - Two different photos with the same name are both kept (`IMG_1.jpg`, `IMG_1 (2).jpg`).
- **The share must be writable.** Use the `rw` mount (the default), with `uid=`/`gid=` set to the
  user the Family Home Center runs as. The share account also needs write permission on the NAS.
  Settings → 📁 Photo library warns if it can't write.

### 📤 Add photos (any phone, tablet or computer)

1. Photos → **📤 Add photos** → **📷 Pick photos**, and choose as many as you like.
2. Each photo shows where it went (`✓ 2025 / August`) or "Already there".

On an iPhone, the browser usually turns HEIC photos into JPG as it sends them. A HEIC file that
arrives as HEIC is filed, but the Pi can't show HEIC in Photos. Setting the iPhone to
**Settings → Camera → Formats → Most Compatible** avoids that.

### 📥 The Inbox (automatic, with a sync app on the phone)

The Inbox is `<PHOTOS_DIR>/Inbox`. You can change it in **Settings → 📁 Photo library → 📥 Inbox**.

- Every 5 minutes, the photos in it (and in any folders inside it) are filed.
- A file copied in during the last minute waits for the next round.
- Videos and other files are left where they are.
- The Inbox never shows in the photo library.
- **Settings → 📁 Photo library → 📥 Inbox** has a switch for this, **Sort the Inbox now**, and a
  list of what was filed and where.

A web page can't copy photos off a phone by itself. For automatic copying, install a sync app that
uploads the camera roll to the **Inbox** folder on the share over SMB:

- **Android: FolderSync** (or Autosync, or PhotoSync)
  1. Add an **SMB** account: the NAS address, share, username and password.
  2. Make a folder pair: phone `DCIM/Camera` → share `Inbox`, set to **To remote folder**
     (one-way, upload only).
  3. Schedule it, for example hourly, on Wi-Fi only.
  4. **Turn off any "delete source after sync" option.**
- **iPhone (and Android): PhotoSync**
  1. Add an **SMB** target (the NAS) and choose the `Inbox` folder.
  2. Turn on **Autotransfer**. iOS limits background apps, so the most reliable triggers are
     "when charging" (an iOS Shortcuts automation) or arriving home.
  3. Set it to send JPG (or turn on its HEIC → JPG conversion).
- Several phones can all upload into the same Inbox. Name clashes and duplicates are handled.
