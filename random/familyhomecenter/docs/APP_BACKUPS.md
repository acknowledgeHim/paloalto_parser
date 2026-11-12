# 📦 Photo & movie backups from the app

**⚙️ Settings → 📦 Photo & movie backups** (parents only). Back up the 📷 photo library, 🎬 home
videos, 🎞️ movie library, or any other folder — on the Pi or on a share mounted on the Pi — to
another folder, drive, mounted share, or an sftp / rest-server location. Each backup has its own
schedule (every night, once a week, or only when you press ▶).

This is separate from the Pi's own nightly backup of everything to the backup drive
(docs/STORAGE_DRIVES.md §9), which keeps running as it is (and now has ▶ / ⏰ buttons too, §9f).
Use these for **another copy somewhere else**: another drive, the NAS, a computer at a relative's
over sftp.

## 🧰 What to install

- **🕰️ With history:** restic — `sudo apt install -y restic`.
- **📁 Plain copy:** rsync — already on Raspberry Pi OS (`sudo apt install -y rsync` if not).
- **Backing up to or from a share:** the share mounted on the Pi (`sudo apt install -y cifs-utils`;
  docs/PHOTOS_SETUP.md, Option B). **To sftp:** an SSH key for the `pi` user (`ssh-copy-id`).
- Settings shows ⚠️ when restic or rsync is missing.

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
3. **When**: **every night, right after the Pi's own backup** (the default when the Pi's backup is
   set up), every night or once a week at a time, or only by hand. If the Pi was off at that time,
   it runs as soon as it's back on. **The Pi's own backup always goes first**: while it runs, these
   backups and checks wait their turn, and start as soon as it's done (restores don't wait). If
   the Pi's own backup isn't set up, "right after" runs at the time you pick instead. A first
   backup that takes days may still be going when the next night's Pi backup starts. Both then
   run at once, with this one at low priority.
4. 🕰️ only: **🩺 Check … every Sunday** (on by default) checks the backup can be read back, an
   hour and a half after the backup time. **Restore into** is where restores go (default: a
   `fhc-restored` folder next to the backup).
5. **🔑 Password** (🕰️): made for you. **Save a copy off the Pi** (Vaultwarden, paper). Without it,
   nobody can read the backup. It's also kept in the app's database, so the app's own backup has it.

The app runs as the `pi` user (not root), so the backup folder must be writable by `pi`
(`sudo mkdir -p /mnt/x/photos-history && sudo chown pi:pi /mnt/x/photos-history`). For sftp, `pi`
needs an SSH key the other computer accepts (`ssh-copy-id user@host`, then `ssh user@host` once
to accept its fingerprint).

## A USB drive plugged into the Pi (e.g. /mnt/exthdd_backup)

Do this once on the Pi, over SSH or in a terminal. It only mounts the drive. **It never formats or
erases it**, and whatever is already on the drive stays there.

1. **Find the drive:** `lsblk -f`. Look for the new disk (usually `sda`) and its partition
   (`sda1`), note its **FSTYPE** (ext4, exfat or ntfs), and run `sudo blkid /dev/sda1` to get its
   **UUID**. Don't use `mmcblk0…` (the Pi's SD card) or the drive that holds `/`.
2. **For NTFS only:** `sudo apt install -y ntfs-3g`. ext4 and exFAT need nothing.
3. **Make the folder and add one line to `/etc/fstab`.** First copy fstab with
   `sudo cp /etc/fstab /etc/fstab.before-exthdd`, then run `sudo mkdir -p /mnt/exthdd_backup` and
   add the line for your FSTYPE with `sudo nano /etc/fstab`, putting your UUID in place of
   `XXXX-XXXX`:

   ```
   # ext4
   UUID=XXXX-XXXX  /mnt/exthdd_backup  ext4   defaults,nofail,x-systemd.device-timeout=10s  0  2
   # exfat
   UUID=XXXX-XXXX  /mnt/exthdd_backup  exfat  defaults,nofail,uid=pi,gid=pi,umask=022,x-systemd.device-timeout=10s  0  0
   # ntfs
   UUID=XXXX-XXXX  /mnt/exthdd_backup  ntfs-3g  defaults,nofail,uid=pi,gid=pi,umask=022,x-systemd.device-timeout=10s  0  0
   ```

   `nofail` means the Pi still starts normally when the drive is unplugged.
4. **Mount it and test:** `sudo systemctl daemon-reload && sudo mount -a`. Then
   `findmnt /mnt/exthdd_backup` should name the drive, and `df -h /mnt/exthdd_backup` should show
   the drive's size, not the SD card's. If `mount -a` prints an error, fix the line before you
   reboot.
5. **Give the app a folder on it:** `sudo mkdir -p /mnt/exthdd_backup/familyhomecenter`. For ext4,
   also run `sudo chown pi:pi /mnt/exthdd_backup/familyhomecenter`. exFAT and NTFS are already
   owned by `pi` through `uid=pi`. Check that `pi` can write there:
   `sudo -u pi touch /mnt/exthdd_backup/familyhomecenter/.ok && echo writable`.
6. **Reboot once** (`sudo reboot`) and check `findmnt /mnt/exthdd_backup` again. The drive should
   mount on its own from now on. If it was plugged in after start-up, run `sudo mount -a`.

**Then in the app:** ⚙️ Settings → 📦 Photo & movie backups → **＋ New backup**:

- **🕰️ With history (recommended):** tick 📷 Photos, 🎬 Home videos and 🎞️ Movie library, and
  set **Where it goes** to `/mnt/exthdd_backup/familyhomecenter/history`. The app creates the
  backup there the first time. Choose **Every night, right after the Pi's own backup**, so the Pi's
  backup (02:30) goes first and this one follows. Then **🔑 save the password somewhere off the Pi.**
- **📁 Plain copy** instead, if you'd rather open the files straight from the drive on a computer:
  set **Where it goes** to `/mnt/exthdd_backup/familyhomecenter/copy`. Each library gets its own
  folder there.

Press **▶ Back up now** for the first run, which takes a long time. If the drive is ever
unplugged, `/mnt/exthdd_backup` becomes an ordinary folder on the SD card again. The backup then
refuses to run (*“on the Pi’s own disk … is the backup drive plugged in and mounted?”*) instead
of filling up the SD card. **Leave “It’s OK that it’s on the Pi’s own disk” unticked.**

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
