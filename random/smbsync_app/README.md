# SMB Sync — phone → SMB share (Android & iPhone)

A small Flutter app that copies or moves files from your phone to a folder on an
SMB share (Windows share, Synology / QNAP / TrueNAS, Samba on Linux / a Pi).

- **Set up the share once**: server, share, folder (created if it doesn't exist,
  or pick it with the 📂 browser), username / password (kept in the phone's
  secure storage), and an optional domain. You can paste `\\nas\share\folder`
  or `smb://nas/share/folder` into the Server box. **Test connection** checks it
  can actually write there.
- **Find files**
  - *Photos & videos* (the gallery): photos, videos or both, by **date taken**
    (date range, From / To, Last 30 days, This year, Older than 1 year),
    optional file type (`heic jpg`) and name.
  - *Files*: searches the whole phone storage (Android) or a folder you pick
    (iPhone: e.g. *On My iPhone › Downloads*), sub-folders included, by type
    (`pdf`, or tap a preset: PDF, Documents, Pictures, Videos, Music,
    Archives), name and **date modified**.
- Results start with **everything selected** — *Select all / Select none*, or
  untick single files. Shows the count and total size.
- **Copy** — files go to the share, nothing on the phone changes.
- **Move** — same, then each file is removed from the phone **only after it is
  confirmed on the share with the same size**. Anything that failed stays on
  the phone. Photos/videos: the phone asks you to confirm the removal (iPhone
  keeps them in *Recently Deleted* for 30 days).
- **Sync photos & videos since …** — one tap for everything new since the last
  run. With the default "skip if same size" rule, files already on the share
  are not sent again, so it works as a sync.
- Optional date sub-folders on the share: `2024/`, `2024/07/` (default) or
  `2024/07/15/`.
- If the same name is already on the share: skip it when it's the same size
  (default), always keep both (`IMG_1 (1).jpg`), or replace it.
- Uploads are written as `.name.smbsync-part`, size-checked, then renamed, so
  a half-sent file never sits on the share under its real name. A dropped
  connection is retried once per file.

## Getting the app

GitHub Actions builds both apps on every push that touches this folder
(`.github/workflows/smbsync_app.yml`) and puts them on the release
**smbsync-latest**:
<https://github.com/acknowledgeHim/paloalto_parser/releases/tag/smbsync-latest>

### Android

1. On the phone, open the link above and download **smbsync.apk**.
2. Open it; allow "Install unknown apps" for your browser when asked.
3. In the app: ⚙️ → enter the share → **Test connection** → Save.
4. First *Files* search asks for **All files access** (needed to see PDFs,
   Downloads, etc.). First *Photos* search asks for photo access.
5. Optional (Android 12+): ⚙️ → *Let "Move" remove photos without asking each
   time* → turn SMB Sync on under *Media management apps*.

### iPhone

Apple only lets apps from the App Store, TestFlight or your own Apple ID onto
an iPhone, so the build is an **unsigned .ipa** that you sign with your
Apple ID when installing:

1. On a Windows PC or Mac install **Sideloadly** (sideloadly.io) — or AltStore.
2. Download **smbsync-unsigned.ipa** from the release.
3. Plug the iPhone in, drag the .ipa into Sideloadly, sign in with your Apple ID,
   Start.
4. On the iPhone: Settings → General → VPN & Device Management → trust your
   Apple ID. iOS 16+: Settings → Privacy & Security → **Developer Mode** on.
5. Open SMB Sync, allow **Local Network** (needed to reach the share) and
   photo access.

With a free Apple ID the app must be re-signed every **7 days** (Sideloadly /
AltStore can do this automatically); a paid developer account ($99/yr) makes
it a year.

Files on iPhone: iOS has no "whole phone" file system. *Files* searches the
folder you pick in the Files picker (On My iPhone, iCloud Drive folders that
are downloaded, etc.); SMB Sync's own folder also shows up in the Files app
under *On My iPhone › SMB Sync*.

## Limits

- SMB 2.0 / 2.1 (and SMB1). Shares that **require SMB3 encryption** won't
  connect — on Windows that's `Set-SmbShare -EncryptData $false` for that
  share; on Samba `smb encrypt = desired` (not `required`).
- Keep the app open (the screen stays on) while it's sending: phones pause
  apps in the background, iPhone especially.
- The share's file date is the upload time; the photo's own date is still
  inside the photo (EXIF) and in the date sub-folder.

## Android update signing (optional, once)

Without this, every build is signed with a different throwaway key and
Android refuses to install an update over the old app (you'd have to
uninstall first and enter the share again). To keep one key:

```bash
mkdir -p ~/smbsync-release-key && cd ~/smbsync-release-key
PW=$(openssl rand -hex 16); echo "$PW" > password.txt
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes -subj "/CN=SMB Sync" -keyout key.pem -out cert.pem
openssl pkcs12 -export -name smbsync -inkey key.pem -in cert.pem -out smbsync.p12 -passout pass:$PW
rm key.pem
base64 -w0 smbsync.p12 | gh secret set SMBSYNC_KEYSTORE_BASE64 -R acknowledgeHim/paloalto_parser
printf %s "$PW" | gh secret set SMBSYNC_KEYSTORE_PASSWORD -R acknowledgeHim/paloalto_parser
```

Keep `~/smbsync-release-key` backed up. Then re-run the workflow
(Actions → SMB Sync app → Run workflow). Uninstall the first (debug-signed)
version once; after that, updates install over it.

## Building locally

Needs Flutter 3.47 (+ Android SDK; Xcode on a Mac for iPhone):

```bash
cd random/smbsync_app
tool/setup_platforms.sh     # generates android/ and ios/ (not committed) with the permissions
flutter pub get
flutter test
flutter run                 # phone connected
flutter build apk --release
```

## Code

| File | What |
|---|---|
| `lib/main.dart` | Home: destination, Sync button, search form |
| `lib/settings_screen.dart` | Share settings, test, share/folder browser |
| `lib/scanner.dart` | Gallery search (photo_manager) and folder search |
| `lib/results_screen.dart` | Results, select all / none, Copy / Move |
| `lib/transfer.dart` | Upload loop, retries, safe removal from the phone |
| `lib/transfer_screen.dart` | Progress |
| `lib/smb_service.dart` | SMB (smb_connect, pure Dart): folders, .part upload, size check, rename |
| `lib/paths.dart` | Pure helpers (tested in `test/paths_test.dart`) |
| `tool/setup_platforms.sh` | `flutter create` + AndroidManifest / Info.plist / gradle patches |
