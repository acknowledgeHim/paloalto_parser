import fs from 'node:fs/promises';
import exifr from 'exifr';

// Preference order: DateTimeOriginal (when the shutter actually fired) beats CreateDate/ModifyDate
// (which some cameras/phones/editors populate instead, or in addition) — any of them beats mtime,
// which is only "when this file was last copied/touched on disk", not when the photo was taken.
const EXIF_DATE_FIELDS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime'] as const;

/**
 * Best-effort "when was this photo actually taken" — tries the file's own EXIF date fields first
 * (accurate even if the file was later copied/synced onto PHOTOS_DIR), falling back to the file's
 * mtime if there's no EXIF data at all (a screenshot, a PNG, a corrupted/stripped file, etc.).
 * Read-only: never writes to or otherwise touches the photo file itself.
 */
export async function getPhotoDate(absolutePath: string): Promise<Date> {
  try {
    const exifDates = await exifr.parse(absolutePath, { pick: [...EXIF_DATE_FIELDS] });
    for (const field of EXIF_DATE_FIELDS) {
      const d = exifDates?.[field];
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    }
  } catch {
    // Not every image has readable EXIF (PNG, a stripped/odd JPEG, etc.) — fall through to mtime.
  }
  const stat = await fs.stat(absolutePath);
  return stat.mtime;
}
