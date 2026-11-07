import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { db, getSetting } from '../db.js';

/**
 * 🎬 The Movies section: every video on the movies share (<MOVIE_LIBRARY_DIR>, by default
 * /share/media/movies — so takk/2025/… from the 📥 Inbox shows up too), to search, sort and watch.
 *  - Read-only: files are only ever read (listed, probed, streamed). Nothing on the share is
 *    renamed, changed or deleted.
 *  - The list is re-read every 10 minutes (and on 🔄). Length / size of picture come from ffprobe
 *    once per file and are kept in movie_library_info (keyed by path + size + date, so a replaced
 *    file is read again). Poster frames are made on demand into server/data/movie-posters.
 */

export const LIBRARY_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.mpg', '.mpeg', '.ts', '.m2ts', '.3gp', '.flv']);
/** What a browser can usually play straight from the file (Safari also plays HEVC .mp4/.mov). */
const PLAYABLE_EXTS = new Set(['.mp4', '.m4v', '.mov', '.webm']);

import { resolveShare } from './sharePaths.js';

/** The movies folder as written (a share location like /share/media/movies, or a Pi folder)… */
export const libraryLocation = () => getSetting('movie_library_dir') || config.movieLibraryDir;
/** …and on the Pi (the mounted share, services/sharePaths.ts). */
export const libraryDir = () => resolveShare(libraryLocation()).local;
const postersDir = path.join(config.dataDir, 'movie-posters');
const ffprobePath = () => process.env.FFPROBE_PATH || config.movies.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');

export interface LibraryMovie {
  id: string;
  title: string;
  file: string;
  folder: string;
  rel_path: string;
  size: number;
  added_at: string;
  year: number | null;
  recorded_at: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  playable: boolean;
}

interface Info {
  rel_path: string;
  size: number;
  mtime_ms: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  recorded_at: string | null;
}

const idFor = (rel: string) => crypto.createHash('sha1').update(rel).digest('base64url').slice(0, 16);

