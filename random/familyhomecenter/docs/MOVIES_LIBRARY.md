# 🎬 Movies section (the movies share)

**🎵 Fun → 🎬 Movies** (`/#/movies`) lists every video in the movies folder on the SMB share
(`/share/media/movies` by default) and in all its folders, including the home videos the
📥 Inbox files into `takk/<YYYY>/`.

- **Search** matches the title, the file name and the folder (all the words, any order, accents
  ignored).
- **Sort** by newest added, title, year, length, file size or folder. **↓/↑** flips the order.
- **Filter** with a folder button (📁 takk, 📁 Kids …) or a year.
- **Watch** in the browser by tapping a movie. You can skip around. The app remembers where you
  stopped on that screen and lists it under **▶ Keep watching**. **⬇ Download** saves the file.
  Browsers play `.mp4` / `.m4v` / `.mov` / `.webm`. `.mkv`, `.avi` and others are marked
  "download to watch" (VLC plays them).
- **Nothing on the share is ever changed.** The app only lists, reads and streams files. Poster
  pictures are made on the Pi in `server/data/movie-posters/`. Lengths and picture sizes (read once
  with ffprobe) are saved in a new `movie_library_info` table. No existing data changes.
- The list is re-read every 10 minutes, and **🔄** re-reads it right away. The first time, lengths
  and posters fill in over a few minutes, one file at a time.
- **Kids' access:** the section has its own switch, **Movies (watching)**, in Settings → Kids'
  access. A kid who already has a limited list gets no access until a parent ticks it.

## 1. Mount the share on the Pi

The Pi needs the share mounted, the same way as the photos share (docs/PHOTOS_SETUP.md). For
example, for a NAS share named `media`:

```
sudo mkdir -p /mnt/media
# /etc/fstab — one line:
//nas-ip-or-hostname/media /mnt/media cifs credentials=/etc/samba-family-photos.cred,iocharset=utf8,vers=3.0,uid=pi,gid=pi,x-systemd.automount,_netdev,rsize=1048576,wsize=1048576,cache=loose 0 0
sudo mount -a && ls /mnt/media/movies
```

Use `rw` (the default) so the 📥 Inbox can write converted videos into `movies/takk`.

## 2. Tell the app where the movies are

You write the location **as it is on the share**. The app reads `/proc/mounts` and finds where that
share is mounted on the Pi:

| You write | Mounted share | The Pi reads |
|---|---|---|
| `/share/media/movies` | `//nas/media` on `/mnt/media` | `/mnt/media/movies` |
| `/share/media/movies` | `//nas/share` on `/mnt/share` | `/mnt/share/media/movies` |
| `//nas/media/movies` or `\\nas\media\movies` | `//nas/media` on `/mnt/media` | `/mnt/media/movies` |

A folder that already exists on the Pi is used as it is.

Both folders are set in **⚙️ Settings → 🎬 Movies** (parents), which also shows whether the
Family Home Center can read each one, and why not if it can't:

- **Movies folder** — what the 🎬 Movies section lists. `MOVIE_LIBRARY_DIR=` in `.env` is the default.
  A plain Pi folder like `/mnt/movies` works too.
- **Home videos folder** — where the Inbox / 📤 Add photos files videos, by year. `VIDEOS_DIR=`
  (default `/share/media/movies/takk`) is the default.

If a folder can't be opened, the Movies page says why and checks again on every visit (and on 🔄),
so it clears up as soon as the share is mounted. Videos then **wait in the Inbox**: nothing is
written to the Pi's own disk by mistake.

### "Can't open the movies folder" but `ls` works for me

The server runs as its own user (`User=pi` in familyhomecenter.service), not as you or root. Test
as that user: `sudo -u pi ls /mnt/movies`. If that fails, the cifs mount needs
`uid=pi,gid=pi` (or `dir_mode=0755,file_mode=0644`) in its `/etc/fstab` options, then
`sudo umount /mnt/movies && sudo mount -a`.

## Which videos play in the browser

🎬 Movies **only lists what plays in the browser you're using**. Each browser checks the file type
and the video inside it, so an HEVC iPhone video shows in Safari but not in Chromium on the Pi.
The rest are behind **Also show N that don't play in this browser**, which you tick to download
them. The same video in several formats in one folder (`Holiday.mpg` + `Holiday.mp4`, `Clip.mov` +
`Clip.mp4`) is listed once, as the version that plays best (H.264 `.mp4` first), with
**⬇ Original** for the other one.


- **.mp4 / .mov with H.264 video** play everywhere.
- **.mp4 / .mov with HEVC video** (iPhones by default) play in Safari, and in Chrome / Edge on Mac
  and Windows when the computer's hardware can decode HEVC. They usually **don't** play in
  Chromium on the Pi or in Firefox on Linux. Download them and use VLC, or set the iPhones to
  **Settings → Camera → Formats → Most Compatible** (H.264).
