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
