import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import { setSetting } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { folderProblem, resolveShare } from '../services/sharePaths.js';
import { haveFfmpeg, videosLocation } from '../services/videoFiling.js';
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

/** GET /settings — Settings → 🎬 Movies: both movies folders, where they are on the Pi, and whether they can be read. */
movieLibraryRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const lib = resolveShare(libraryLocation());
    const vids = resolveShare(videosLocation());
    const [libProblem, vidProblem, ffmpeg] = await Promise.all([folderProblem(lib.local), folderProblem(vids.local), haveFfmpeg()]);
    let user = '';
    try {
      user = os.userInfo().username;
    } catch {
      /* unknown */
    }
    res.json({
      library: { location: libraryLocation(), local: lib.local, via: lib.via, problem: libProblem },
      videos: { location: videosLocation(), local: vids.local, via: vids.via, problem: vidProblem },
      ffmpeg,
      server_user: user,
    });
  })
);

/** PATCH /settings { dir, video_dir } — the folder the Movies section shows, and where Inbox videos are filed (parents). */
movieLibraryRouter.patch('/settings', requireAdmin, (req, res) => {
  if (typeof req.body?.dir === 'string') {
    const d = req.body.dir.trim();
    if (d && !shareLoc(d)) return res.status(400).json({ error: 'Use the share location, e.g. /share/media/movies or //nas/media/movies' });
    setSetting('movie_library_dir', d);
  }
  if (typeof req.body?.video_dir === 'string') {
    const d = req.body.video_dir.trim();
    if (d && !shareLoc(d)) return res.status(400).json({ error: 'Use the share location, e.g. /share/media/movies/takk' });
    setSetting('video_dest_dir', d);
  }
  res.json({ dir: libraryDir(), location: libraryLocation(), video_dir: videosLocation() });
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
