# 💽 Two USB drives: the family share, and a backup the Pi runs itself

This turns the Pi 5 into the family's file server, with two 10 TB USB hard drives:

| Drive | Label | Mounted at | What it's for |
|---|---|---|---|
| **Share drive** | `FHC_SHARE` | `/share` | Replaces the old network share. Photos, movies, home videos, music; shared on the network with Samba. |
| **Backup drive** | `FHC_BACKUP` | `/mnt/backup`, **only while a backup runs** | Nightly versioned backups (restic) of the share drive **and** the Pi: the Family Home Center's database, uploads and `.env`, Vaultwarden, system settings. Never shared on the network. |

The Pi runs the backups itself: a systemd timer starts one every night and a weekly job checks the
backups and the drives' health. Each run writes a status file you can check (step 9).

> **Nothing here deletes anything.** Copying from the old share only reads it. The old share is
> left exactly as it is, as an extra copy, until *you* decide what to do with it. The backup job
> only **adds** snapshots. It never deletes or changes anything on the share or the Pi, and it never
> removes old snapshots (step 10 explains why and how you could change that).
>
> The only step that erases anything is **formatting the two new drives** (step 3). Read that step
> twice.

---

## 0. What to buy

- **Two 10 TB desktop USB drives that come with their own power brick**, e.g. WD Elements Desktop,
  WD My Book, Seagate Expansion Desktop. Every 10 TB drive is a 3.5" drive that needs 12 V, so the
  Pi can't power it over USB. Two of the same model is fine.
- **The official Raspberry Pi 27 W USB‑C power supply** (5 V / 5 A).
- **Recommended: a small UPS** (battery backup) for the Pi and both drives. A power cut in the
  middle of a write is the most common way a home server's disk gets corrupted.
- **Recommended: boot the Pi from an NVMe SSD** (M.2 HAT) instead of the SD card. SD cards are the
  part most likely to fail. Everything below works either way.
- A Pi 5 with **4 GB or 8 GB** of RAM. restic's memory use grows with how many files are backed up.

Plug **one drive into each blue USB 3 port**.

**Space:** both drives are 10 TB, so the backup drive has room for the share **plus its history**
only while the share stays well under that. Keep the share under about **8 TB**. The backup job
warns when the backup drive is over 85% full (step 9).

---

## 1. Install the tools

```bash
sudo apt update
sudo apt install -y samba restic smartmontools rsync tmux
```

---

## 2. Find the two new drives

Plug both in and power them on, then:

```bash
lsblk -o NAME,SIZE,MODEL,SERIAL,LABEL,FSTYPE,MOUNTPOINTS
```

You'll see something like:

```
NAME        SIZE MODEL              SERIAL         LABEL  FSTYPE MOUNTPOINTS
sda         9.1T Elements 25A3      57584B31...           
└─sda1      9.1T                                  Elements ntfs  /media/pi/Elements
sdb         9.1T Elements 25A3      57584B32...
└─sdb1      9.1T                                  Elements ntfs  /media/pi/Elements1
mmcblk0    59.5G                                                 
├─mmcblk0p1 512M                                  bootfs vfat   /boot/firmware
└─mmcblk0p2  59G                                  rootfs ext4   /
```

- `mmcblk0` (SD card) or `nvme0n1` (NVMe) is **the Pi's own system disk. Never touch it.**
- The two ~9.1T ones are the new drives. (10 TB on the box = 9.1 TiB here.) **Write down which
  serial number you want as the share and which as the backup**, and put a sticker on each drive.
- **If the old share's USB drive is also plugged into the Pi, unplug it now** so it can't be picked
  by mistake. You'll copy from it over the network, or plug it back in after step 3.

New drives often come with an NTFS partition that the desktop auto-mounts. Unmount them:

```bash
sudo umount /dev/sda1 /dev/sdb1 2>/dev/null
```

---

## 3. ⚠️ Format the two new drives (this erases them)

