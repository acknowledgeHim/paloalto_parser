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

## .mov → .mp4 keeps the metadata

The conversion copies every file-level tag (recorded date, GPS location, camera make/model/software,
the `com.apple.quicktime.*` keys), per-stream tags, chapters, rotation, and all video and sound
tracks. It also keeps the iPhone's data tracks (timed location, Live Photo link) when the `.mp4` can
hold them. Afterwards the `.mp4`'s tags are compared with the `.mov`'s, and anything that didn't
make it is named in the filing log. The original `.mov` is always kept in `Inbox/Converted`.

## 3. ffmpeg

Posters, lengths and the `.mov` → `.mp4` conversion need ffmpeg: `sudo apt install -y ffmpeg`
(docs/MOVIES_SETUP.md). Without it the list still works, just without posters and lengths.
