import { Router } from 'express';
import path from 'node:path';
import { listPhotos, getOrCreateThumbnail, photoIdFor, findPhotoById } from '../services/photos.js';
import { getPhotoDate } from '../services/photoDates.js';
import { mapWithConcurrency } from '../services/movieSelection.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const photosRouter = Router();

photosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    res.json(files.map((f) => ({ id: photoIdFor(f) })));
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
    const details = await mapWithConcurrency(files, 8, async (f) => ({
      id: photoIdFor(f),
      path: path.relative(config.photosDir, f),
      taken_at: (await getPhotoDate(f)).toISOString(),
    }));
    res.json(details);
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