**This wipes the drive you name. Only run it on the two brand-new drives whose serials you wrote
down.** Check by serial first, every time, because `sda`/`sdb` can swap places after a reboot or
re-plug:

```bash
lsblk -o NAME,SIZE,SERIAL /dev/sda /dev/sdb
```

Then, for the **share** drive (here assumed `sda`, **change it to what you found**):

```bash
D=/dev/sda      # ← the SHARE drive, checked by serial
lsblk -o NAME,SIZE,MODEL,SERIAL "$D"   # last look: is this the new, empty share drive?
sudo parted "$D" --script mklabel gpt mkpart fhc_share ext4 0% 100%
sudo mkfs.ext4 -L FHC_SHARE -m 1 "${D}1"
```

And for the **backup** drive:

```bash
D=/dev/sdb      # ← the BACKUP drive, checked by serial
lsblk -o NAME,SIZE,MODEL,SERIAL "$D"
sudo parted "$D" --script mklabel gpt mkpart fhc_backup ext4 0% 100%
sudo mkfs.ext4 -L FHC_BACKUP -m 1 "${D}1"
```

From now on everything refers to the drives by **label** (`FHC_SHARE`, `FHC_BACKUP`), so it
doesn't matter which port or `sdX` name they get.

---

## 4. Mount them at boot

Find their UUIDs:

```bash
sudo blkid -s UUID -o value /dev/disk/by-label/FHC_SHARE
sudo blkid -s UUID -o value /dev/disk/by-label/FHC_BACKUP
```

