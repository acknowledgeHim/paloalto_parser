import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import { db, getSetting, setSetting } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveMovieSelection, type MovieSelection } from '../services/movieSelection.js';
import { renderMovie, deleteMovieFile, type MovieStyle } from '../services/movieRender.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { listPhotos, photoIdFor } from '../services/photos.js';
import { canManageMember, canManageOwnedItem, sessionMemberId, SESSION_COOKIE_NAME } from '../services/auth.js';
import type { Movie, MovieStyleOptions } from '../types.js';

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
  const base = parseSelectionMode(selection);
  if (!base) return null;
  return { ...base, excludeBlurry: selection.excludeBlurry === true, excludeDuplicates: selection.excludeDuplicates === true };
}

function parseSelectionMode(selection: Record<string, unknown>): MovieSelection | null {
  if (selection.mode === 'album' && typeof selection.albumId === 'string') {
    return { mode: 'album', albumId: selection.albumId };
  }
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

type MovieRow = Omit<Movie, 'music_tracks' | 'has_source' | 'style'> & {
  music_tracks: string | null;
  photo_paths: string | null;
  music_track_details: string | null;
  options: string | null;
  photo_captions: string | null;
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

const DEFAULT_OPTIONS: MovieStyleOptions = { transition: 'cut', motion: 'none', title_card: false, subtitle: '' };

function parseOptions(raw: string | null): MovieStyleOptions {
  try {
    return { ...DEFAULT_OPTIONS, ...(raw ? (JSON.parse(raw) as Partial<MovieStyleOptions>) : {}) };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function parseCaptions(raw: string | null): Record<string, string> {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function rowToMovie(row: MovieRow): Movie {
  const { photo_paths, music_track_details: _details, options, photo_captions: _captions, ...rest } = row;
  let tracks = parseJsonArray<string>(row.music_tracks) ?? [];
  if (tracks.length === 0 && row.music_track) tracks = [row.music_track];
  return { ...rest, music_tracks: tracks, has_source: Boolean(parseJsonArray<string>(photo_paths)?.length), style: parseOptions(options) };
}

function getMovieRow(id: string): MovieRow | undefined {
  return db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as MovieRow | undefined;
}

/** Only whoever made a movie, or a parent, can edit or delete it — see canManageOwnedItem. */
function canManageMovie(token: string | undefined, movie: MovieRow): boolean {
  return canManageOwnedItem(token, movie.created_by_id);
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
  options: MovieStyleOptions;
  /** Caption per photo, parallel to photoPaths. */
  captions: Array<string | null>;
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

  // Style: each option falls back to the plain default if missing/invalid.
  const rawStyle = (body.style ?? {}) as Partial<Record<keyof MovieStyleOptions, unknown>>;
  const options: MovieStyleOptions = {
    transition: rawStyle.transition === 'crossfade' ? 'crossfade' : 'cut',
    motion: rawStyle.motion === 'kenburns' ? 'kenburns' : 'none',
    title_card: rawStyle.title_card === true,
    subtitle: typeof rawStyle.subtitle === 'string' ? rawStyle.subtitle.trim().slice(0, 120) : '',
  };
  // Captions come keyed by photo id (what the client works with).
  const rawCaptions = (body.captions && typeof body.captions === 'object' ? body.captions : {}) as Record<string, unknown>;
  const captions = photoPaths.map((abs) => {
    const c = rawCaptions[photoIdFor(abs)];
    return typeof c === 'string' && c.trim() ? c.trim().slice(0, 200) : null;
  });

  return { title: title.trim(), secondsPerPhoto, photoPaths, tracks, musicPaths, trackDetails, options, captions };
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
  const style: MovieStyle = {
    transition: input.options.transition,
    motion: input.options.motion,
    titleCard: input.options.title_card ? { title: input.title, subtitle: input.options.subtitle } : null,
  };
  renderMovie({
    photoPaths: input.photoPaths,
    secondsPerPhoto: input.secondsPerPhoto,
    musicPaths: input.musicPaths,
    captions: input.captions,
    style,
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

/** A Movie minus the fields that aren't (directly) table columns. */
function movieColumns(movie: Movie): Omit<Movie, 'has_source' | 'style'> {
  const { has_source: _hasSource, style: _style, ...columns } = movie;
  return columns;
}

function relativePhotoPaths(absolutePaths: string[]): string {
  return JSON.stringify(absolutePaths.map((p) => path.relative(config.photosDir, p)));
}

/** Captions as stored: { relative photo path: caption } for the photos that have one. */
function captionsJson(input: MovieInput): string {
  const out: Record<string, string> = {};
  input.photoPaths.forEach((abs, i) => {
    if (input.captions[i]) out[path.relative(config.photosDir, abs)] = input.captions[i]!;
  });
  return JSON.stringify(out);
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

// ---- Screensaver movie (parents only) ----
// A finished movie can play as the idle screensaver instead of the photo slideshow, for today, a
// week, or until turned off. Stored as a setting: { movie_id, until (ISO, or null = until turned
// off), sound }. Anyone can ask what's on; only a parent can change it (requireAdmin — same gate
// as Settings).

const SCREENSAVER_KEY = 'screensaver_movie';

interface ScreensaverSetting {
  movie_id: string;
  until: string | null;
  sound: boolean;
}

function readScreensaver(): ScreensaverSetting | null {
  try {
    const raw = getSetting(SCREENSAVER_KEY, '');
    return raw ? (JSON.parse(raw) as ScreensaverSetting) : null;
  } catch {
    return null;
  }
}

/** GET /screensaver — the movie to play as the screensaver right now, or null (none set, it's
 *  expired, or the movie's gone / not ready). */
moviesRouter.get('/screensaver', (_req, res) => {
  const current = readScreensaver();
  if (!current) return res.json(null);
  if (current.until && new Date(current.until) <= new Date()) {
    setSetting(SCREENSAVER_KEY, '');
    return res.json(null);
  }
  const row = getMovieRow(current.movie_id);
  if (!row || row.status !== 'ready' || !row.file_name) return res.json(null);
  res.json({ ...current, title: row.title, file_name: row.file_name });
});

/** PUT /screensaver { movie_id, days: 1 | 7 | null, sound } — days 1 = through tonight, 7 = a week
 *  (to the end of that day), null = until turned off. */
moviesRouter.put('/screensaver', requireAdmin, (req, res) => {
  const { movie_id, days, sound } = req.body as { movie_id?: string; days?: number | null; sound?: boolean };
  const row = movie_id ? getMovieRow(movie_id) : undefined;
  if (!row || row.status !== 'ready') return res.status(400).json({ error: 'Pick a finished movie' });
  let until: string | null = null;
  if (days === 1 || days === 7) {
    const end = new Date();
    end.setDate(end.getDate() + days - 1);
    end.setHours(23, 59, 59, 999);
    until = end.toISOString();
  } else if (days !== null && days !== undefined) {
    return res.status(400).json({ error: 'days must be 1, 7, or null' });
  }
  const setting: ScreensaverSetting = { movie_id: row.id, until, sound: sound === true };
  setSetting(SCREENSAVER_KEY, JSON.stringify(setting));
  res.json(setting);
});

moviesRouter.delete('/screensaver', requireAdmin, (_req, res) => {
  setSetting(SCREENSAVER_KEY, '');
  res.status(204).end();
});

// ---- Drafts (auto-saved movie maker forms) ----

interface DraftRow {
  id: string;
  movie_id: string | null;
  created_by_id: string | null;
  title: string;
  state: string;
  updated_at: string;
}

const MAX_DRAFT_STATE_BYTES = 2_000_000;
const DRAFT_MAX_AGE_DAYS = 30;

function draftSummary(row: DraftRow) {
  let photoCount = 0;
  let trackCount = 0;
  try {
    const state = JSON.parse(row.state) as { selectedIds?: unknown[]; musicTracks?: unknown[] };
    photoCount = Array.isArray(state.selectedIds) ? state.selectedIds.length : 0;
    trackCount = Array.isArray(state.musicTracks) ? state.musicTracks.length : 0;
  } catch {
    // unreadable state — still listed so it can be deleted
  }
  return {
    id: row.id,
    movie_id: row.movie_id,
    created_by_id: row.created_by_id,
    title: row.title,
    updated_at: row.updated_at,
    photo_count: photoCount,
    track_count: trackCount,
  };
}

/** Same self-or-parent rule as the movies themselves, for deleting someone's draft. */
function canManageDraft(token: string | undefined, draft: DraftRow): boolean {
  if (draft.created_by_id) return canManageMember(token, draft.created_by_id);
  return true; // nobody's — household trust
}

function validDraftBody(body: Record<string, unknown>): { title: string; state: string } | string {
  if (body.state === undefined || body.state === null || typeof body.state !== 'object') return 'state is required';
  const state = JSON.stringify(body.state);
  if (state.length > MAX_DRAFT_STATE_BYTES) return 'Draft is too large';
  return { title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '', state };
}

/** GET /drafts — every draft (summaries; GET /drafts/:id for the full form). Drafts untouched for
 *  DRAFT_MAX_AGE_DAYS are cleared out here rather than on a schedule. */
moviesRouter.get('/drafts', (_req, res) => {
  db.prepare(`DELETE FROM movie_drafts WHERE updated_at < ?`).run(new Date(Date.now() - DRAFT_MAX_AGE_DAYS * 86_400_000).toISOString());
  const rows = db.prepare('SELECT * FROM movie_drafts ORDER BY updated_at DESC').all() as DraftRow[];
  res.json(rows.map(draftSummary));
});

moviesRouter.get('/drafts/:draftId', (req, res) => {
  const row = db.prepare('SELECT * FROM movie_drafts WHERE id = ?').get(req.params.draftId) as DraftRow | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...draftSummary(row), state: JSON.parse(row.state) });
});

/** POST /drafts — first save of a form. Edits to an existing movie reuse that movie's draft if it
 *  already has one (one set of unsaved changes per movie). */
moviesRouter.post('/drafts', (req, res) => {
  const parsed = validDraftBody(req.body);
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
  const { movie_id, created_by_id } = req.body as { movie_id?: string | null; created_by_id?: string | null };
  if (movie_id && !getMovieRow(movie_id)) return res.status(400).json({ error: 'Unknown movie' });
  const createdBy = sessionMemberId(req.cookies?.[SESSION_COOKIE_NAME]) ?? created_by_id ?? null;
  const memberOk = createdBy ? Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(createdBy)) : true;
  const updatedAt = new Date().toISOString();
  const existing = movie_id
    ? (db.prepare('SELECT id FROM movie_drafts WHERE movie_id = ?').get(movie_id) as { id: string } | undefined)
    : undefined;
  const id = existing?.id ?? uuidv4();
  db.prepare(
    `INSERT INTO movie_drafts (id, movie_id, created_by_id, title, state, updated_at)
     VALUES (@id, @movie_id, @created_by_id, @title, @state, @updated_at)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, state = excluded.state, updated_at = excluded.updated_at`
  ).run({ id, movie_id: movie_id ?? null, created_by_id: memberOk ? createdBy : null, ...parsed, updated_at: updatedAt });
  res.status(201).json({ id, updated_at: updatedAt });
});

/** PUT /drafts/:draftId — later saves. 404 if it's gone (e.g. finished elsewhere) so the client
 *  can start a fresh one. */
moviesRouter.put('/drafts/:draftId', (req, res) => {
  const parsed = validDraftBody(req.body);
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
  const updatedAt = new Date().toISOString();
  const result = db
    .prepare('UPDATE movie_drafts SET title = @title, state = @state, updated_at = @updated_at WHERE id = @id')
    .run({ id: req.params.draftId, ...parsed, updated_at: updatedAt });
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ id: req.params.draftId, updated_at: updatedAt });
});

moviesRouter.delete('/drafts/:draftId', (req, res) => {
  const row = db.prepare('SELECT * FROM movie_drafts WHERE id = ?').get(req.params.draftId) as DraftRow | undefined;
  if (!row) return res.status(204).end();
  if (!canManageDraft(req.cookies?.[SESSION_COOKIE_NAME], row)) {
    return res.status(401).json({ error: 'Only whoever started this draft, or a parent, can delete it' });
  }
  db.prepare('DELETE FROM movie_drafts WHERE id = ?').run(row.id);
  res.status(204).end();
});

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
      style: parseOptions(row.options),
      // Keyed by photo id, for the editor.
      captions: Object.fromEntries(
        Object.entries(parseCaptions(row.photo_captions))
          .filter(([rel]) => existing.has(path.join(config.photosDir, rel)))
          .map(([rel, caption]) => [photoIdFor(path.join(config.photosDir, rel)), caption])
      ),
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
      style: input.options,
      progress_percent: 0,
      created_by_id: createdBy,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO movies (id, title, status, file_name, error, photo_count, seconds_per_photo, music_track, music_tracks,
                           photo_paths, music_track_details, options, photo_captions, progress_percent, created_by_id, created_at)
       VALUES (@id, @title, @status, @file_name, @error, @photo_count, @seconds_per_photo, @music_track, @music_tracks,
               @photo_paths, @music_track_details, @options, @photo_captions, @progress_percent, @created_by_id, @created_at)`
    ).run({
      ...movieColumns(movie),
      options: JSON.stringify(input.options),
      photo_captions: captionsJson(input),
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
         music_tracks = @music_tracks, photo_paths = @photo_paths, music_track_details = @music_track_details,
         options = @options, photo_captions = @photo_captions
       WHERE id = @id`
    ).run({
      id: row.id,
      options: JSON.stringify(input.options),
      photo_captions: captionsJson(input),
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
