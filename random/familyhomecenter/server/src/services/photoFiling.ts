import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db, getSetting } from '../db.js';
import { photosChanged, skipFolderInLibrary } from './photos.js';

/**
 * 📥 Filing new photos into the library as <YEAR>/<Month>/ — from the 📥 Inbox folder on the share
 * (where a phone's sync app such as PhotoSync / FolderSync uploads), and from 📤 Add photos in the app.
 *  - The date comes from the photo's EXIF (when it was taken), else the date the phone gave the
 *    file (uploads), else the file's own date.
 *  - Month folder: an existing one for that month is used whatever it's called ("Aug", "august",
 *    "August"); a new one is always the full name with a capital first letter ("August").
 *  - Nothing is ever deleted. Filing from the Inbox is a move (a rename on the share — the photo is
 *    never lost and never stored twice). An exact copy of a photo already in its month folder is
 *    moved to Inbox/Duplicates instead. Every step is written to photo_filings (Settings → 📁).
 */

export const PICTURE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EXIF_DATES = ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'ModifyDate', 'DateTime'];

export const inboxDir = () => getSetting('photo_inbox_dir') || path.join(config.photosDir, 'Inbox');
export const autoSortOn = () => getSetting('photo_inbox_auto') !== 'off';

/** The Inbox (and its Duplicates folder) never show in the library. */
export function registerInbox() {
  skipFolderInLibrary(inboxDir());
}

/** Which name an existing folder for month m (0–11) has, if any: full, 3-letter, or "Sept" — any case. */
export function matchMonthFolder(names: string[], m: number): string | null {
  const full = MONTHS[m].toLowerCase();
  const ok = new Set([full, full.slice(0, 3), ...(m === 8 ? ['sept'] : [])]);
  return names.find((n) => ok.has(n.trim().toLowerCase().replace(/\.$/, ''))) ?? null;
}

