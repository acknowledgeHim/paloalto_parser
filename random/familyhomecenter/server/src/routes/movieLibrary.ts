import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import { setSetting } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { folderProblem, resolveShare } from '../services/sharePaths.js';
import { haveFfmpeg, MOV_EXTS, mp4Stream, videosLocation } from '../services/videoFiling.js';
import { copyStatus, findMovie, setRotation, libraryDir, libraryLocation, listLibrary, mp4CopiesOn, posterFor } from '../services/movieLibrary.js';

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
      mp4_copies: { on: mp4CopiesOn(), ...copyStatus },
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
  if (typeof req.body?.mp4_copies === 'boolean') {
    setSetting('movie_mp4_copies', req.body.mp4_copies ? '' : 'off');
    if (req.body.mp4_copies) void listLibrary(true).catch(() => {}); // start on what's there now
  }
  res.json({ dir: libraryDir(), location: libraryLocation(), video_dir: videosLocation() });
});

/** PUT /:id/rotation { degrees } — show a sideways video the right way up (anyone; only how it's shown, the file isn't changed). */
movieLibraryRouter.put(
  '/:id/rotation',
  asyncHandler(async (req, res) => {
    const d = Number(req.body?.degrees);
    if (![0, 90, 180, 270].includes(d)) return res.status(400).json({ error: 'degrees: 0, 90, 180 or 270' });
    await listLibrary();
    const by = typeof req.body?.acting_member_id === 'string' ? req.body.acting_member_id : null;
    const m = setRotation(req.params.id, d, by);
    if (!m) return res.status(404).json({ error: 'No such movie' });
    res.json({ rotation: m.rotation });
  })
);

movieLibraryRouter.get(
  '/:id/poster',
  asyncHandler(async (req, res) => {
    const file = await posterFor(req.params.id);
    if (!file) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=604800');
    res.sendFile(file);
  })
);

/**
 * The video itself, with Range support so it can be skipped through (sendFile handles Range).
 * ?original=1 — the .mpg an .mp4 copy was made from. ?download=1 — as a download.
 */
movieLibraryRouter.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const found = await findMovie(req.params.id);
    if (!found) return res.status(404).end();
    let abs = found.abs;
    let file = found.movie.file;
    if (req.query.original === '1') {
      if (!found.movie.original_rel) return res.status(404).end();
      abs = path.resolve(libraryDir(), found.movie.original_rel);
      if (!abs.startsWith(path.resolve(libraryDir()) + path.sep)) return res.status(404).end();
      file = path.basename(abs);
    }
    const ext = path.extname(abs).toLowerCase();
    const download = req.query.download === '1';
    // A .mov is an MP4-style file: saying so lets Firefox / Chrome try it (they refuse video/quicktime).
    const type = !download && MOV_EXTS.has(ext) ? 'video/mp4' : TYPES[ext];
    if (type) res.type(type);
    if (download) res.attachment(file);
    res.sendFile(abs, { dotfiles: 'allow', acceptRanges: true });
  })
);

/** A .mov downloaded as an .mp4 — made while it downloads, same picture and sound, all the metadata (services/videoFiling.ts). */
movieLibraryRouter.get(
  '/:id/mp4',
  asyncHandler(async (req, res) => {
    const found = await findMovie(req.params.id);
    if (!found) return res.status(404).end();
    if (!MOV_EXTS.has(path.extname(found.abs).toLowerCase())) return res.redirect(`/api/movie-library/${req.params.id}/stream?download=1`);
    if (!(await haveFfmpeg())) return res.status(503).json({ error: 'ffmpeg is needed to make an .mp4 — sudo apt install -y ffmpeg' });
    res.type('video/mp4');
    res.attachment(`${path.basename(found.movie.file, path.extname(found.movie.file))}.mp4`);
    const stop = await mp4Stream(found.abs, res, (e) => {
      console.warn('[movies] .mp4 download failed:', e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
      else res.destroy();
    });
    res.on('close', stop); // the download was stopped (or finished)
  })
);
