import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveMovieSelection, type MovieSelection } from '../services/movieSelection.js';
import { renderMovie, deleteMovieFile } from '../services/movieRender.js';
import { listPhotos, photoIdFor } from '../services/photos.js';
import {
  canManageMember,
  isAdminGateActive,
  isRequestAdmin,
  sessionMemberId,
  SESSION_COOKIE_NAME,
} from '../services/auth.js';
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

type MovieRow = Omit<Movie, 'music_tracks' | 'has_source'> & {
  music_tracks: string | null;
  photo_paths: string | null;
  music_track_details: string | null;
};

function parseJsonArray<T>(raw: string | null): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function rowToMovie(row: MovieRow): Movie {
  const { photo_paths, music_track_details: _details, ...rest } = row;
  let tracks = parseJsonArray<string>(row.music_tracks) ?? [];
  if (tracks.length === 0 && row.music_track) tracks = [row.music_track];
  return { ...rest, music_tracks: tracks, has_source: Boolean(parseJsonArray<string>(photo_paths)?.length) };
}

function getMovieRow(id: string): MovieRow | undefined {
  return db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as MovieRow | undefined;
}

/**
 * Only whoever made a movie, or a parent, can edit or delete it. Same activation rule as a
 * member's own profile (services/auth.ts's canManageMember): enforced once that person or any
 * parent has a password, household-trust before that. A movie with no recorded creator (made
 * before this was tracked, or with nobody picked in the switcher) is parent-only once the Settings
 * gate is on.
 */
function canManageMovie(token: string | undefined, movie: MovieRow): boolean {
  if (movie.created_by_id) return canManageMember(token, movie.created_by_id);
  return !isAdminGateActive() || isRequestAdmin(token);
}

interface TrackDetail {
  file: string;
  title: string;
  artist: string | null;
  duration: number | null;
}

interface MovieInput {
  title: string;
  secondsPerPhoto: number;
  photoPaths: string[];
  tracks: string[];
  musicPaths: string[];
  trackDetails: TrackDetail[];
}

/** Validates/resolves a create or update request body. Returns an error message on bad input. */
async function parseMovieInput(body: Record<string, unknown>): Promise<MovieInput | string> {
  const { title, seconds_per_photo, music_track, music_tracks, music_track_details } = body as {
    title?: string;
    seconds_per_photo?: number;
    music_track?: string | null;
    music_tracks?: unknown;
    music_track_details?: unknown;
  };
  const selection = parseSelection(body);
  if (!selection) return 'A valid selection is required';
  if (!title || !title.trim()) return 'title is required';

  const secondsPerPhoto = Number(seconds_per_photo) > 0 ? Number(seconds_per_photo) : 4;
  const photoPaths = await resolveMovieSelection(selection);
  if (photoPaths.length === 0) return 'That selection matched no photos';

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
    if (!resolved) return `Invalid music track: ${t}`;
    musicPaths.push(resolved);
  }

  // Titles/lengths as the client saw them in the library, kept so editing later can show the
  // songs properly without another library lookup — falling back to the filename if missing.
  const details = Array.isArray(music_track_details) ? (music_track_details as Array<Partial<TrackDetail>>) : [];
  const trackDetails = tracks.map((file) => {
    const d = details.find((x) => x && x.file === file);
    return {
      file,
      title: typeof d?.title === 'string' && d.title ? d.title : path.basename(file, path.extname(file)),
      artist: typeof d?.artist === 'string' ? d.artist : null,
      duration: typeof d?.duration === 'number' ? d.duration : null,
    };
  });

  return { title: title.trim(), secondsPerPhoto, photoPaths, tracks, musicPaths, trackDetails };
}

/**
 * Renders in the background — this can take anywhere from seconds to a few minutes on a Pi, so the
 * client polls GET / for status/progress_percent instead of the request hanging open. Progress is
 * throttled to whole percentage points so a burst of frame-by-frame progress lines doesn't turn
 * into a burst of DB writes.
 *
 * `previousFileName` is set when re-rendering an edited movie: the old video stays watchable until
 * the new one is done (then it's deleted), and if the re-render fails the movie goes back to
 * 'ready' on the old video with the failure noted in `error`, rather than losing it.
 */
function startRender(movieId: string, title: string, input: MovieInput, previousFileName: string | null): void {
  const updateProgress = db.prepare('UPDATE movies SET progress_percent = ? WHERE id = ?');
  let lastReported = -1;
  renderMovie({
    photoPaths: input.photoPaths,
    secondsPerPhoto: input.secondsPerPhoto,
    musicPaths: input.musicPaths,
    onProgress: (percent) => {
      const rounded = Math.floor(percent);
      if (rounded === lastReported) return;
      lastReported = rounded;
      updateProgress.run(rounded, movieId);
    },
  })
    .then(async ({ fileName }) => {
      db.prepare("UPDATE movies SET status = 'ready', file_name = ?, error = NULL, progress_percent = 100 WHERE id = ?").run(fileName, movieId);
      if (previousFileName && previousFileName !== fileName) await deleteMovieFile(previousFileName);
    })
    .catch((err) => {
      console.error(`[movies] render failed for "${title}" (${movieId}):`, err);
      const message = (err as Error).message;
      if (previousFileName) {
        db.prepare("UPDATE movies SET status = 'ready', error = ? WHERE id = ?").run(`Couldn't re-render — still showing the previous version. ${message}`, movieId);
      } else {
        db.prepare("UPDATE movies SET status = 'failed', error = ? WHERE id = ?").run(message, movieId);
      }
    });
}

