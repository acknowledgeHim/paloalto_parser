# Backing up your data

Everything the dashboard manages lives in `server/data/` — one SQLite database plus a few folders
of uploaded files — and your settings live in the `.env` file. `scripts/backup-db.js` copies all of
it to a timestamped folder.

## What's included

| What | Where | Backed up |
|---|---|---|
| Family members, chores/to-dos, meals, recipes, Prize Bank, calendar events, settings | the database | always |
| Photo albums & favorites, photo documents (all their text, captions, pictures picked) | the database | always |
| Movies' details — photos, songs, captions, style — plus drafts and the screensaver choice | the database | always |
| Internet controls — devices, modes, schedules, sites, time limits, usage history, requests | the database | always |
| People (face recognition) — names, which faces are who, confirmations | the database | always |
| Avatar photos, completion-sound MP3s, Knowledge Base pictures/videos | `avatars/`, `sounds/`, `kb-media/` | always |
| Passwords and setup (Pi-hole, email, Spotify, calendars, …) | `.env` | always |
| Rendered movie videos | `movies/` | only with `--with-movies` |

Not included because they rebuild themselves: photo thumbnails, the blurry/duplicate analysis, face
thumbnails, and the face models (re-downloaded when needed).
Not included because they belong to something else: your photos and music themselves (they live on
PHOTOS_DIR / MUSIC_LIBRARY_DIR — back those up wherever they live), and Pi-hole's own setup (its
password and your router settings — everything *this app* put into Pi-hole can be rebuilt with
**Repair Pi-hole setup** on the Internet page).

## Run a backup

```bash
cd server
npm run backup          # everything except movie videos
npm run backup:all      # …and the movie videos too
```

This is safe to run **while the server is up** — it uses SQLite's online backup API, which takes a
consistent snapshot regardless of concurrent reads/writes (no need to stop the service first).

Output goes to `server/data/backups/<timestamp>/`:
- `familyhomecenter.db` — the full database, a complete standalone file
- `avatars/`, `sounds/`, `kb-media/` — uploads (only copied if you have any)
- `.env` — your settings and passwords, saved readable only by your user. **Treat backups like a
  password file** — be careful where you copy them.
- `movies/` — with `backup:all` only

**Why movies are optional:** videos are big, and 14 backups are kept. To keep that from filling the
SD card, each backup *links* to a movie already saved in the previous backup instead of copying it
again (a rendered movie never changes — editing one makes a new file). So nightly `backup:all`
only costs extra space for new or re-rendered movies. If space is still tight, run plain
`npm run backup` nightly and `backup:all` weekly — or skip movie backups entirely: every movie can
be re-rendered from its saved details with **✎ Edit → Update movie** (slow on a Pi, one at a time).

Old backups are pruned automatically, keeping the most recent 14 by default. Change that with
`node scripts/backup-db.js --keep 30` (add `--with-movies` to include movies), or edit the scripts
in `package.json`.

## Automate it (recommended)

Add a daily cron job on the Pi:

```bash
crontab -e
```

Add a line like (adjust the path to your actual clone location):

```
0 3 * * * cd /home/pi/paloalto_parser/random/familyhomecenter/server && npm run backup:all >> /home/pi/backup.log 2>&1
```

That runs a full backup (including movies) every night at 3am. Use `npm run backup` instead to
leave the movie videos out.

## Restoring from a backup

1. Stop the server: `sudo systemctl stop familyhomecenter`
2. Copy back what you want from the backup (`<timestamp>` = the folder name):
   ```bash
   cd server/data
   B=backups/<timestamp>
   cp $B/familyhomecenter.db .            # everything in the table above marked "the database"
   cp -r $B/avatars $B/sounds $B/kb-media .   # uploads (whichever are present)
   cp -r $B/movies .                      # movie videos, if this backup has them
   cp $B/.env ../../.env                  # settings — only if you've lost or broken yours
   ```
   Restoring just the database without `movies/`? Movies whose video file is missing show up but
   won't play — **✎ Edit → Update movie** re-renders them.
3. Start it again: `sudo systemctl start familyhomecenter`
4. If Pi-hole was reinstalled or reset too: Internet page → **Repair Pi-hole setup**.

## Getting a copy off the Pi

The `backups/` folder is just files — copy it anywhere you like for off-device safety, e.g.:

```bash
scp -r pi@familyhub.local:~/paloalto_parser/random/familyhomecenter/server/data/backups/<timestamp> ./
```

or sync the whole `backups/` folder to a NAS/cloud drive on whatever schedule you're comfortable
with.