/** The folder a photo taken at `when` goes in: <PHOTOS_DIR>/<YYYY>/<Month>, made if needed. */
export async function monthFolder(when: Date): Promise<string> {
  const yearDir = path.join(config.photosDir, String(when.getFullYear()));
  await fs.mkdir(yearDir, { recursive: true });
  const names = (await fs.readdir(yearDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const existing = matchMonthFolder(names, when.getMonth());
  const dir = path.join(yearDir, existing ?? MONTHS[when.getMonth()]);
  if (!existing) await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** When was it taken? EXIF first; then the date the phone gave (uploads); then the file's date. */
export async function takenDate(file: string, hint?: number | null): Promise<{ date: Date; from: 'photo' | 'phone' | 'file' }> {
  try {
    const tags = await exifr.parse(file, { pick: EXIF_DATES });
    const d = EXIF_DATES.map((k) => tags?.[k]).find((v): v is Date => v instanceof Date && !Number.isNaN(v.getTime()) && v.getFullYear() > 1900);
    if (d) return { date: d, from: 'photo' };
  } catch {
    /* no EXIF */
  }
  if (hint && hint > 0) return { date: new Date(hint), from: 'phone' };
  return { date: (await fs.stat(file)).mtime, from: 'file' };
}

async function sha1(file: string): Promise<string> {
  const h = crypto.createHash('sha1');
  for await (const chunk of fsSync.createReadStream(file)) h.update(chunk as Buffer);
  return h.digest('hex');
}

/** Is an identical file already in this folder? (Only same-size files are read.) */
async function sameIn(dir: string, file: string): Promise<string | null> {
  const size = (await fs.stat(file)).size;
  let hash: string | null = null;
  for (const name of await fs.readdir(dir)) {
    const other = path.join(dir, name);
    const st = await fs.stat(other).catch(() => null);
    if (!st?.isFile() || st.size !== size) continue;
    hash ??= await sha1(file);
    if ((await sha1(other)) === hash) return name;
  }
  return null;
}

/** A name not used yet in `dir`: IMG_1.jpg, IMG_1 (2).jpg, … */
async function freeName(dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  for (let i = 1; ; i++) {
    const n = i === 1 ? name : `${base} (${i})${ext}`;
    if (!(await fs.stat(path.join(dir, n)).catch(() => null))) return n;
  }
}

/** Move without ever losing it: a rename; across disks, copy then rename the original aside into Inbox/Filed. */
async function moveSafely(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    await fs.copyFile(from, to, fsSync.constants.COPYFILE_EXCL);
    const keep = path.join(inboxDir(), 'Filed');
    await fs.mkdir(keep, { recursive: true });
    await fs.rename(from, path.join(keep, await freeName(keep, path.basename(from))));
  }
}

export interface FilingResult {
  name: string;
  result: 'filed' | 'duplicate' | 'error';
  dest: string | null;
  taken_at: string | null;
  date_from: string | null;
  note: string | null;
}

function record(r: FilingResult, source: 'inbox' | 'upload', by: string | null) {
  db.prepare(
    `INSERT INTO photo_filings (id, at, source, original_name, dest_path, taken_at, date_from, result, note, by_member)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), new Date().toISOString(), source, r.name, r.dest, r.taken_at, r.date_from, r.result, r.note, by);
}

/** File one picture that's sitting in the Inbox (or was just uploaded there). */
export async function fileOne(file: string, source: 'inbox' | 'upload', by: string | null = null, dateHint?: number | null, name = path.basename(file)): Promise<FilingResult> {
  let r: FilingResult;
  try {
    const { date, from } = await takenDate(file, dateHint);
    const dir = await monthFolder(date);
    const rel = (p: string) => path.relative(config.photosDir, p);
    const twin = await sameIn(dir, file);
    if (twin) {
      const dupDir = path.join(inboxDir(), 'Duplicates');
      await fs.mkdir(dupDir, { recursive: true });
      await fs.rename(file, path.join(dupDir, await freeName(dupDir, name)));
      r = { name, result: 'duplicate', dest: rel(path.join(dir, twin)), taken_at: date.toISOString(), date_from: from, note: 'Already in the library — moved to Inbox/Duplicates' };
    } else {
      const target = path.join(dir, await freeName(dir, name));
      await moveSafely(file, target);
      // No date inside the photo: give the new file the phone's date, so the library sorts it right too.
      if (from === 'phone') await fs.utimes(target, date, date).catch(() => {});
      r = { name, result: 'filed', dest: rel(target), taken_at: date.toISOString(), date_from: from, note: null };
    }
  } catch (err) {
    r = { name, result: 'error', dest: null, taken_at: null, date_from: null, note: (err as Error).message.slice(0, 300) };
  }
  record(r, source, by);
  return r;
}

let sorting = false;
/** File everything waiting in the Inbox (not its Duplicates/Filed folders). */
export async function sortInbox(by: string | null = null): Promise<{ filed: number; duplicates: number; errors: number; left: number }> {
  const out = { filed: 0, duplicates: 0, errors: 0, left: 0 };
  if (sorting) return out;
  sorting = true;
  try {
    const dir = inboxDir();
    await fs.mkdir(dir, { recursive: true });
    registerInbox();
    const walk = async (d: string): Promise<string[]> => {
      const items = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
      const files: string[] = [];
      for (const it of items) {
        const p = path.join(d, it.name);
        if (it.isDirectory()) {
          if (d === dir && (it.name === 'Duplicates' || it.name === 'Filed')) continue;
          files.push(...(await walk(p)));
        } else if (!it.name.startsWith('.')) files.push(p);
      }
      return files;
    };
    for (const f of await walk(dir)) {
      if (!PICTURE_EXTS.has(path.extname(f).toLowerCase())) {
        out.left++;
        continue;
      }
      // Still being copied in by the phone? Leave it for the next round.
      const st = await fs.stat(f).catch(() => null);
      if (!st || Date.now() - st.mtimeMs < 60_000) {
        if (st && Date.now() - st.mtimeMs < 60_000) out.left++;
        continue;
      }
      const r = await fileOne(f, 'inbox', by);
      if (r.result === 'filed') out.filed++;
      else if (r.result === 'duplicate') out.duplicates++;
      else out.errors++;
    }
    if (out.filed) photosChanged();
    if (out.filed || out.duplicates || out.errors) console.log(`[photos] 📥 Inbox: ${out.filed} filed, ${out.duplicates} duplicate(s), ${out.errors} problem(s).`);
  } finally {
    sorting = false;
  }
  return out;
}

/** Can the Family Home Center write into the photos folder (needed to file anything)? */
export async function canWrite(): Promise<boolean> {
  try {
    await fs.access(config.photosDir, fsSync.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function startInboxSorting(): void {
  registerInbox();
  const tick = () => {
    if (autoSortOn() && fsSync.existsSync(inboxDir())) void sortInbox().catch((e) => console.warn('[photos] Inbox sort failed:', e));
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 5 * 60_000);
}