/** A Movie minus the fields that aren't table columns. */
function movieColumns(movie: Movie): Omit<Movie, 'has_source'> {
  const { has_source: _hasSource, ...columns } = movie;
  return columns;
}

function relativePhotoPaths(absolutePaths: string[]): string {
  return JSON.stringify(absolutePaths.map((p) => path.relative(config.photosDir, p)));
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

/** GET /:id/source — what a movie was made from, to pre-fill the editor: its photos (as photo ids,
 *  in play order; any since removed from PHOTOS_DIR are counted in missing_photos) and songs. */
moviesRouter.get(
  '/:id/source',
  asyncHandler(async (req, res) => {
    const row = getMovieRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const relative = parseJsonArray<string>(row.photo_paths) ?? [];
    const existing = new Set(await listPhotos());
    const photoIds: string[] = [];
    let missing = 0;
    for (const rel of relative) {
      const absolute = path.join(config.photosDir, rel);
      if (existing.has(absolute)) photoIds.push(photoIdFor(absolute));
      else missing++;
    }
    const tracks = parseJsonArray<TrackDetail>(row.music_track_details) ??
      rowToMovie(row).music_tracks.map((file) => ({ file, title: path.basename(file, path.extname(file)), artist: null, duration: null }));
    res.json({
      title: row.title,
      seconds_per_photo: row.seconds_per_photo,
      photo_ids: photoIds,
      missing_photos: missing,
      tracks,
    });
  })
);

moviesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = await parseMovieInput(req.body);
    if (typeof input === 'string') return res.status(400).json({ error: input });
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    // A verified login is the most reliable answer to "who made this"; otherwise whoever's picked
    // in the profile switcher (household trust, like the rest of the app).
    const createdBy = sessionMemberId(token) ?? (req.body as { created_by_id?: string }).created_by_id ?? null;

    const movie: Movie = {
      id: uuidv4(),
      title: input.title,
      status: 'rendering',
      file_name: null,
      error: null,
      photo_count: input.photoPaths.length,
      seconds_per_photo: input.secondsPerPhoto,
      music_track: input.tracks[0] ?? null,
      music_tracks: input.tracks,
      has_source: true,
      progress_percent: 0,
      created_by_id: createdBy,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO movies (id, title, status, file_name, error, photo_count, seconds_per_photo, music_track, music_tracks,
                           photo_paths, music_track_details, progress_percent, created_by_id, created_at)
       VALUES (@id, @title, @status, @file_name, @error, @photo_count, @seconds_per_photo, @music_track, @music_tracks,
               @photo_paths, @music_track_details, @progress_percent, @created_by_id, @created_at)`
    ).run({
      ...movieColumns(movie),
      music_tracks: JSON.stringify(input.tracks),
      photo_paths: relativePhotoPaths(input.photoPaths),
      music_track_details: JSON.stringify(input.trackDetails),
    });
    res.status(201).json(movie);
    startRender(movie.id, movie.title, input, null);
  })
);

/** PUT /:id — edit a movie (new photos/songs/timing/title) and re-render it in place. */
moviesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getMovieRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    if (!canManageMovie(req.cookies?.[SESSION_COOKIE_NAME], row)) {
      return res.status(401).json({ error: 'Only whoever made this movie, or a parent, can change it' });
    }
    if (row.status === 'rendering') return res.status(409).json({ error: "It's still rendering — try again once it's done" });
    const input = await parseMovieInput(req.body);
    if (typeof input === 'string') return res.status(400).json({ error: input });

    db.prepare(
      `UPDATE movies SET title = @title, status = 'rendering', error = NULL, progress_percent = 0,
         photo_count = @photo_count, seconds_per_photo = @seconds_per_photo, music_track = @music_track,
         music_tracks = @music_tracks, photo_paths = @photo_paths, music_track_details = @music_track_details
       WHERE id = @id`
    ).run({
      id: row.id,
      title: input.title,
      photo_count: input.photoPaths.length,
      seconds_per_photo: input.secondsPerPhoto,
      music_track: input.tracks[0] ?? null,
      music_tracks: JSON.stringify(input.tracks),
      photo_paths: relativePhotoPaths(input.photoPaths),
      music_track_details: JSON.stringify(input.trackDetails),
    });
    res.json(rowToMovie(getMovieRow(row.id)!));
    startRender(row.id, input.title, input, row.file_name);
  })
);

moviesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getMovieRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    if (!canManageMovie(req.cookies?.[SESSION_COOKIE_NAME], row)) {
      return res.status(401).json({ error: 'Only whoever made this movie, or a parent, can delete it' });
    }
    db.prepare('DELETE FROM movies WHERE id = ?').run(row.id);
    if (row.file_name) await deleteMovieFile(row.file_name);
    res.status(204).end();
  })
);
