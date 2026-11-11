# 📦 Photo & movie backups from the app

**⚙️ Settings → 📦 Photo & movie backups** (parents only). Back up the 📷 photo library, 🎬 home
videos, 🎞️ movie library, or any other folder — on the Pi or on a share mounted on the Pi — to
another folder, drive, mounted share, or an sftp / rest-server location. Each backup has its own
schedule (every night, once a week, or only when you press ▶).

This is separate from the Pi's own nightly backup of everything to the backup drive
(docs/STORAGE_DRIVES.md §9), which keeps running as it is (and now has ▶ / ⏰ buttons too, §9f).
Use these for **another copy somewhere else**: another drive, the NAS, a computer at a relative's
over sftp.

## Two ways

| | 🕰️ With history (restic) | 📁 Plain copy (rsync) |
|---|---|---|
| What's on the backup | A restic repository: dated, encrypted snapshots | Ordinary folders, one per thing backed up |
| Get a file back | 🕰️ History & restore: pick a day, browse or 🔎 find by name, ⤵️ restore | Open the folder on the backup drive |
| Space | Unchanged files take no extra space; each snapshot costs only what changed | One copy, plus old versions of replaced files |
| A file deleted or changed on the source | Still in every snapshot from before | Stays on the backup; the version that was replaced goes into `.fhc-older-versions/<date>/` |
| Needs | `sudo apt install -y restic`, and the 🔑 password | `rsync` (already on Raspberry Pi OS) |
| Where | A folder, `sftp:user@host:/path`, `rest:http://…` | A folder on the Pi (a drive or a mounted share) |

## Setting one up

1. **＋ New backup**: a name, how (🕰️ or 📁), what to back up (tick the library folders, or
   **＋ Another folder** with its full path, e.g. `/mnt/family-photos`), and where it goes.
2. **Where it goes** for 🕰️: a new or empty folder (the backup is created there the first time),
   or a folder that already has a restic backup — then put its password in 🔑.
3. **When**: every night or once a week at a time, or only by hand. If the Pi was off at that time,
   it runs as soon as it's back on. Pick a different time from the Pi's own backup (02:30).
4. 🕰️ only: **🩺 Check … every Sunday** (on by default) checks the backup can be read back, an
   hour and a half after the backup time. **Restore into** is where restores go (default: a
   `fhc-restored` folder next to the backup).
5. **🔑 Password** (🕰️): made for you. **Save a copy off the Pi** (Vaultwarden, paper). Without it,
   nobody can read the backup. It's also kept in the app's database, so the app's own backup has it.

The app runs as the `pi` user (not root), so the backup folder must be writable by `pi`
(`sudo mkdir -p /mnt/x/photos-history && sudo chown pi:pi /mnt/x/photos-history`). For sftp, `pi`
needs an SSH key the other computer accepts (`ssh-copy-id user@host`, then `ssh user@host` once
to accept its fingerprint).

## What it refuses to do, on purpose

- **Back up onto the Pi's own disk by accident.** If the folder is on the same disk as the Pi
  (usually because the backup drive isn't plugged in or mounted), the backup doesn't run and says
  why. Tick "It's OK that it's on the Pi's own disk" only if you mean it. The Pi's own backup
  drive (`/mnt/backup`) is only mounted while its nightly backup runs, so point these at a
  different drive or share.
- **Back up an empty or missing source** (a share that's down would look empty).
- **Put the backup inside what it's backing up**, or the other way round.
- **Delete anything.** No restic `forget`/`prune`, no `rsync --delete`. History only grows, so keep
  an eye on the "free of" space shown on each backup. To thin out old snapshots, do it by hand
  (docs/STORAGE_DRIVES.md §10 — the same commands, with `-r <the backup folder>`).
- **Restore over existing files.** Every restore makes a new dated folder in **Restore into**,
  keeping the full path (`…/2026-11-12_09-15-02_ab12cd34/share/photos/2019/…`). Look, then move
  things back yourself. It won't restore into a folder that's being backed up.
- **Write to the sources.** Photos, videos and shares are only read.

## Running, stopping, history

- **▶ Back up now** queues it; one backup runs at a time, at low priority so movies and the screens
  don't stutter. **⏹ Cancel** stops it cleanly (restic just doesn't make that snapshot; rsync keeps
  what it already copied).
- **📜 Past runs**: the last 50 backups, checks and restores, with what each did.
- **🗄️ Archive** takes a backup off the list and stops its schedule. Nothing it backed up is
  touched; **Show archived → ↩︎ Bring back** turns it on again.
- The first backup reads everything (many hours for terabytes). After that, only changes.

## Under the hood

server/src/services/backupJobs.ts (the runs, the queue, the checks above, the schedule — looked at
every minute), server/src/routes/backups.ts (`/api/backups`, parents only),
server/src/services/systemBackup.ts (the Pi backup's buttons), client/src/components/BackupJobs.tsx.
Tables: `backup_jobs`, `backup_job_keys`, `backup_runs` — new tables only; no existing data
changes. Set `RESTIC_BIN` / `RSYNC_BIN` in `.env` if they're not on the PATH.
