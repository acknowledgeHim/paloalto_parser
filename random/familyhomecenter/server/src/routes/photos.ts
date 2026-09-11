import { Router } from 'express';
import { listPhotos, getOrCreateThumbnail, photoIdFor, findPhotoById } from '../services/photos.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const photosRouter = Router();

photosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    res.json(files.map((f) => ({ id: photoIdFor(f) })));
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
