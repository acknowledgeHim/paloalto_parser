import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';
import { listPhotos, photoIdFor } from './photos.js';
// Lookups for photo albums (routes/albums.ts) — shared with movie selections, which can pick
// "everything in an album".
/** Current photo id ↔ relative path, for the photos still in the library. */
export async function photoIndex() {
    const idToPath = new Map();
    const pathToId = new Map();
    for (const abs of await listPhotos()) {
        const rel = path.relative(config.photosDir, abs);
        const id = photoIdFor(abs);
        idToPath.set(id, rel);
        pathToId.set(rel, id);
    }
    return { idToPath, pathToId };
}
/** Album photo ids, oldest-added first, skipping any no longer in the library. */
export function albumPhotoIds(albumId, pathToId) {
    const rows = db.prepare('SELECT path FROM photo_album_items WHERE album_id = ? ORDER BY added_at, rowid').all(albumId);
    return rows.map((r) => pathToId.get(r.path)).filter((id) => Boolean(id));
}
/** Paths (absolute) of an album's photos still in the library, oldest-added first — for movie
 *  selections (services/movieSelection.ts). */
export async function albumPhotoPaths(albumId) {
    const { pathToId } = await photoIndex();
    const rows = db.prepare('SELECT path FROM photo_album_items WHERE album_id = ? ORDER BY added_at, rowid').all(albumId);
    return rows.filter((r) => pathToId.has(r.path)).map((r) => path.join(config.photosDir, r.path));
}