/** "The.Lion.King.1994.1080p.BluRay" → "The Lion King", 1994. A 2025/ folder gives the year for home videos. */
export function titleFrom(rel: string): { title: string; year: number | null } {
  const ext = path.extname(rel);
  let t = path.basename(rel, ext).replace(/[._]+/g, ' ').trim();
  let year: number | null = null;
  // The last year in the name that isn't its start ("Blade Runner 2049 (2017)" → 2017, "2001 … (1968)" → 1968).
  const maxYear = new Date().getFullYear() + 1;
  const years = [...t.matchAll(/[\s([]((?:19|20)\d\d)(?=[\])\s]|$)/g)].filter((m) => Number(m[1]) <= maxYear);
  const last = years[years.length - 1];
  if (last && last.index! > 0) {
    year = Number(last[1]);
    t = t.slice(0, last.index).replace(/[\s([-]+$/, '').trim() || t;
  }
  t = t.replace(/\s+(1080p|720p|2160p|4k|bluray|brrip|webrip|web-dl|hdrip|x264|x265|hevc|dvdrip)\b.*$/i, '').trim() || path.basename(rel, ext);
  if (!year) {
    const y = rel.split(path.sep).slice(0, -1).reverse().map((p) => p.match(/^((?:19|20)\d\d)$/)?.[1]).find(Boolean);
    if (y) year = Number(y);
  }
  return { title: t, year };
}

let cache: { at: number; dir: string; movies: LibraryMovie[]; error: string | null } | null = null;
let scanning: Promise<void> | null = null;

async function walk(root: string): Promise<Array<{ rel: string; size: number; mtimeMs: number }>> {
  const out: Array<{ rel: string; size: number; mtimeMs: number }> = [];
  const go = async (d: string, depth: number) => {
    if (depth > 12) return;
    const items = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
    for (const it of items) {
      if (it.name.startsWith('.') || it.name.startsWith('@') || it.name === '#recycle') continue; // hidden, .part, NAS system folders
      const p = path.join(d, it.name);
      if (it.isDirectory()) await go(p, depth + 1);
      else if (it.isFile() && LIBRARY_EXTS.has(path.extname(it.name).toLowerCase())) {
        const st = await fs.stat(p).catch(() => null);
        if (st && st.size > 0) out.push({ rel: path.relative(root, p), size: st.size, mtimeMs: st.mtimeMs });
      }
    }
  };
  await go(root, 0);
  return out;
}

async function scan(): Promise<void> {
  const dir = libraryDir();
  try {
    await fs.access(dir);
  } catch {
    cache = { at: Date.now(), dir, movies: [], error: `Can't open ${libraryLocation()}${dir !== libraryLocation() ? ` (${dir} on the Pi)` : ''} — mount that share on the Pi (docs/MOVIES_LIBRARY.md)` };
    return;
  }
  const files = await walk(dir);
  const info = new Map((db.prepare('SELECT * FROM movie_library_info').all() as Info[]).map((i) => [i.rel_path, i]));
  const movies = files.map((f): LibraryMovie => {
    const i = info.get(f.rel);
    const fresh = i && i.size === f.size && i.mtime_ms === Math.round(f.mtimeMs) ? i : null;
    const { title, year } = titleFrom(f.rel);
    const parts = f.rel.split(path.sep);
    const ext = path.extname(f.rel).toLowerCase();
    return {
      id: idFor(f.rel),
      title,
      file: parts[parts.length - 1],
      folder: parts.length > 1 ? parts[0] : '',
      rel_path: f.rel,
      size: f.size,
      added_at: new Date(f.mtimeMs).toISOString(),
      year: year ?? (fresh?.recorded_at ? new Date(fresh.recorded_at).getFullYear() : null),
      recorded_at: fresh?.recorded_at ?? null,
      duration: fresh?.duration ?? null,
      width: fresh?.width ?? null,
      height: fresh?.height ?? null,
      video_codec: fresh?.video_codec ?? null,
      // .mkv/.avi etc. don't play in a browser; ✓ for the usual phone/web formats (HEVC only on Apple).
      playable: PLAYABLE_EXTS.has(ext),
    };
  });
  cache = { at: Date.now(), dir, movies, error: null };
  void probeMissing(dir, files);
}

/** The library (re-read when older than 10 minutes, or the folder changed). */
export async function listLibrary(force = false): Promise<{ dir: string; location: string; movies: LibraryMovie[]; error: string | null; scanned_at: string | null }> {
  const stale = !cache || cache.dir !== libraryDir() || Date.now() - cache.at > 10 * 60_000;
  if (force || stale) {
    scanning ??= scan().finally(() => (scanning = null));
    // A first look waits for the list; later ones get the old list while it refreshes.
    if (!cache || force || cache.dir !== libraryDir()) await scanning;
  }
  return { dir: cache!.dir, location: libraryLocation(), movies: cache!.movies, error: cache!.error, scanned_at: cache ? new Date(cache.at).toISOString() : null };
}

export async function findMovie(id: string): Promise<{ movie: LibraryMovie; abs: string } | null> {
  const { dir, movies } = await listLibrary();
  const movie = movies.find((m) => m.id === id);
  if (!movie) return null;
  const abs = path.resolve(dir, movie.rel_path);
  if (!abs.startsWith(path.resolve(dir) + path.sep)) return null;
  return { movie, abs };
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout.on('data', (c) => (out += c.toString()));
    proc.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `exit ${code}`));
    });
  });
}

