import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { albumPhotoIds, photoIndex } from '../services/albums.js';
import { canManageOwnedItem, sessionMemberId, SESSION_COOKIE_NAME } from '../services/auth.js';

// Photo albums, including the built-in Favorites. Kept entirely in this database — an album holds
// paths relative to PHOTOS_DIR, so the files themselves are never moved or touched. Adding/removing
// photos is open to everyone (same household trust as browsing photos); renaming or deleting an
// album is for whoever made it or a parent (canManageOwnedItem), and Favorites can't be either.
export const albumsRouter = Router();

interface AlbumRow {
  id: string;
  name: string;
  is_favorites: number;
  created_by_id: string | null;
  created_at: string;
}

function getAlbum(id: string): AlbumRow | undefined {
  return db.prepare('SELECT * FROM photo_albums WHERE id = ?').get(id) as AlbumRow | undefined;
}

/** GET / — every album (Favorites first) with its photo count and a cover photo (the latest added). */
albumsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { pathToId } = await photoIndex();
    const albums = db.prepare('SELECT * FROM photo_albums ORDER BY is_favorites DESC, name COLLATE NOCASE').all() as AlbumRow[];
    res.json(
      albums.map((a) => {
        const ids = albumPhotoIds(a.id, pathToId);
        return { ...a, is_favorites: a.is_favorites === 1, count: ids.length, cover_id: ids[ids.length - 1] ?? null };
      })
    );
  })
);

/** GET /memberships — { photoId: [albumId, …] } for every photo that's in any album (for stars and
 *  checkmarks in the UI without a request per photo). */
albumsRouter.get(
  '/memberships',
  asyncHandler(async (_req, res) => {
    const { pathToId } = await photoIndex();
    const out: Record<string, string[]> = {};
    for (const row of db.prepare('SELECT album_id, path FROM photo_album_items').all() as Array<{ album_id: string; path: string }>) {
      const id = pathToId.get(row.path);
      if (id) (out[id] ??= []).push(row.album_id);
    }
    res.json(out);
  })
);

albumsRouter.get(
  '/:id/photos',
  asyncHandler(async (req, res) => {
    if (!getAlbum(req.params.id)) return res.status(404).json({ error: 'not found' });
    const { pathToId } = await photoIndex();
    res.json(albumPhotoIds(req.params.id, pathToId));
  })
);

albumsRouter.post('/', (req, res) => {
  const { name, created_by_id } = req.body as { name?: string; created_by_id?: string | null };
  const trimmed = name?.trim();
  if (!trimmed) return res.status(400).json({ error: 'Give the album a name' });
  if (trimmed.length > 100) return res.status(400).json({ error: 'That name is too long' });
  if (db.prepare('SELECT 1 FROM photo_albums WHERE name = ? COLLATE NOCASE').get(trimmed)) {
    return res.status(400).json({ error: 'There’s already an album with that name' });
  }
  let createdBy = sessionMemberId(req.cookies?.[SESSION_COOKIE_NAME]) ?? created_by_id ?? null;
  if (createdBy && !db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(createdBy)) createdBy = null;
  const album: AlbumRow = { id: uuidv4(), name: trimmed, is_favorites: 0, created_by_id: createdBy, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO photo_albums (id, name, is_favorites, created_by_id, created_at) VALUES (@id, @name, @is_favorites, @created_by_id, @created_at)').run(album);
  res.status(201).json({ ...album, is_favorites: false, count: 0, cover_id: null });
});

albumsRouter.patch('/:id', (req, res) => {
  const album = getAlbum(req.params.id);
  if (!album) return res.status(404).json({ error: 'not found' });
  if (album.is_favorites) return res.status(400).json({ error: 'Favorites can’t be renamed' });
  if (!canManageOwnedItem(req.cookies?.[SESSION_COOKIE_NAME], album.created_by_id)) {
    return res.status(401).json({ error: 'Only whoever made this album, or a parent, can rename it' });
  }
  const name = (req.body as { name?: string }).name?.trim();
  if (!name) return res.status(400).json({ error: 'Give the album a name' });
  if (db.prepare('SELECT 1 FROM photo_albums WHERE name = ? COLLATE NOCASE AND id != ?').get(name, album.id)) {
    return res.status(400).json({ error: 'There’s already an album with that name' });
  }
  db.prepare('UPDATE photo_albums SET name = ? WHERE id = ?').run(name, album.id);
  res.json({ ok: true });
});

albumsRouter.delete('/:id', (req, res) => {
  const album = getAlbum(req.params.id);
  if (!album) return res.status(404).json({ error: 'not found' });
  if (album.is_favorites) return res.status(400).json({ error: 'Favorites can’t be deleted' });
  if (!canManageOwnedItem(req.cookies?.[SESSION_COOKIE_NAME], album.created_by_id)) {
    return res.status(401).json({ error: 'Only whoever made this album, or a parent, can delete it' });
  }
  // Only the album and its list go — the photos themselves are untouched.
  db.prepare('DELETE FROM photo_albums WHERE id = ?').run(album.id);
  res.status(204).end();
});

/** POST /:id/photos { add?: ids, remove?: ids } */
albumsRouter.post(
  '/:id/photos',
  asyncHandler(async (req, res) => {
    const album = getAlbum(req.params.id);
    if (!album) return res.status(404).json({ error: 'not found' });
    const { add, remove } = req.body as { add?: unknown; remove?: unknown };
    const { idToPath } = await photoIndex();
    const toPaths = (ids: unknown) =>
      (Array.isArray(ids) ? ids : []).map((id) => (typeof id === 'string' ? idToPath.get(id) : undefined)).filter((p): p is string => Boolean(p));
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO photo_album_items (album_id, path, added_at) VALUES (?, ?, ?)');
    const del = db.prepare('DELETE FROM photo_album_items WHERE album_id = ? AND path = ?');
    db.transaction(() => {
      for (const p of toPaths(add)) insert.run(album.id, p, now);
      for (const p of toPaths(remove)) del.run(album.id, p);
    })();
    res.json({ ok: true });
  })
);
