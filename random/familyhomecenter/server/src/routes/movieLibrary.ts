import path from 'node:path';
import { Router } from 'express';
import { setSetting } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { findMovie, libraryDir, libraryLocation, listLibrary, posterFor } from '../services/movieLibrary.js';

// 🎬 Movies section — every video on the movies share, to search, sort and watch
// (services/movieLibrary.ts). Read-only: nothing on the share is ever changed or removed.
export const movieLibraryRouter = Router();

const shareLoc = (d: string) => /^(\/|\\\\|smb:)/i.test(d);

const TYPES: Record<string, string> = { '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska', '.ts': 'video/mp2t', '.avi': 'video/x-msvideo' };

/** GET / — the whole list (the page searches and sorts it); ?refresh=1 reads the share again. */
movieLibraryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listLibrary(req.query.refresh === '1'));
  })
);

/** PATCH /settings { dir } — which folder the Movies section shows (parents). */
movieLibraryRouter.patch('/settings', requireAdmin, (req, res) => {
  const d = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
  if (d && !shareLoc(d)) return res.status(400).json({ error: 'Use the share location, e.g. /share/media/movies or //nas/media/movies' });
  setSetting('movie_library_dir', d);
  res.json({ dir: libraryDir(), location: libraryLocation() });
});

movieLibraryRouter.get(
  '/:id/poster',
  asyncHandler(async (req, res) => {
    const file = await posterFor(req.params.id);
    if (!file) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=604800');
    res.sendFile(file);
  })
);

/** The video itself, with Range support so it can be skipped through (sendFile handles Range). */
movieLibraryRouter.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const found = await findMovie(req.params.id);
    if (!found) return res.status(404).end();
    const type = TYPES[path.extname(found.abs).toLowerCase()];
    if (type) res.type(type);
    if (req.query.download === '1') res.attachment(found.movie.file);
    res.sendFile(found.abs, { dotfiles: 'allow', acceptRanges: true });
  })
);
