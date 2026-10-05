import { Router } from 'express';
import path from 'node:path';
import { listPhotos, getOrCreateThumbnail, photoIdFor, findPhotoById } from '../services/photos.js';
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
    res.json(files.map((f) => ({ id: photoIdFor(f), blurry: quality.get(path.relative(config.photosDir, f))?.blurry ?? null })));
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
      };
    });
    res.json(details);
  })
);

/** GET /on-this-day — photos taken on today's month/day in earlier years, newest year first. */
photosRouter.get(
  '/on-this-day',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
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

photosRouter.get(
  '/random',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
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