Create the mount points and **lock them while empty**. `chattr +i` on an *unmounted* folder stops
anything from writing into it. If the share drive is ever missing, files then can't silently pile
up on the SD card instead. (Once the drive is mounted on top, the drive's own folder is what you
see and it's writable as normal.)

```bash
sudo mkdir -p /share /mnt/backup
sudo chattr +i /share /mnt/backup
```

Add two lines to `/etc/fstab` (`sudo nano /etc/fstab`), with your UUIDs:

```
UUID=<share-uuid>   /share       ext4  defaults,noatime,nofail,x-systemd.device-timeout=30s  0  2
UUID=<backup-uuid>  /mnt/backup  ext4  noauto,noatime,nofail                                 0  2
```

- `nofail`: the Pi still boots if a drive is unplugged.
- `noauto` on the backup: it's **not** mounted normally, only by the backup job while it runs. That
  keeps it out of reach of anything that goes wrong on the share (a mistaken delete, ransomware on a
  laptop) and lets it spin down.

Mount the share and set it up:

```bash
sudo systemctl daemon-reload
sudo mount /share
sudo chown pi:pi /share
sudo touch /share/.fhc-share-drive          # marker the backup job checks for
```

And mark the backup drive (it's mounted only for this, then unmounted):

```bash
sudo mount /mnt/backup
sudo touch /mnt/backup/.fhc-backup-drive    # marker the backup job checks for
sudo umount /mnt/backup
```

### If the drives drop off under load (UAS)

Some USB enclosures misbehave with Linux's fast USB storage mode (UAS). Signs: the drive vanishes,
or `dmesg` shows `uas_eh_abort_handler`, `reset SuperSpeed USB device` or I/O errors during big
copies. The fix is to turn UAS off for that enclosure only:

```bash
lsusb      # find the drive, e.g.  ID 1058:25a3 Western Digital Technologies, Inc. Elements Desktop
sudo nano /boot/firmware/cmdline.txt
# add at the END of the single line (space before it, same line):  usb-storage.quirks=1058:25a3:u
sudo reboot
```

Only do this if you actually see the problem. It makes the drive a little slower.

---

## 5. Lay out the share the same way as the old one

**Keep the same folder layout as the old share.** The Family Home Center stores photos *relative to*
`PHOTOS_DIR` (albums, faces, favourites, places), and movie/home-video locations are written as
paths on the share (e.g. `/share/media/movies/takk`). With the same layout under `/share`, all of
that carries over with no changes in the app.

For example, if the old NAS had shares `media` and `photos`:

```bash
mkdir -p /share/media /share/photos
```

A location the app has saved as `/share/media/movies` now exists as a real folder on the Pi, so
the app uses it directly. See `server/src/services/sharePaths.ts`: *"A folder that already exists on
the Pi is used as it is."*

---

## 6. Copy everything over from the old share (read-only)

Mount the old share **read-only** (`ro`), so nothing can change it during the copy. If it's
already mounted for the app (e.g. `/mnt/media`, `/mnt/family-photos`, see PHOTOS_SETUP.md /
MOVIES_LIBRARY.md), add a second, read-only mount just for copying:

```bash
sudo mkdir -p /mnt/old-media
sudo mount -t cifs //nas-ip-or-hostname/media /mnt/old-media \
  -o ro,credentials=/etc/samba-family-photos.cred,iocharset=utf8,vers=3.0,uid=pi,gid=pi
ls /mnt/old-media     # looks right?
```

(If the old share is a USB drive on your router, it's much faster to unplug it from the router
and plug it into the Pi, then mount it read-only: `sudo mount -o ro /dev/sdX1 /mnt/old-media`.
Check `lsblk` first so you know which `sdX` it is.)

Copy inside `tmux` so it keeps going if your SSH session drops. At ~100 MB/s over gigabit,
**8 TB takes about a day**:

```bash
tmux new -s copy
rsync -rt --info=progress2 --partial /mnt/old-media/ /share/media/
# Ctrl-b then d to leave it running;  tmux attach -t copy  to look again
```

- **No `--delete`.** rsync only adds and updates files on the new drive. It never removes
  anything, and it only reads the old share.
- `-rt` = folders and modification times. (Owners/permissions from a NAS don't mean anything on
  the Pi. Samba gives everything to `pi` in step 7.)
- It's safe to stop and run the same command again. It picks up where it left off.

Repeat for each share (e.g. `photos`). Then **check** the copy. This dry run compares every file by
content and lists anything that differs (no output = identical). It's slow, so leave it in tmux:

```bash
rsync -rtcn --itemize-changes /mnt/old-media/ /share/media/
```

Keep the old share untouched. It's your third copy until you've been running on the new drive for
a while.

---

## 7. Share it on the network (Samba)

Add the Pi's user to Samba (this is the password phones and computers use to connect):

```bash
sudo smbpasswd -a pi
```

Edit `/etc/samba/smb.conf` (`sudo nano /etc/samba/smb.conf`). In the `[global]` section add these
lines (they make it play nicely with Macs, iPhones and iPads):

```
   vfs objects = fruit streams_xattr
   fruit:metadata = stream
   fruit:model = MacSamba
   fruit:posix_rename = yes
   fruit:veto_appledouble = no
   fruit:wipe_intentionally_left_blank_rfork = yes
   fruit:delete_empty_adfiles = yes
   min protocol = SMB2
```

Then add one block per share **with the same names as the old shares**, so on every phone and
computer you only change the server's address:

```
[media]
   path = /share/media
   read only = no
   valid users = pi
   force user = pi
   force group = pi
   create mask = 0664
   directory mask = 0775

[photos]
   path = /share/photos
   read only = no
   valid users = pi
   force user = pi
   force group = pi
   create mask = 0664
   directory mask = 0775
```

`force user = pi` makes every file written over the network belong to `pi`, the user the Family
Home Center runs as, so the app can always read and write them.

**Don't let Samba start without the drive** (otherwise it would share the empty folder):

```bash
sudo mkdir -p /etc/systemd/system/smbd.service.d
printf '[Unit]\nRequiresMountsFor=/share\n' | sudo tee /etc/systemd/system/smbd.service.d/share.conf
sudo systemctl daemon-reload
testparm -s && sudo systemctl restart smbd
```

Connect from a computer: `\\familyhub.local\media` (Windows) or `smb://familyhub.local/media` (Mac,
iPhone Files app). Use the Pi's hostname or IP.

---

## 8. Switch the Family Home Center and devices over

When the copy is checked:

1. **Photos:** in `.env`, point `PHOTOS_DIR` at the same folder on the new drive, e.g.
   `PHOTOS_DIR=/share/photos` (it was e.g. `/mnt/family-photos`). Same folders inside → albums and
   faces carry over.
2. **Movies / home videos:** nothing to change if they're saved as `/share/media/...`. Those
   folders now exist on the Pi. Check **Settings → 🎬 Movies**: the folder shown should read without
   a "not mounted" warning.
3. **Music:** if `MUSIC_LIBRARY_DIR` pointed at the old share, point it at the new folder.
4. Restart: `sudo systemctl restart familyhomecenter`.
5. **Camera clip backups** (Cameras → 💾 Storage → SMB share): point it at the Pi's own share, e.g.
   `//localhost/media` with folder `cameras`, or leave it on the old NAS. Your choice.
6. **Phones (📱 SMB Sync) and computers:** change the server address to the Pi.
7. Optional, later: comment out (`#`) the old share's `cifs` lines in `/etc/fstab`. They aren't
   needed once nothing uses them. Leave the old share's files where they are.

Do one final top-up copy right before switching phones over, the same `rsync -rt` as step 6, to
catch anything added during the move.

---

## 9. The Pi's nightly backup (restic)

restic keeps **dated snapshots**: you can get back any file as it was on any night, even one
deleted or overwritten weeks ago. Files that didn't change take no extra space, so nightly snapshots
of a mostly-unchanging photo library cost almost nothing after the first.

### 9a. Create the backup repository

Make a password. **Without it the backups can't be read by anyone, including you.** Save a copy in
Vaultwarden and on paper.

```bash
sudo sh -c 'umask 077; openssl rand -base64 30 > /root/.restic-password'
sudo cat /root/.restic-password     # ← save this somewhere off the Pi NOW

sudo mount /mnt/backup
sudo RESTIC_PASSWORD_FILE=/root/.restic-password restic -r /mnt/backup/restic init
sudo umount /mnt/backup
```

### 9b. The backup script

Save as `/usr/local/sbin/fhc-backup` (`sudo nano /usr/local/sbin/fhc-backup`). Adjust `APP` if
the project lives somewhere else.

```bash
#!/bin/bash
# 💾 Family Home Center — nightly backup of the share drive and the Pi to the backup drive.
# Only ever ADDS a snapshot. Never deletes or changes anything on /share or the Pi, and never
# removes old snapshots.
set -uo pipefail

APP=/home/pi/paloalto_parser/random/familyhomecenter
APP_USER=pi
SHARE=/share
BACKUP=/mnt/backup
STATE=/var/lib/fhc-backup
export RESTIC_REPOSITORY=$BACKUP/restic
export RESTIC_PASSWORD_FILE=/root/.restic-password
export RESTIC_CACHE_DIR=$BACKUP/.restic-cache     # keeps restic's cache off the SD card

mkdir -p "$STATE"
exec > >(tee "$STATE/last.log") 2>&1
echo "=== backup started $(date -Is)"

status() { printf '{"result":"%s","message":"%s","finished_at":"%s","backup_drive_used_pct":%s}\n' \
  "$1" "$2" "$(date -Is)" "${USED:-null}" > "$STATE/status.json"; }
fail() { echo "❌ $*"; status failed "$*"; mountpoint -q "$BACKUP" && umount "$BACKUP"; exit 1; }

# 1. The backup drive: mount it and make sure it really is the backup drive.
mountpoint -q "$BACKUP" || mount "$BACKUP" || fail "Backup drive didn't mount. Is it plugged in and switched on?"
[ -f "$BACKUP/.fhc-backup-drive" ] || fail "$BACKUP is not the backup drive (no .fhc-backup-drive marker)"

# 2. The share drive must be there, so a missing drive isn't backed up as an empty folder.
mountpoint -q "$SHARE" && [ -f "$SHARE/.fhc-share-drive" ] || fail "The share drive isn't mounted at $SHARE"

# 3. A consistent copy of the app's database, uploads and .env (docs/BACKUP.md) into
#    server/data/backups/. Safe while the app is running.
sudo -u "$APP_USER" bash -c "cd '$APP/server' && npm run --silent backup" || fail "npm run backup (the app's database copy) failed"

# 4. Lists for rebuilding the Pi from a fresh Raspberry Pi OS.
dpkg --get-selections > "$STATE/dpkg-selections.txt"
apt-mark showmanual > "$STATE/apt-manual.txt"
crontab -u "$APP_USER" -l > "$STATE/crontab-$APP_USER.txt" 2>/dev/null || true

# 5. The snapshot. --one-file-system: don't wander into other mounts (e.g. an old cifs share
#    mounted under /home or /mnt); the drives and folders listed are each included on purpose.
restic unlock >/dev/null 2>&1 || true    # clears only a stale lock from a run that was cut off
PATHS=("$SHARE" /etc /home /root /usr/local /opt /boot/firmware "$STATE")
[ -d /var/lib/vaultwarden ] && PATHS+=(/var/lib/vaultwarden)
restic backup --tag nightly --one-file-system --exclude-caches \
  --exclude "$APP/server/data/familyhomecenter.db" \
  --exclude "$APP/server/data/familyhomecenter.db-wal" \
  --exclude "$APP/server/data/familyhomecenter.db-shm" \
  --exclude 'node_modules' --exclude '/home/*/.cache' --exclude '/home/*/.npm' --exclude '/root/.cache' \
  "${PATHS[@]}"
RC=$?
#    (the live database is excluded on purpose: step 3's copy in server/data/backups/ is the
#    consistent one.)
case $RC in
  0) MSG="Backed up" ;;
  3) MSG="Backed up, but some files couldn't be read (see $STATE/last.log)" ;;
  *) fail "restic backup failed (exit $RC). See $STATE/last.log" ;;
esac

# 6. How full is the backup drive?
USED=$(df --output=pcent "$BACKUP" | tail -1 | tr -dc '0-9')
[ "$USED" -ge 85 ] && MSG="$MSG. ⚠️ Backup drive is ${USED}% full"

sync
umount "$BACKUP" || echo "(couldn't unmount $BACKUP; it'll be unmounted next run)"
[ $RC -eq 0 ] && [ "$USED" -lt 85 ] && status ok "$MSG" || status warning "$MSG"
echo "=== $MSG — finished $(date -Is)"
```

```bash
sudo chmod 700 /usr/local/sbin/fhc-backup
```

### 9c. The weekly check script

Save as `/usr/local/sbin/fhc-backup-check`. It reads back a random 2% of the backup data each week
(about 200 GB, so the whole backup gets read over about a year) and asks both drives for their
health (SMART).

```bash
#!/bin/bash
# 🩺 Weekly: is the backup readable, and are both drives healthy? Read-only.
set -uo pipefail
BACKUP=/mnt/backup
STATE=/var/lib/fhc-backup
export RESTIC_REPOSITORY=$BACKUP/restic RESTIC_PASSWORD_FILE=/root/.restic-password RESTIC_CACHE_DIR=$BACKUP/.restic-cache
mkdir -p "$STATE"
exec > >(tee "$STATE/check.log") 2>&1
RESULT=ok; MSG=""

mountpoint -q "$BACKUP" || mount "$BACKUP" || { RESULT=failed; MSG="Backup drive didn't mount. "; }
if [ "$RESULT" = ok ]; then
  restic check --read-data-subset=2% || { RESULT=failed; MSG+="restic check found a problem (see $STATE/check.log). "; }
fi

for LABEL in FHC_SHARE FHC_BACKUP; do
  PART=$(readlink -f "/dev/disk/by-label/$LABEL" 2>/dev/null) || { MSG+="$LABEL not found. "; RESULT=failed; continue; }
  DISK=/dev/$(lsblk -no PKNAME "$PART")
  H=$(smartctl -d sat -H "$DISK" 2>&1)
  if grep -q PASSED <<<"$H"; then MSG+="$LABEL healthy. "
  elif grep -q -i FAIL <<<"$H"; then MSG+="⚠️ $LABEL SMART says FAILING, replace it soon. "; RESULT=failed
  else MSG+="$LABEL: health unknown (this USB case doesn't pass SMART through). "; fi
done

sync; mountpoint -q "$BACKUP" && umount "$BACKUP"
printf '{"result":"%s","message":"%s","finished_at":"%s"}\n' "$RESULT" "$MSG" "$(date -Is)" > "$STATE/check.json"
echo "=== $RESULT: $MSG"
```

```bash
sudo chmod 700 /usr/local/sbin/fhc-backup-check
```

### 9d. Run them on a schedule (systemd timers)

```bash
sudo tee /etc/systemd/system/fhc-backup.service >/dev/null <<'EOF'
[Unit]
Description=Family Home Center nightly backup (share + Pi → backup drive)
After=local-fs.target network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/fhc-backup
Nice=10
IOSchedulingClass=idle
EOF

sudo tee /etc/systemd/system/fhc-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Nightly Family Home Center backup
[Timer]
OnCalendar=*-*-* 02:30
Persistent=true
RandomizedDelaySec=10m
[Install]
WantedBy=timers.target
EOF

sudo tee /etc/systemd/system/fhc-backup-check.service >/dev/null <<'EOF'
[Unit]
Description=Family Home Center weekly backup + drive health check
After=fhc-backup.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/fhc-backup-check
Nice=10
IOSchedulingClass=idle
EOF

sudo tee /etc/systemd/system/fhc-backup-check.timer >/dev/null <<'EOF'
[Unit]
Description=Weekly Family Home Center backup check
[Timer]
OnCalendar=Sun *-*-* 05:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now fhc-backup.timer fhc-backup-check.timer
```

- `Persistent=true`: if the Pi was off at 2:30, the backup runs as soon as it's back on.
- `IOSchedulingClass=idle`: the backup gives way to the Family Home Center and Samba, so movies
  and the screens don't stutter while it runs.

**Run the first one by hand.** The first snapshot reads everything (~8 TB ≈ 15–24 hours on a Pi 5).
After that, nights only cost a few minutes.

```bash
sudo systemctl start --no-block fhc-backup.service
journalctl -fu fhc-backup        # watch it (Ctrl-C stops watching, not the backup)
```

### 9e. Is it working?

```bash
cat /var/lib/fhc-backup/status.json    # last nightly backup: ok / warning / failed + message
cat /var/lib/fhc-backup/check.json     # last weekly check
systemctl list-timers 'fhc-*'          # when they run next
```

List the snapshots:

```bash
sudo mount /mnt/backup
sudo RESTIC_PASSWORD_FILE=/root/.restic-password restic -r /mnt/backup/restic snapshots
sudo umount /mnt/backup
```

---

## 10. Why old snapshots are never removed (and how to change it)

The backup job never runs `restic forget`/`prune`, so anything that was ever backed up stays
recoverable: a photo deleted by accident two years ago is still in an old snapshot. The cost is
that the backup drive slowly fills with everything the share ever held. For a photo/movie library
that mostly only grows, that's close to the size of the share itself.

When the status says the backup drive is over 85% full, the choices are:

- **A bigger backup drive** (e.g. 16–20 TB): copy the repository across with
  `restic copy` (see `restic help copy`). Nothing is lost.
- **Or** thin out old snapshots by hand, deciding then what to keep, e.g.
  `restic forget --keep-daily 30 --keep-weekly 12 --keep-monthly 36 --keep-yearly 20 --prune`.
  This permanently deletes **old snapshots** (never the share), so run it once with `--dry-run` and
  read the list first.

---

## 11. Getting files back

Mount the backup drive first (`sudo mount /mnt/backup`) and set:

```bash
export RESTIC_REPOSITORY=/mnt/backup/restic RESTIC_PASSWORD_FILE=/root/.restic-password
```

| I want to… | Command |
|---|---|
| See what's in a snapshot | `sudo -E restic ls latest /share/photos/2019` |
| Find a file by name | `sudo -E restic find 'IMG_1234*'` |
| Get one folder back as it was last night | `sudo -E restic restore latest --target /share/restored --include /share/photos/2019/Summer` |
| …as it was on a certain day | `sudo -E restic snapshots`, then `restore <snapshot-id> …` |
| Browse every snapshot like folders | `sudo apt install -y fuse3 && sudo mkdir -p /mnt/restic && sudo -E restic mount /mnt/restic` (other terminal: `ls /mnt/restic/snapshots`). If it complains about `fusermount`, use `ls`/`restore` instead. |

Restores go into a **new** folder (`/share/restored/...`), so nothing existing is overwritten. Move
things back yourself once you've looked.

### The share drive died

1. New drive → steps 3–4 (label it `FHC_SHARE`, mount at `/share`, create the marker).
2. `sudo -E restic restore latest --target / --include /share`. This writes the files back to
   their original paths on the empty new drive. Expect about a day for 8 TB.
3. `sudo chown -R pi:pi /share`, then `sudo systemctl restart smbd familyhomecenter`.

### The Pi (SD card / NVMe) died

1. Flash a fresh Raspberry Pi OS. Follow docs/PI_SETUP.md to install the Family Home Center again.
2. `sudo apt install -y restic samba smartmontools` and put the saved password back in
   `/root/.restic-password` (`chmod 600`).
3. Restore the Pi's files to a side folder, then copy back what you need:
   `sudo -E restic restore latest --target /root/pi-restore --include /etc --include /home --include /var/lib/vaultwarden --include /var/lib/fhc-backup`
4. The app's data: the newest folder in
   `/root/pi-restore/home/pi/paloalto_parser/random/familyhomecenter/server/data/backups/`.
   Restore it as described in docs/BACKUP.md → *Restoring from a backup*.
5. Re-create `/etc/fstab` lines, `smb.conf` and the backup scripts/timers from the copies under
   `/root/pi-restore/etc/` and `/root/pi-restore/usr/local/sbin/` (or this guide). The package list
   is in `/root/pi-restore/var/lib/fhc-backup/apt-manual.txt`.
   Don't copy all of `/etc` back blindly; take the files you need.

### Both drives are in the same house

A fire, theft, flood or power surge can take both drives at once. For what can't be replaced
(photos, home movies), keep **one more copy somewhere else**:

- **A third drive, swapped monthly** and kept at a relative's or at work: make it a second restic
  repository and `restic copy` into it when it's plugged in.
- **Or cloud:** restic can back up straight to Backblaze B2 / S3 (about $6/TB a month), e.g. a
  second nightly `restic backup /share/photos /share/media/movies/takk` to a B2 repository. Only the
  irreplaceable folders, to keep the cost down.

---

## Quick reference

| What | Where |
|---|---|
| Share drive | label `FHC_SHARE`, `/share`, marker `/share/.fhc-share-drive` |
| Backup drive | label `FHC_BACKUP`, `/mnt/backup` (mounted only during backups), marker `.fhc-backup-drive` |
| Backup password | `/root/.restic-password` (**+ a copy off the Pi**) |
| Scripts | `/usr/local/sbin/fhc-backup`, `/usr/local/sbin/fhc-backup-check` |
| Schedule | `fhc-backup.timer` nightly 02:30 · `fhc-backup-check.timer` Sundays 05:00 |
| Status | `/var/lib/fhc-backup/status.json`, `check.json`, `last.log`, `check.log` |
| Run now | `sudo systemctl start --no-block fhc-backup` |
| App's own backup | docs/BACKUP.md (`npm run backup`, run by the nightly job) |
