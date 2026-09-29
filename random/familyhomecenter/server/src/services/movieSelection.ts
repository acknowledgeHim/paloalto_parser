import path from 'node:path';
import { listPhotos, findPhotoById } from './photos.js';
import { getPhotoDate } from './photoDates.js';
import { config } from '../config.js';

export type MovieSelection =
  | { mode: 'manual'; photoIds: string[] }
  | { mode: 'random'; count: number }
  | { mode: 'date-range'; start: string; end: string } // YYYY-MM-DD, inclusive
  | { mode: 'name'; query: string }; // case-insensitive substring match against folder+filename

/** Fisher-Yates shuffle, then take the first n — avoids the "sort by Math.random()" trap where
 *  repeated comparisons can bias the result. */
function sampleRandom<T>(items: T[], n: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * Resolves a selection to an ordered list of absolute photo file paths — read-only throughout
 * (listPhotos/getPhotoDate only ever read PHOTOS_DIR, never write to or delete anything there).
 */
export async function resolveMovieSelection(selection: MovieSelection): Promise<string[]> {
  if (selection.mode === 'manual') {
    const resolved = await Promise.all(selection.photoIds.map((id) => findPhotoById(id)));
    return resolved.filter((p): p is string => Boolean(p));
  }

  const allPhotos = await listPhotos();

  if (selection.mode === 'random') {
    const count = Math.max(1, Math.min(selection.count, allPhotos.length));
    return sampleRandom(allPhotos, count);
  }

  if (selection.mode === 'name') {
    // Matches against the path relative to PHOTOS_DIR — so a query like "vacation" or "2023"
    // catches anything in a folder or filename with that in it, which for a library organized
    // into event/trip folders (common on a family SMB share) is often more useful than dates.
    const query = selection.query.trim().toLowerCase();
    if (!query) return [];
    return allPhotos.filter((file) => path.relative(config.photosDir, file).toLowerCase().includes(query));
  }

  // date-range: read each photo's best-effort date (EXIF or mtime) and keep the ones inside
  // [start, end] (inclusive), oldest first — a natural chronological slideshow order.
  const dated = await Promise.all(
    allPhotos.map(async (file) => ({ file, date: await getPhotoDate(file) }))
  );
  const startTime = new Date(`${selection.start}T00:00:00`).getTime();
  const endTime = new Date(`${selection.end}T23:59:59`).getTime();
  return dated
    .filter((d) => d.date.getTime() >= startTime && d.date.getTime() <= endTime)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((d) => d.file);
}
