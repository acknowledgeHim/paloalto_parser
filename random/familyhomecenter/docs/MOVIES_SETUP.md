# Movies setup

The **Photos → Movies** section turns a set of photos into a real video — pick them manually,
randomly, or by date taken, add music from the library, and it renders down to an MP4
saved on the server, ready to watch again anytime from any screen pointed at this app.

**Nothing about your original photos or music is ever touched.** Rendering only ever *reads* files
from `PHOTOS_DIR` and `MUSIC_LIBRARY_DIR` — the movie is a brand new file written under the
server's own data folder (`server/data/movies`), nothing is deleted, moved, or modified at the
source.

## 1. Install ffmpeg

This is the one real setup step — ffmpeg is a system program this app doesn't bundle or install
for you.

```
sudo apt update
sudo apt install -y ffmpeg
```

That's it on a Raspberry Pi / Debian / Ubuntu. Verify it worked:

```
ffmpeg -version
```

If `ffmpeg` isn't on your `PATH` for some reason (an unusual install location), point the app at
it directly in `.env`:

```
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

Restart the server after installing or changing this.

## 2. Use it

**Photos** → **Movies** → **+**. Pick a title, how to choose photos (a grid to pick from, a random
count, or a date range — "date taken" comes from each photo's EXIF data when it has any, falling
back to the file's own date otherwise), how many seconds each photo shows for, and optionally
add one or more tracks from the music library (search or browse; reorder with ↑/↓). The form shows
the movie's length as you go, plus a running total of the music you've added and how much more
you'd need to cover the whole thing. Hit **Create movie** — it starts
rendering in the background and shows up in the list right away as "Rendering…"; the page checks in
every few seconds and the entry switches to a **▶ Watch** button once it's done.

## Style options (all optional)

Under **Style** in the movie maker — all off by default, all changeable later with **✎ Edit**:

- **Between photos: Straight cut / Crossfade** — a one-second blend from each photo into the next
  (doesn't change the movie's length).
- **Motion: None / Slow pan & zoom** — each photo slowly zooms in or out, some panning sideways
  (the "Ken Burns" look). Takes noticeably longer to render on a Pi.
- **Opening title card** — the movie's title (plus an optional subtitle, e.g. "July 2026") on its
  own for 4 seconds at the start.
- **Captions** — with "Choose from the grid", tap **✎ Captions** to write a line under any picked
  photo. (With the other pick modes, pick first, then use Edit to caption.)
- **♫ Fit photos to the music** — appears once songs with known lengths are added; sets seconds
  per photo so the photos (plus title card and closing fade) last as long as the music.

## Screensaver movie (parents only)

A parent can tap **📺 Screensaver** on a finished movie to play it as the idle screensaver instead of
the photo slideshow — **Today**, **For a week**, or **Until I turn it off**, optionally **With
sound** (some browsers only allow sound once someone has tapped the screen; otherwise it plays
silently). The movie shows "📺 On the screensaver through …" with a **Stop** button. Tapping the
screen exits the screensaver as usual.

## Drafts (auto-save)

While making a **new** movie, the movie maker auto-saves what you've picked — title, photos,
songs, timing — every 30 seconds,
and again the moment you close it or the screen goes idle (the screensaver would otherwise throw
the form away). Unfinished movies show at the top of the Movies list with **Continue** and **✕**;
a draft is cleared once its movie is created or updated, and drafts untouched for 30 days are
cleaned up. Drafts live on the server, so you can start on the kiosk and finish on a phone.
Editing an existing movie doesn't auto-save — **Update movie** saves it, **Cancel** drops the changes.

## Editing a movie

Each movie remembers exactly which photos (in order) and songs it was made from, so **✎ Edit**
reopens the movie maker pre-filled: the grid shows the movie's photos picked, in **Movie order**
(the order they play), with any newly picked photos playing after them. Change the photos, songs,
seconds per photo, or title, then:

- **Update movie** re-renders it in place. The current version stays watchable until the new one
  is done; if the re-render fails, the movie keeps the previous version and shows why.
- **Save as new movie** leaves the original alone and makes a new one.

If some of a movie's photos can't be found right now — the photo share is offline, or a folder
was moved or renamed — the editor warns you, and **Update movie** asks before going ahead. Going
ahead makes the video from the photos it can see, but the missing ones **stay saved with the movie**
(in their places, with their captions): once they're findable again, Edit shows them picked and
Update puts them back in. If the share's just down, it's usually best to wait. Movies made before
this feature can't be edited, only deleted.

**Who can edit or delete:** whoever made the movie (whoever was picked in the profile switcher, or
logged in) or a parent — the list shows "by <name>". Like profile edits, this is enforced once
that person or a parent has a password set (see [SETTINGS_LOGIN.md](SETTINGS_LOGIN.md)); before
then it's on the honor system, with the buttons only shown to the creator or a parent.

## What to expect

- **It's not instant.** A Raspberry Pi encodes video in software (no shortcuts here — this app
  doesn't assume any particular Pi model's hardware encoder), so a few dozen photos can take
  anywhere from a minute to several minutes depending on the Pi. Movies are 1080p, built from the
  full-size original photos for the best quality — reading those over a network share is part of
  the wait. The page doesn't need to stay open while it renders — check back and it'll be there.
- **The look**: a plain, clean slideshow — each photo held for the time you set, a straightforward
  cut to the next one, with a brief fade in at the start and fade out at the end. No pans, zooms,
  or crossfades between photos in this version.
- **Music** plays in the order you added it. With music, the video fades to black right after the
  last photo and ends 4 seconds later, with the music fading out over the final 10 seconds —
  anything left over is cut. If the music runs out early it loops back to the first track. (No
  music = a silent video that simply ends with the last photo, which still works fine.)
- **Orientation**: photos are turned upright using their EXIF orientation tag (the same as the
  slideshow), so portrait shots from a phone don't come out sideways.
- **Storage**: each movie is its own MP4 file under `server/data/movies` — sized roughly like any
  video of that length/resolution (1080p). Delete ones you don't want from the Movies list to free
  up space; there's no automatic cleanup.

## Troubleshooting

- **A movie sits at "Rendering…" then flips to "Failed"** — tap it (or check the server log) for
  the reason. By far the most common cause is ffmpeg not actually being installed/found — see
  step 1.
- **"That selection matched no photos"** — for a date-range pick, remember it's filtering by when
  the photo was actually *taken* (EXIF), not when it was copied onto this Pi; a photo with no EXIF
  data at all falls back to its file's own date, which might not be what you expect for files
  synced long after the fact.