- A `.mov` is sent to the browser as `video/mp4`, so Firefox and Chrome try it too.
- **⬇ Download as .mp4** (for a `.mov`): made while it downloads. The picture and sound are copied
  (only sound an `.mp4` can't hold is redone as AAC), with all the metadata: recorded date,
  location, camera, `com.apple.quicktime.*` tags, chapters and rotation. Nothing is saved on the
  Pi or the share.

## 🎞️ .mp4 copies of .mpg

`.mpg` / `.mpeg` (MPEG-2, from old camcorders and DVDs) doesn't play in browsers. So the Family Home
Center makes an `.mp4` copy next to each one: `Holiday 2004.mpg` → `Holiday 2004.mp4`.

- **Additive only.** The `.mpg` is never changed, moved or deleted, and a file that's already
  called `Name.mp4` is never replaced. The copy is written as a hidden `.part` file and renamed
  only when it's complete.
- It's re-encoded to H.264 + AAC, interlaced video is smoothed, and tags and chapters are carried
  over. The new file gets the original's file date, so "Recently added" doesn't change.
- 🎬 Movies lists it once: the `.mp4` plays, and **⬇ Original (MPG)** downloads the `.mpg`.
- One at a time, in the background, at low priority. On a Pi it takes about as long as the video.
  Progress, and anything that couldn't be copied, is shown in **Settings → 🎬 Movies**. You can
  switch it off there.
- The share has to be writable for the server's user. If it's read-only, Settings says so.

## 📀 DVDs → .mp4 (scripts/dvd_to_mp4.py)

For **unprotected** DVDs: home camcorder discs, DVDs you burned yourself, or a copied `VIDEO_TS`
folder. Store-bought movie DVDs are copy-protected (CSS). The script doesn't get around that: it
says so and stops.

```bash
python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD --list                         # the titles on it
python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD -o /mnt/media/movies/DVDs      # the main (longest) title
python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD --all --name "Wedding 2003" -o /mnt/media/movies/DVDs
# an .iso: sudo mount -o loop,ro disc.iso /mnt/iso — then point at /mnt/iso
```

- It only reads the disc. It never overwrites: if the name is taken, it writes `Name (2).mp4`.
  It writes to a hidden `.part` file and renames it when done.
- Output is H.264 + AAC with every sound track. Interlaced video is smoothed and 16:9 stays 16:9.
  DVD subtitles are pictures, which an `.mp4` can't hold, so they're left out.
- Write it into the movies folder and it shows up in 🎬 Movies.
- `--crf` (quality, default 20) and `--preset` (speed, default veryfast). On a Pi it takes roughly
  as long as the video. It's quicker on a PC (the script runs anywhere ffmpeg does).

## 🔄 Sideways videos

In the player, **↺ / ↻** turns a video recorded sideways (or upside down) the right way up. It's
saved for everyone, and the poster in the list turns too.

- **The file isn't changed.** Only how 🎬 Movies shows it is remembered, in the new
  `movie_rotation` table (no existing data changes). Downloads are the file as it is.
- A turned video gets its own control bar (▶/⏸, position, sound, ⛶ full screen), because the
  browser's own controls would turn sideways with the picture. Tap the picture to pause; double-tap
  for full screen.
- Turn it back to upright (↺/↻ round to 0°) for the browser's own controls again.

## 🐢 Slow or freezing while people watch

- **More file-reading threads.** Node reads files on a small pool of helper threads (4 by default). A
  movie streamed from the share keeps several of them waiting on the NAS, and two viewers could use
  them all up. Then everything else that reads files (pages, thumbnails, photos) had to wait, which
  looked like the Pi froze. It's now 32 (`UV_THREADPOOL_SIZE`, set in `server/src/threadpool.ts`
  and in `scripts/familyhomecenter.service`).
- **Bigger reads.** Movies are read 1 MB at a time (the share's own read size), not 64 KB.
- **Background work steps aside while anyone's watching.** The .mpg → .mp4 copier pauses, and
  reading lengths and making posters wait (posters go one at a time). "Watching" means a movie was
  sent in the last 30 seconds.
- **🩺 Pi health** (Settings → 🎬 Movies) shows who's watching, CPU load, temperature, memory, the
  network (link speed, and what's going in and out now), and whether the Pi is slowing itself down
  because it's too hot or short of power. It warns about the usual causes: a 100 Mbit or Wi-Fi link
  (every movie crosses it twice, NAS → Pi → viewer), heat, or a weak power supply.

## 📱 Plays on a computer, black on a phone

Phones decode video in hardware, which handles less than a computer's browser. The sound may
play over a black picture. In the player, **ℹ️ Video details** shows what's inside the file and
flags what phones often can't play:

- 10-bit or 4:2:2 picture
- interlaced video
- very high H.264 levels or bitrates
- HEVC (and HEVC tagged `hev1`)
- AC-3 / DTS sound

If a phone plays a video with no picture, the player says so after a few seconds.
