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

// Firing one fs/EXIF read per photo all at once (Promise.all with no cap) is fine for a few dozen
// local files, but for a few thousand photos over an SMB share it opens that many connections
// simultaneously — enough to exhaust file descriptors or the share's connection limit and crash or
// hang the whole server mid-request (surfaces to the browser as a bare "Failed to fetch"). Cap how
// many run at once instead, the same reasoning services/photos.ts's thumbnail warm-up already
// documents for going sequential.
const DATE_LOOKUP_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  const dated = await mapWithConcurrency(allPhotos, DATE_LOOKUP_CONCURRENCY, async (file) => ({
    file,
    date: await getPhotoDate(file),
  }));
  const startTime = new Date(`${selection.start}T00:00:00`).getTime();
  const endTime = new Date(`${selection.end}T23:59:59`).getTime();
  return dated
    .filter((d) => d.date.getTime() >= startTime && d.date.getTime() <= endTime)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((d) => d.file);
}
