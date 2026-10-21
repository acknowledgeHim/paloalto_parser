import fs from 'node:fs/promises';
import exifr from 'exifr';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db.js';
import { withDateFix } from './photoPlaces.js';

// Preference order: DateTimeOriginal (when the shutter actually fired) beats CreateDate/ModifyDate
// (which some cameras/phones/editors populate instead, or in addition) — any of them beats mtime,
// which is only "when this file was last copied/touched on disk", not when the photo was taken.
const EXIF_DATE_FIELDS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime'] as const;

// A photo's taken-date never changes once read, so cache it indefinitely by absolute path — the
// same "compute once, keep forever" approach as services/photos.ts's thumbnail cache. Without this,
// resolving a date-range selection re-parses EXIF for every photo in the library (over an SMB share,
// for a library of thousands) on every keystroke/date-pick, which is slow enough that the movie
// maker's "N photos match" preview can take a very long time to come back.
// Also kept in the database (photo_dates), so a restart doesn't mean re-reading every photo's EXIF
// over the share before Photos can sort by date.
const dateCache = new Map<string, Date>();
const sourceCache = new Map<string, string | null>();
let loadedFromDb = false;
const saveDate = db.prepare('INSERT OR REPLACE INTO photo_dates (path, taken_at, source) VALUES (?, ?, ?)');

function loadSavedDates(): void {
  if (loadedFromDb) return;
  loadedFromDb = true;
  for (const r of db.prepare('SELECT path, taken_at, source FROM photo_dates').all() as Array<{ path: string; taken_at: string; source: string | null }>) {
    const d = new Date(r.taken_at);
    if (!Number.isNaN(d.getTime())) {
      dateCache.set(r.path, d);
      sourceCache.set(r.path, r.source);
    }
  }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** A month in a folder name: "August", "aug", "Sept", "08", "8", "08 - August", "2025-08"… → 0–11. */
function monthOf(seg: string): number | null {
  const s = seg.trim().toLowerCase();
  const num = s.match(/^(?:(?:19|20)\d\d[ ._-]+)?(0?[1-9]|1[0-2])(?:$|[ ._-])/);
  if (num) return Number(num[1]) - 1;
  for (let m = 0; m < 12; m++) {
    const full = MONTHS[m];
    // A whole word only ("Marching band" isn't March).
    if (new RegExp(`^(${full}|${full.slice(0, 3)})(?![a-z])`).test(s)) return m;
    if (m === 8 && /^sept\b/.test(s)) return 8;
  }
  for (let m = 0; m < 12; m++) if (new RegExp(`\\b${MONTHS[m]}\\b`).test(s)) return m;
  return null;
}

/** The year (and month) a photo's folders say, e.g. 2025/August/IMG.jpg → 2025, 7. Relative to PHOTOS_DIR. */
export function folderDate(absolutePath: string): { year: number; month: number | null } | null {
  const parts = path.relative(config.photosDir, absolutePath).split(path.sep).slice(0, -1);
  for (let i = parts.length - 1; i >= 0; i--) {
    const y = parts[i].match(/^((?:19|20)\d\d)(?:$|[ ._-])/);
    if (!y) continue;
    const year = Number(y[1]);
    if (year > new Date().getFullYear() + 1) continue;
    // "2025/August", or "2025-08" / "2025 08 August" in one folder name.
    const rest = parts[i].slice(4).replace(/^[ ._-]+/, '');
    const month = rest ? monthOf(rest) : i + 1 < parts.length ? monthOf(parts[i + 1]) : null;
    return { year, month };
  }
  return null;
}

/**
 * The date when a photo has no date inside it. Its YEAR/Month folder decides; the file's own date
 * (often just when it was copied) is the last resort — used only for the day when it falls inside
 * that folder's month, or when there's no dated folder at all.
 */
async function dateWithoutExif(absolutePath: string): Promise<{ date: Date; source: 'folder' | 'file' }> {
  const mtime = (await fs.stat(absolutePath)).mtime;
  const f = folderDate(absolutePath);
  if (!f) return { date: mtime, source: 'file' };
  const fits = mtime.getFullYear() === f.year && (f.month === null || mtime.getMonth() === f.month);
  if (fits) return { date: mtime, source: 'file' };
  return { date: new Date(f.year, f.month ?? 0, 1, 12, 0, 0), source: 'folder' };
}

async function readDate(absolutePath: string): Promise<{ date: Date; source: 'exif' | 'folder' | 'file' }> {
  try {
    const exifDates = await exifr.parse(absolutePath, { pick: [...EXIF_DATE_FIELDS] });
    const d = EXIF_DATE_FIELDS.map((field) => exifDates?.[field]).find((x): x is Date => x instanceof Date && !Number.isNaN(x.getTime()));
    if (d) return { date: d, source: 'exif' };
  } catch {
    // Not every image has readable EXIF (PNG, a stripped/odd JPEG, etc.).
  }
  return dateWithoutExif(absolutePath);
}

/**
 * Best-effort "when was this photo actually taken": the photo's own EXIF date first (accurate even
 * if the file was later copied onto PHOTOS_DIR); with none, the YEAR/Month folder it's filed in
 * (2025/August) unless the file's own date already fits it; else the file's date. A year set by
 * hand (📍 photoPlaces.ts) wins over all of these. Read-only: never touches the photo file.
 */
export async function getPhotoDate(absolutePath: string): Promise<Date> {
  return withDateFix(absolutePath, await getOriginalPhotoDate(absolutePath));
}

/** What the photo (or its folder) says, before any hand-set year. */
export async function getOriginalPhotoDate(absolutePath: string): Promise<Date> {
  loadSavedDates();
  const cached = dateCache.get(absolutePath);
  if (cached) {
    if (sourceCache.get(absolutePath) != null) return cached;
    // Saved before the source was kept: if it doesn't fit its YEAR/Month folder, look once more
    // (it may have been the file's copy date, with no date inside the photo).
    const f = folderDate(absolutePath);
    const fits = !f || (cached.getFullYear() === f.year && (f.month === null || cached.getMonth() === f.month));
    if (fits) {
      sourceCache.set(absolutePath, 'unknown');
      return cached;
    }
  }
  const { date, source } = await readDate(absolutePath).catch(async () => ({ date: (await fs.stat(absolutePath)).mtime, source: 'file' as const }));
  dateCache.set(absolutePath, date);
  sourceCache.set(absolutePath, source);
  saveDate.run(absolutePath, date.toISOString(), source);
  return date;
}

/** Where a photo's date came from: 'exif', 'folder', 'file' (or 'unknown' for an old saved one). */
export function photoDateSource(absolutePath: string): string | null {
  loadSavedDates();
  return sourceCache.get(absolutePath) ?? null;
}
