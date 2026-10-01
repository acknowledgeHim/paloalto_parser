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

/** Resolves a music track (a relative path from GET /music/library/search's Track.file) to an
 *  absolute path, rejecting anything that would escape MUSIC_LIBRARY_DIR (e.g. "../../etc/passwd")
 *  — the track list is client-supplied, not re-validated against the actual search results, so this
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
  if (selection.mode === 'name' && typeof selection.query === 'string') {
    return { mode: 'name', query: selection.query };
  }
  return null;
}

type MovieRow = Omit<Movie, 'music_tracks'> & { music_tracks: string | null };

function rowToMovie(row: MovieRow): Movie {
  let tracks: string[] = [];
  if (row.music_tracks) {
    try {
      tracks = JSON.parse(row.music_tracks) as string[];
    } catch {
      // fall through to the single-track column below
    }
  }
  if (tracks.length === 0 && row.music_track) tracks = [row.music_track];
  return { ...row, music_tracks: tracks };
}

moviesRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM movies ORDER BY created_at DESC').all() as MovieRow[];
  res.json(rows.map(rowToMovie));
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
    const { title, seconds_per_photo, music_track, music_tracks, created_by_id } = req.body as {
      title?: string;
      seconds_per_photo?: number;
      music_track?: string | null;
      music_tracks?: unknown;
      created_by_id?: string;
    };
    const selection = parseSelection(req.body);
    if (!selection) return res.status(400).json({ error: 'A valid selection is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

    const secondsPerPhoto = Number(seconds_per_photo) > 0 ? Number(seconds_per_photo) : 4;
    const photoPaths = await resolveMovieSelection(selection);
    if (photoPaths.length === 0) return res.status(400).json({ error: 'That selection matched no photos' });

    // music_tracks (an ordered list) is what the client sends now; a lone music_track is still
    // accepted for older clients.
    const requestedTracks = Array.isArray(music_tracks) ? music_tracks : music_track ? [music_track] : [];
    const tracks = requestedTracks
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean);
    const musicPaths: string[] = [];
    for (const t of tracks) {
      const resolved = resolveMusicTrackPath(t);
      if (!resolved) return res.status(400).json({ error: `Invalid music track: ${t}` });
      musicPaths.push(resolved);
    }

    const movie: Movie = {
      id: uuidv4(),
      title: title.trim(),
      status: 'rendering',
      file_name: null,
      error: null,
      photo_count: photoPaths.length,
      seconds_per_photo: secondsPerPhoto,
      music_track: tracks[0] ?? null,
      music_tracks: tracks,
      progress_percent: 0,
      created_by_id: created_by_id ?? null,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO movies (id, title, status, file_name, error, photo_count, seconds_per_photo, music_track, music_tracks, progress_percent, created_by_id, created_at)
       VALUES (@id, @title, @status, @file_name, @error, @photo_count, @seconds_per_photo, @music_track, @music_tracks, @progress_percent, @created_by_id, @created_at)`
    ).run({ ...movie, music_tracks: JSON.stringify(tracks) });
    res.status(201).json(movie);

    // Rendering happens after the response — this can take anywhere from seconds to a few minutes
    // on a Pi, so the client polls GET / for status/progress_percent to update instead of the
    // request hanging open. Throttled to whole percentage points so a burst of frame-by-frame
    // progress lines doesn't turn into a burst of DB writes.
    const updateProgress = db.prepare('UPDATE movies SET progress_percent = ? WHERE id = ?');
    let lastReported = -1;
    renderMovie({
      photoPaths,
      secondsPerPhoto,
      musicPaths,
      onProgress: (percent) => {
        const rounded = Math.floor(percent);
        if (rounded === lastReported) return;
        lastReported = rounded;
        updateProgress.run(rounded, movie.id);
      },
    })
      .then(({ fileName }) => {
        db.prepare("UPDATE movies SET status = 'ready', file_name = ?, progress_percent = 100 WHERE id = ?").run(fileName, movie.id);
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
