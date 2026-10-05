import { Router } from 'express';
import path from 'node:path';
import { listPhotos, listVisiblePhotos, hiddenPhotoPaths, getOrCreateThumbnail, photoIdFor, findPhotoById } from '../services/photos.js';
import { db } from '../db.js';
import { getPhotoDate } from '../services/photoDates.js';
import { mapWithConcurrency } from '../services/movieSelection.js';
import { config } from '../config.js';
import { getPhotoQuality } from '../services/photoAnalysis.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const photosRouter = Router();

photosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    const quality = getPhotoQuality();
    const hidden = hiddenPhotoPaths();
    res.json(
      files.map((f) => {
        const rel = path.relative(config.photosDir, f);
        return { id: photoIdFor(f), blurry: quality.get(rel)?.blurry ?? null, hidden: hidden.has(rel) };
      })
    );
  })
);

/** GET /details — every photo's folder/filename (relative to PHOTOS_DIR) and best-effort date
 *  taken, for sorting/filtering the movie maker's photo grid. Dates come from the same cache as
 *  date-range movie selections (services/photoDates.ts), so only the first call after a restart
 *  pays for reading EXIF, capped to a few reads at a time for the sake of an SMB share. */
photosRouter.get(
  '/details',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    const quality = getPhotoQuality();
    const hidden = hiddenPhotoPaths();
    const details = await mapWithConcurrency(files, 8, async (f) => {
      const rel = path.relative(config.photosDir, f);
      const q = quality.get(rel);
      return {
        id: photoIdFor(f),
        path: rel,
        taken_at: (await getPhotoDate(f)).toISOString(),
        // Duplicate/blur analysis (services/photoAnalysis.ts) — null/false until it's run.
        blurry: q?.blurry ?? null,
        dup_group: q?.dup_group ?? null,
        dup_best: q?.dup_best ?? false,
        hidden: hidden.has(rel),
      };
    });
    res.json(details);
  })
);

/** GET /on-this-day — photos taken on today's month/day in earlier years, newest year first. */
photosRouter.get(
  '/on-this-day',
  asyncHandler(async (_req, res) => {
    const files = await listVisiblePhotos();
    const now = new Date();
    const dated = await mapWithConcurrency(files, 8, async (f) => ({ f, date: await getPhotoDate(f) }));
    const matches = dated
      .filter(({ date }) => date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && date.getFullYear() < now.getFullYear())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30)
      .map(({ f, date }) => ({ id: photoIdFor(f), year: date.getFullYear(), taken_at: date.toISOString() }));
    res.json(matches);
  })
);

/** POST /hidden { add?: ids, remove?: ids } — hide or unhide photos. Only a note in the database;
 *  the files aren't touched. Open to everyone, like adding to an album. */
photosRouter.post(
  '/hidden',
  asyncHandler(async (req, res) => {
    const { add, remove } = req.body as { add?: unknown; remove?: unknown };
    const idToPath = new Map((await listPhotos()).map((abs) => [photoIdFor(abs), path.relative(config.photosDir, abs)]));
    const paths = (ids: unknown) =>
      (Array.isArray(ids) ? ids : []).map((id) => (typeof id === 'string' ? idToPath.get(id) : undefined)).filter((p): p is string => Boolean(p));
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO hidden_photos (path, hidden_at) VALUES (?, ?)');
    const del = db.prepare('DELETE FROM hidden_photos WHERE path = ?');
    db.transaction(() => {
      for (const p of paths(add)) insert.run(p, now);
      for (const p of paths(remove)) del.run(p);
    })();
    res.json({ ok: true });
  })
);

photosRouter.get(
  '/random',
  asyncHandler(async (_req, res) => {
    // The slideshow/screensaver — hidden photos never come up.
    const files = await listVisiblePhotos();
    if (files.length === 0) return res.status(404).json({ error: 'no photos found' });
    const pick = files[Math.floor(Math.random() * files.length)];
    res.json({ id: photoIdFor(pick) });
  })
);

photosRouter.get(
  '/:id/image',
  asyncHandler(async (req, res) => {
    const absolutePath = await findPhotoById(req.params.id);
    if (!absolutePath) return res.status(404).end();
    try {
      const thumbPath = await getOrCreateThumbnail(absolutePath);
      res.sendFile(thumbPath);
    } catch (err) {
      console.error('[photos] failed to serve image', err);
      res.status(500).end();
    }
  })
);
