import fs from 'node:fs/promises';
import exifr from 'exifr';

// Preference order: DateTimeOriginal (when the shutter actually fired) beats CreateDate/ModifyDate
// (which some cameras/phones/editors populate instead, or in addition) — any of them beats mtime,
// which is only "when this file was last copied/touched on disk", not when the photo was taken.
const EXIF_DATE_FIELDS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime'] as const;

// A photo's taken-date never changes once read, so cache it indefinitely by absolute path — the
// same "compute once, keep forever" approach as services/photos.ts's thumbnail cache. Without this,
// resolving a date-range selection re-parses EXIF for every photo in the library (over an SMB share,
// for a library of thousands) on every keystroke/date-pick, which is slow enough that the movie
// maker's "N photos match" preview can take a very long time to come back.
const dateCache = new Map<string, Date>();

/**
 * Best-effort "when was this photo actually taken" — tries the file's own EXIF date fields first
 * (accurate even if the file was later copied/synced onto PHOTOS_DIR), falling back to the file's
 * mtime if there's no EXIF data at all (a screenshot, a PNG, a corrupted/stripped file, etc.).
 * Read-only: never writes to or otherwise touches the photo file itself.
 */
export async function getPhotoDate(absolutePath: string): Promise<Date> {
  const cached = dateCache.get(absolutePath);
  if (cached) return cached;

  let date: Date;
  try {
    const exifDates = await exifr.parse(absolutePath, { pick: [...EXIF_DATE_FIELDS] });
    date = EXIF_DATE_FIELDS.map((field) => exifDates?.[field]).find(
      (d): d is Date => d instanceof Date && !Number.isNaN(d.getTime())
    ) ?? (await fs.stat(absolutePath)).mtime;
  } catch {
    // Not every image has readable EXIF (PNG, a stripped/odd JPEG, etc.) — fall through to mtime.
    date = (await fs.stat(absolutePath)).mtime;
  }
  dateCache.set(absolutePath, date);
  return date;
}
