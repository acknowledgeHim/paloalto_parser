# 📲 Phone apps

🛠️ More → **📲 Phone apps** (`/#/apps`) installs the family's own phone apps
from the Pi, so phones on the home Wi-Fi don't need GitHub or an app store.
Right now that's **📱 SMB Sync** (`random/smbsync_app`). It copies or moves
photos, videos and files from a phone to a folder on an SMB share.

## Getting the files onto the Pi

The phone app is built by GitHub Actions (`.github/workflows/smbsync_app.yml`)
whenever its code changes, and published to the release `smbsync-latest`.

- **🔄 Get the latest build from GitHub** (parents): the Pi downloads
  `smbsync.apk` and `smbsync-unsigned.ipa` from that release. If the build on
  the Pi is already the newest one, it isn't downloaded again.
- **⬆️ Upload .apk / .ipa** (parents): put a file there by hand, e.g. one you
  built yourself.

Files go in `server/data/apps/<app>/` as `<app>-<platform>-<timestamp>.apk|.ipa`,
each with a small `.json` note saying where it came from. The newest one is
offered. Older ones are **never removed** — to roll back, move the newer file
out of that folder.

Use `APPS_GITHUB_REPO=owner/repo` in `server/.env` if the builds live in a
different repository (the default is `acknowledgeHim/paloalto_parser`).

## Installing

**Android**: open the page on the phone and tap **Install on Android**. Then
open the download, allow "install unknown apps" for the browser, and tap
Install.

**iPhone**: Apple doesn't let an iPhone install an app from a web page unless
the app is signed for that exact phone with a paid developer account. So:

1. Download the .ipa from this page on a **PC or Mac**.
2. Install it with **Sideloadly** (or AltStore), signing in with your Apple ID.
3. On the iPhone, trust your Apple ID (Settings → General → VPN & Device
   Management) and turn on Developer Mode (Settings → Privacy & Security).
4. With a free Apple ID, re-sign every 7 days. Sideloadly / AltStore can do it
   automatically when the phone is on the same Wi-Fi as the computer.

## Updates

Android only installs an update over the old app when both are signed with the
same key. Until the repo has the `SMBSYNC_KEYSTORE_BASE64` /
`SMBSYNC_KEYSTORE_PASSWORD` secrets (see `random/smbsync_app/README.md` →
"Android update signing"), each build has a different key. In that case,
uninstall SMB Sync before installing the new one, then enter the share again.
