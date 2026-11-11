# 📲 Uploading photos and videos from an iPhone by date

There are two ways to do it. Both file photos into `YEAR/Month` and videos into the movies folder
(`/share/media/movies/takk/YYYY`, where a `.mov` becomes an `.mp4`). Neither adds a file twice.

## 🧰 What to install

- **On the Pi:** `ffmpeg`, so videos get their date and `.mov` becomes `.mp4`
  (`sudo apt install -y ffmpeg`). Photos need nothing extra.
- **On the iPhone:** the built-in Shortcuts app (option 2). It needs an HTTPS address it trusts
  (docs/LETSENCRYPT_SETUP.md, or Caddy from docs/ANDROID_TABLET_SETUP.md).

## 1. In the app: 📤 Add photos → 📅 Only add ones taken between…

1. Photos → **📤 Add photos**.
2. Tick **📅 Only add ones taken between…**. Pick **From** and **To**, or tap a quick pick: Today,
   Last 7 days, This month, Last month or This year. Either date can be left empty.
3. Tap **📷 Pick photos & videos** and select a big batch. In the iPhone picker, drag a finger
   across the thumbnails to select many at once.
4. The phone reads each file's date and **sends only the ones taken on those days**. The others
   show "Skipped — taken 3 Jun 2025" and are never uploaded.

The Pi checks the date again with the date it files by. That covers files the phone couldn't read
a date from. Anything outside the range is thrown away: that's only the uploaded copy, and nothing
on the phone or in the library is touched.

Safari can't search the photo library by date by itself. You still pick, and the filter does the
rest. To skip picking, use the Shortcut.

## 2. An iPhone Shortcut (no picking; can run by itself)

Make it once in the **Shortcuts** app. The same steps are shown in 📤 Add photos, under
"📲 iPhone: send a date range with a Shortcut".

1. **+** → add **Ask for Input**: Input Type *Date*, prompt "From". Add a second one for "To".
2. **Find Photos** → *Add Filter*: `Date Taken` `is between` *From* and *To* (the two answers).
   Turn **Limit** off.
3. **Repeat with Each** (the Photos). Inside it, **Get Contents of URL**:
   - URL: `https://<the address you open the app with>/api/photos/upload`
   - Method: **POST**
   - Request Body: **File** → *Repeat Item*
   - Headers:
     - `x-filename` = *Repeat Item* → **Name**
     - `x-taken` = *Repeat Item* → **Date Taken** (tap it → Date Format → **ISO 8601**)
     - optional: `x-acting-member` = the family member's id, so Settings shows who added it
4. Run it on the home Wi-Fi.

**Run it automatically:** Shortcuts → **Automation** → **+** → *Charger: Is Connected* (or *Time
of Day*) → run the shortcut. Replace the two *Ask for Input* steps with **Adjust Date** (*Current
Date*, subtract 2 days) and **Current Date**. Already-filed photos are recognised as duplicates.

### What the upload endpoint accepts

`POST /api/photos/upload`, with the file as the raw body (not a form). Headers:

| Header | |
|---|---|
| `x-filename` | The name. The extension is added or corrected from the file's first bytes (e.g. `IMG_1234` → `IMG_1234.heic`, or a JPEG called `.heic` → `.jpg`). |
| `x-taken` or `x-last-modified` | A fallback date (any date text / ms) if the file has none inside. |
| `x-only-from`, `x-only-to` | `YYYY-MM-DD`. Files taken outside these days are not added (`"result": "skipped"`). |
| `x-acting-member` | Who added it (shown in Settings → 📁 Photo library → 📥 Inbox). |

Uploads are written straight to disk, not held in memory, so long 4K videos are fine. Up to 20 GB
per file.

**HTTPS:** if the app uses the Pi's own certificate (Caddy's local CA), the iPhone must trust it
first (docs/ANDROID_TABLET_SETUP.md covers installing it), or Shortcuts refuses the address.
