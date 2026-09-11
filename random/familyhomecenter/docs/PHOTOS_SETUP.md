# Photo slideshow setup

The slideshow reads image files (`.jpg`, `.jpeg`, `.png`, `.webp`) from the
directory named in `PHOTOS_DIR` (in `.env`), recursively — subfolders like
`PHOTOS_DIR/2024/vacation/` work fine. First load of each photo generates a
downsized, cached thumbnail (`server/data/thumbs/`) so slideshow playback stays
smooth even with large originals.

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
   //nas-ip-or-hostname/share-name /mnt/family-photos cifs credentials=/etc/samba-family-photos.cred,iocharset=utf8,vers=3.0,uid=pi,gid=pi,x-systemd.automount,_netdev 0 0
   ```

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

## HEIC photos (iPhone)

The scanner currently looks for `.jpg`/`.jpeg`/`.png`/`.webp`. If your family
shares photos straight from iPhones, either:
- turn on **Settings → Camera → Formats → Most Compatible** on the iPhones so
  they save as JPEG, or
- convert existing HEICs in bulk before copying them over, e.g. with
  `heif-convert` (`sudo apt install libheif-examples`).
