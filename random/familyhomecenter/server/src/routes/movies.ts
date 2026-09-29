import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveMovieSelection, type MovieSelection } from '../services/movieSelection.js';
import { renderMovie, deleteMovieFile } from '../services/movieRender.js';
import type { Movie } from '../types.js';

// Open to everyone, same household-trust default as Photos/Music — this is a fun family feature,
// not configuration. Read-only against the source photos/music throughout (see
// services/movieSelection.ts and services/movieRender.ts) — a movie is a brand new file, nothing
// about PHOTOS_DIR/MUSIC_LIBRARY_DIR is ever deleted or modified to make one.
export const moviesRouter = Router();

/** Resolves a music_track (a relative path from GET /music/library/search's Track.file) to an
 *  absolute path, rejecting anything that would escape MUSIC_LIBRARY_DIR (e.g. "../../etc/passwd")
 *  — music_track is client-supplied, not re-validated against the actual search results, so this
 *  is the one thing standing between it and being handed straight to ffmpeg as a file to read. */
function resolveMusicTrackPath(track: string): string | null {
  const libraryDir = path.resolve(config.music.libraryDir);
  const resolved = path.resolve(libraryDir, track);
  if (resolved !== libraryDir && !resolved.startsWith(libraryDir + path.sep)) return null;
  return resolved;
}

function parseSelection(body: Record<string, unknown>): MovieSelection | null {
  const selection = body.selection as Record<string, unknown> | undefined;
  if (!selection || typeof selection.mode !== 'string') return null;
  if (selection.mode === 'manual' && Array.isArray(selection.photoIds)) {
    return { mode: 'manual', photoIds: selection.photoIds as string[] };
  }
  if (selection.mode === 'random' && typeof selection.count === 'number') {
    return { mode: 'random', count: selection.count };
  }
  if (selection.mode === 'date-range' && typeof selection.start === 'string' && typeof selection.end === 'string') {
    return { mode: 'date-range', start: selection.start, end: selection.end };
  }
  return null;
}

moviesRouter.get('/', (_req, res) => {
  const movies = db.prepare('SELECT * FROM movies ORDER BY created_at DESC').all() as Movie[];
  res.json(movies);
});

/** POST /resolve-selection — previews how many (and which) photos a selection matches, without
 *  creating anything — lets the client show "12 photos match" before committing to a render. */
moviesRouter.post(
  '/resolve-selection',
  asyncHandler(async (req, res) => {
    const selection = parseSelection(req.body);
    if (!selection) return res.status(400).json({ error: 'A valid selection is required' });
    const photoPaths = await resolveMovieSelection(selection);
    res.json({ count: photoPaths.length });
  })
);

moviesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, seconds_per_photo, music_track, created_by_id } = req.body as {
      title?: string;
      seconds_per_photo?: number;
      music_track?: string | null;
      created_by_id?: string;
    };
    const selection = parseSelection(req.body);
    if (!selection) return res.status(400).json({ error: 'A valid selection is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

    const secondsPerPhoto = Number(seconds_per_photo) > 0 ? Number(seconds_per_photo) : 4;
    const photoPaths = await resolveMovieSelection(selection);
    if (photoPaths.length === 0) return res.status(400).json({ error: 'That selection matched no photos' });

    const trimmedTrack = music_track?.trim() || null;
    const musicAbsolutePath = trimmedTrack ? resolveMusicTrackPath(trimmedTrack) : null;
    if (trimmedTrack && !musicAbsolutePath) return res.status(400).json({ error: 'Invalid music_track' });

    const movie: Movie = {
      id: uuidv4(),
      title: title.trim(),
      status: 'rendering',
      file_name: null,
      error: null,
      photo_count: photoPaths.length,
      seconds_per_photo: secondsPerPhoto,
      music_track: trimmedTrack,
      created_by_id: created_by_id ?? null,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO movies (id, title, status, file_name, error, photo_count, seconds_per_photo, music_track, created_by_id, created_at)
       VALUES (@id, @title, @status, @file_name, @error, @photo_count, @seconds_per_photo, @music_track, @created_by_id, @created_at)`
    ).run(movie);
    res.status(201).json(movie);

    // Rendering happens after the response — this can take anywhere from seconds to a few minutes
    // on a Pi, so the client polls GET / for the status to flip from 'rendering' instead of the
    // request hanging open.
    renderMovie({ photoPaths, secondsPerPhoto, musicAbsolutePath })
      .then(({ fileName }) => {
        db.prepare("UPDATE movies SET status = 'ready', file_name = ? WHERE id = ?").run(fileName, movie.id);
      })
      .catch((err) => {
        console.error(`[movies] render failed for "${movie.title}" (${movie.id}):`, err);
        db.prepare("UPDATE movies SET status = 'failed', error = ? WHERE id = ?").run((err as Error).message, movie.id);
      });
  })
);

moviesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id) as Movie | undefined;
    if (!movie) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM movies WHERE id = ?').run(movie.id);
    if (movie.file_name) await deleteMovieFile(movie.file_name);
    res.status(204).end();
  })
);
