/** Helpers for the photo grids that sort/filter by folder, filename, and date taken (the movie
 *  maker and the document editor's picture picker). */

/** Splits a PHOTOS_DIR-relative path into its folder part ('' for a photo at the top level) and
 *  filename. */
export function splitPhotoPath(relativePath: string): { folder: string; file: string } {
  const normalized = relativePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash === -1
    ? { folder: '', file: normalized }
    : { folder: normalized.slice(0, slash), file: normalized.slice(slash + 1) };
}

export function fmtTakenDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