let probing = false;
/** Length / picture size for files not read yet — one at a time, in the background. */
async function probeMissing(dir: string, files: Array<{ rel: string; size: number; mtimeMs: number }>) {
  if (probing) return;
  probing = true;
  try {
    const known = new Map((db.prepare('SELECT rel_path, size, mtime_ms FROM movie_library_info').all() as Info[]).map((i) => [i.rel_path, i]));
    const todo = files.filter((f) => {
      const k = known.get(f.rel);
      return !k || k.size !== f.size || k.mtime_ms !== Math.round(f.mtimeMs);
    });
    const save = db.prepare(
      `INSERT INTO movie_library_info (rel_path, size, mtime_ms, duration, width, height, video_codec, recorded_at, probed_at, error)
       VALUES (@rel_path, @size, @mtime_ms, @duration, @width, @height, @video_codec, @recorded_at, @probed_at, @error)
       ON CONFLICT(rel_path) DO UPDATE SET size = @size, mtime_ms = @mtime_ms, duration = @duration, width = @width, height = @height,
         video_codec = @video_codec, recorded_at = @recorded_at, probed_at = @probed_at, error = @error`
    );
    let done = 0;
    for (const f of todo) {
      const row = { rel_path: f.rel, size: f.size, mtime_ms: Math.round(f.mtimeMs), duration: null as number | null, width: null as number | null, height: null as number | null, video_codec: null as string | null, recorded_at: null as string | null, probed_at: new Date().toISOString(), error: null as string | null };
      try {
        const j = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path.join(dir, f.rel)], 60_000));
        const v = (j.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'video');
        const d = Number(j.format?.duration);
        row.duration = Number.isFinite(d) ? d : null;
        row.width = v?.width ?? null;
        row.height = v?.height ?? null;
        row.video_codec = v?.codec_name ?? null;
        const tags = Object.fromEntries(Object.entries((j.format?.tags ?? {}) as Record<string, string>).map(([k, val]) => [k.toLowerCase(), val]));
        const c = tags['com.apple.quicktime.creationdate'] ?? tags['creation_time'];
        const when = c ? new Date(String(c).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) : null;
        row.recorded_at = when && !Number.isNaN(when.getTime()) && when.getFullYear() > 1970 ? when.toISOString() : null;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return; // no ffprobe: lengths just stay blank
        row.error = (err as Error).message.slice(0, 300);
      }
      save.run(row);
      if (++done % 25 === 0 && cache) applyInfo();
    }
    if (done) applyInfo();
  } finally {
    probing = false;
  }
}

/** Put newly read lengths into the cached list without walking the share again. */
function applyInfo() {
  if (!cache) return;
  const info = new Map((db.prepare('SELECT * FROM movie_library_info').all() as Info[]).map((i) => [i.rel_path, i]));
  for (const m of cache.movies) {
    const i = info.get(m.rel_path);
    if (!i || i.size !== m.size) continue;
    m.duration = i.duration;
    m.width = i.width;
    m.height = i.height;
    m.video_codec = i.video_codec;
    m.recorded_at = i.recorded_at;
    m.year ??= i.recorded_at ? new Date(i.recorded_at).getFullYear() : null;
  }
}

const posterJobs = new Map<string, Promise<string | null>>();
let posterRunning = 0;
const posterQueue: Array<() => void> = [];

/** A poster frame (a picture from a bit into the movie), made once and kept. Null if it can't be made. */
export async function posterFor(id: string): Promise<string | null> {
  const out = path.join(postersDir, `${id}.jpg`);
  if (fsSync.existsSync(out)) return out;
  const failed = `${out}.failed`;
  if (fsSync.existsSync(failed)) return null;
  if (!posterJobs.has(id)) {
    posterJobs.set(
      id,
      (async () => {
        const found = await findMovie(id);
        if (!found) return null;
        // Two at a time, so a page of posters doesn't swamp a Pi.
        if (posterRunning >= 2) await new Promise<void>((r) => posterQueue.push(r));
        posterRunning++;
        try {
          await fs.mkdir(postersDir, { recursive: true });
          const at = found.movie.duration ? Math.min(found.movie.duration * 0.1, 120) : 5;
          const tmp = `${out}.${process.pid}.tmp.jpg`;
          const args = (t: number) => ['-nostdin', '-y', '-v', 'error', '-ss', String(t), '-i', found.abs, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', tmp];
          try {
            await run(config.movies.ffmpegPath, args(at), 120_000);
            if (!fsSync.existsSync(tmp)) await run(config.movies.ffmpegPath, args(0), 120_000);
            await fs.rename(tmp, out);
            return out;
          } catch (err) {
            await fs.unlink(tmp).catch(() => {});
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') await fs.writeFile(failed, (err as Error).message).catch(() => {});
            return null;
          }
        } finally {
          posterRunning--;
          posterQueue.shift()?.();
        }
      })().finally(() => posterJobs.delete(id))
    );
  }
  return posterJobs.get(id)!;
}

/** Look at the share every 10 minutes so new movies (and their lengths) are ready before anyone opens the page. */
export function startMovieLibrary(): void {
  const tick = () => void listLibrary(true).catch((e) => console.warn('[movies] library scan failed:', e));
  setTimeout(tick, 90_000);
  setInterval(tick, 10 * 60_000);
}
