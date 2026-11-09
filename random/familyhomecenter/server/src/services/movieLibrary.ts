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
 *  - Nothing on the share is ever renamed, changed or deleted. The only thing ever written there
 *    is a new .mp4 copy next to an .mpg (makeMp4Copies, below — never over an existing file).
 *  - The list is re-read every 10 minutes (and on 🔄). Length / size of picture come from ffprobe
 *    once per file and are kept in movie_library_info (keyed by path + size + date, so a replaced
 *    file is read again). Poster frames are made on demand into server/data/movie-posters.
 */

export const LIBRARY_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.mpg', '.mpeg', '.ts', '.m2ts', '.3gp', '.flv']);
/** What a browser can usually play straight from the file (Safari also plays HEVC .mp4/.mov). */
const PLAYABLE_EXTS = new Set(['.mp4', '.m4v', '.mov', '.webm']);

import { folderProblem, resolveShare } from './sharePaths.js';

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
  /** An .mp4 copy made from an .mpg: the original file next to it (kept as it was, downloadable). */
  original_rel: string | null;
  /** Turned this much (0 / 90 / 180 / 270, clockwise) when shown — for videos recorded sideways. */
  rotation: number;
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
  const problem = await folderProblem(dir);
  if (problem) {
    const where = dir !== libraryLocation() ? ` (${libraryLocation()} → ${dir} on the Pi)` : '';
    cache = { at: Date.now(), dir, movies: [], error: `Can't open the movies folder${where}: ${problem} See docs/MOVIES_LIBRARY.md.` };
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
      original_rel: null,
      rotation: 0,
    };
  });
  // The same video in several formats in one folder ("Holiday.mpg" + its "Holiday.mp4" copy,
  // "Clip.mov" + "Clip.mp4") is listed once: the version a browser plays best, with the other
  // one to download as the original.
  const rank = (m: LibraryMovie) => {
    const e = path.extname(m.rel_path).toLowerCase();
    const extRank = ({ '.mp4': 0, '.m4v': 1, '.webm': 2, '.mov': 3 } as Record<string, number>)[e] ?? 4;
    return (m.playable ? 0 : 10) + (m.video_codec === 'h264' ? 0 : 5) + extRank;
  };
  const groups = new Map<string, LibraryMovie[]>();
  for (const m of movies) {
    const key = m.rel_path.slice(0, m.rel_path.length - path.extname(m.rel_path).length).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const shown: LibraryMovie[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => rank(a) - rank(b));
    const [best, ...others] = g;
    best.original_rel = others.find((o) => !o.playable)?.rel_path ?? others[0]?.rel_path ?? null;
    shown.push(best);
  }
  applyRotations(shown);
  cache = { at: Date.now(), dir, movies: shown, error: null };
  void probeMissing(dir, files);
  void makeMp4Copies(dir, files);
}

/** The library (re-read when older than 10 minutes, or the folder changed). */
export async function listLibrary(force = false): Promise<{ dir: string; location: string; movies: LibraryMovie[]; error: string | null; scanned_at: string | null }> {
  // A folder that couldn't be opened is tried again on every look (it may have just been mounted).
  const stale = !cache || !!cache.error || cache.dir !== libraryDir() || Date.now() - cache.at > 10 * 60_000;
  if (force || stale) {
    scanning ??= scan().finally(() => (scanning = null));
    // A first look waits for the list; later ones get the old list while it refreshes.
    if (!cache || force || cache.error || cache.dir !== libraryDir()) await scanning;
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

/**
 * 🍿 Who's watching right now. A browser fetches a video in many short pieces, so "watching" means
 * a piece was sent in the last 30 s (per person + movie). While anyone is, background work on the
 * share (the .mpg → .mp4 copier, reading lengths, posters) steps aside so the movie and the rest of
 * the app stay smooth.
 */
const viewers = new Map<string, { title: string; at: number; open: number }>();
const WATCH_WINDOW = 30_000;
export function streamStarted(who: string, title: string): () => void {
  const v = viewers.get(who) ?? { title, at: 0, open: 0 };
  v.title = title;
  v.at = Date.now();
  v.open++;
  viewers.set(who, v);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    v.open--;
    v.at = Date.now();
  };
}
export function watchingNow(): Array<{ title: string; open: number }> {
  const now = Date.now();
  for (const [k, v] of viewers) if (v.open <= 0 && now - v.at > WATCH_WINDOW) viewers.delete(k);
  return [...viewers.values()].map((v) => ({ title: v.title, open: v.open }));
}
export const someoneWatching = () => watchingNow().length > 0;
/** Wait until nobody's watching (checked every 5 s). */
async function whenIdle(): Promise<void> {
  while (someoneWatching()) await new Promise((r) => setTimeout(r, 5000));
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
      await whenIdle();
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

function applyRotations(movies: LibraryMovie[]) {
  const rot = new Map((db.prepare('SELECT rel_path, degrees FROM movie_rotation').all() as Array<{ rel_path: string; degrees: number }>).map((r) => [r.rel_path, r.degrees]));
  for (const m of movies) m.rotation = rot.get(m.rel_path) ?? 0;
}

/** 🔄 Show a movie turned (0 / 90 / 180 / 270 clockwise). Only remembered here — the file isn't touched. */
export function setRotation(id: string, degrees: number, by: string | null): LibraryMovie | null {
  const m = cache?.movies.find((x) => x.id === id);
  if (!m) return null;
  db.prepare(
    `INSERT INTO movie_rotation (rel_path, degrees, set_at, by_member) VALUES (?, ?, ?, ?)
     ON CONFLICT(rel_path) DO UPDATE SET degrees = excluded.degrees, set_at = excluded.set_at, by_member = excluded.by_member`
  ).run(m.rel_path, degrees, new Date().toISOString(), by);
  m.rotation = degrees;
  return m;
}

/**
 * ℹ️ What's inside one video — the picture's codec, profile, bit depth, interlacing, size — and
 * anything about it that phones often can't show (they decode in hardware, which handles less
 * than a computer's browser: a phone can play the sound but show a black picture).
 */
export async function videoDetails(abs: string): Promise<{ summary: string; phone_problems: string[] }> {
  const j = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', abs], 60_000));
  type St = { codec_type?: string; codec_name?: string; codec_tag_string?: string; profile?: string; level?: number; pix_fmt?: string; width?: number; height?: number; field_order?: string; bit_rate?: string; avg_frame_rate?: string };
  const streams = (j.streams ?? []) as St[];
  const v = streams.find((x) => x.codec_type === 'video');
  const a = streams.filter((x) => x.codec_type === 'audio');
  const rate = (r?: string) => {
    const [n, d] = (r ?? '').split('/').map(Number);
    return n && d ? Math.round((n / d) * 100) / 100 : null;
  };
  const kbps = Math.round(Number(v?.bit_rate ?? j.format?.bit_rate ?? 0) / 1000);
  const problems: string[] = [];
  if (v) {
    const c = v.codec_name ?? '';
    const pf = v.pix_fmt ?? '';
    if (/10|12/.test(pf)) problems.push(`${/10/.test(pf) ? '10' : '12'}-bit picture (${pf}) — most phones only play 8-bit ${c === 'hevc' ? 'HEVC/' : ''}H.264`);
    if (/422|444/.test(pf)) problems.push(`${/422/.test(pf) ? '4:2:2' : '4:4:4'} colour (${pf}) — phones only play 4:2:0`);
    if (v.field_order && !['progressive', 'unknown'].includes(v.field_order)) problems.push(`interlaced picture (${v.field_order}) — phones often show it black or broken`);
    if (c === 'h264' && (v.level ?? 0) > 51) problems.push(`H.264 level ${(v.level ?? 0) / 10} — higher than most phones handle (5.1)`);
    if ((v.width ?? 0) > 3840 || (v.height ?? 0) > 2160) problems.push(`very large picture (${v.width}×${v.height})`);
    if (c === 'hevc') problems.push(`HEVC${v.codec_tag_string === 'hev1' ? ' (tagged hev1, which Android/Chrome often refuse — hvc1 is the one they play)' : ''} — only plays on phones with an HEVC decoder`);
    if (['mpeg4', 'msmpeg4v3', 'mpeg2video', 'mpeg1video', 'vc1', 'wmv3'].includes(c)) problems.push(`${c} video — browsers don't play it`);
    if (kbps > 40000) problems.push(`a very high bitrate (${Math.round(kbps / 1000)} Mbit/s)`);
  }
  for (const x of a) if (['ac3', 'eac3', 'dts', 'truehd', 'pcm_s16le', 'pcm_s24le'].includes(x.codec_name ?? '')) problems.push(`${x.codec_name} sound — many phones play the picture silently or not at all`);
  const summary = v
    ? [
        `${v.codec_name}${v.codec_tag_string && !/^\[/.test(v.codec_tag_string) ? ` (${v.codec_tag_string})` : ''}${v.profile ? ` ${v.profile}` : ''}${v.level ? ` level ${v.codec_name === 'h264' ? v.level / 10 : v.level}` : ''}`,
        `${v.width}×${v.height}`,
        v.pix_fmt,
        v.field_order && v.field_order !== 'unknown' ? v.field_order : null,
        rate(v.avg_frame_rate) ? `${rate(v.avg_frame_rate)} fps` : null,
        kbps ? `${(kbps / 1000).toFixed(1)} Mbit/s` : null,
        a.length ? `sound: ${a.map((x) => x.codec_name).join(', ')}` : 'no sound',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'no picture track';
  return { summary, phone_problems: problems };
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
        // Two at a time, so a page of posters doesn't swamp a Pi — one while someone's watching a movie.
        while (posterRunning >= (someoneWatching() ? 1 : 2)) await new Promise<void>((r) => posterQueue.push(r));
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

/**
 * 🎞️ .mpg → .mp4 copies, so old camcorder / DVD videos play in the browser. Additive only: the
 * .mpg is never changed, moved or deleted; the copy goes next to it as "<name>.mp4" — only if no
 * file of that name is there (never overwritten). Written as a hidden .part file and renamed when
 * ffmpeg is done, so a half-made copy never shows. One at a time, at low priority, in the
 * background. MPEG-2 has to be re-encoded (H.264 + AAC), interlaced pictures are made smooth, and
 * the metadata (tags, chapters) is carried over. Off with Settings → 🎬 Movies.
 */
export const COPY_EXTS = new Set(['.mpg', '.mpeg']);
const mp4Of = (rel: string) => rel.slice(0, rel.length - path.extname(rel).length) + '.mp4';
export const mp4CopiesOn = () => getSetting('movie_mp4_copies') !== 'off';

export const copyStatus: { running: string | null; percent: number | null; paused: boolean; waiting: number; made: number; failed: Array<{ file: string; error: string }> } = {
  running: null,
  paused: false,
  percent: null,
  waiting: 0,
  made: 0,
  failed: [],
};
const copyFailed = new Map<string, string>(); // rel → why (tried again after a restart)
let copying = false;

async function makeMp4Copies(dir: string, files: Array<{ rel: string; size: number; mtimeMs: number }>) {
  if (copying || !mp4CopiesOn()) return;
  copying = true;
  try {
    const have = new Set(files.map((f) => f.rel.toLowerCase()));
    const todo = files.filter((f) => COPY_EXTS.has(path.extname(f.rel).toLowerCase()) && !have.has(mp4Of(f.rel).toLowerCase()) && !copyFailed.has(f.rel));
    copyStatus.waiting = todo.length;
    for (const f of todo) {
      if (!mp4CopiesOn()) break;
      const src = path.join(dir, f.rel);
      const target = path.join(dir, mp4Of(f.rel));
      const part = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.part`);
      await whenIdle();
      copyStatus.running = f.rel;
      copyStatus.percent = null;
      try {
        if (fsSync.existsSync(target)) continue; // something by that name is already there — leave it be
        await fs.access(path.dirname(target), fsSync.constants.W_OK).catch(() => {
          throw new Error("the folder can't be written to by the Family Home Center (read-only share?)");
        });
        const dur = (db.prepare('SELECT duration FROM movie_library_info WHERE rel_path = ?').get(f.rel) as { duration: number | null } | undefined)?.duration ?? null;
        const args = [
          '-nostdin', '-y', '-v', 'error', '-progress', 'pipe:1', '-i', src,
          '-map', '0:v:0', '-map', '0:a?',
          '-vf', 'yadif=deint=interlaced',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2',
          '-c:a', 'aac', '-b:a', '192k',
          '-map_metadata', '0', '-map_chapters', '0',
          '-movflags', '+faststart+use_metadata_tags',
          '-f', 'mp4', part,
        ];
        const nice = process.platform === 'linux' && fsSync.existsSync('/usr/bin/nice');
        await new Promise<void>((resolve, reject) => {
          const proc = nice ? spawn('/usr/bin/nice', ['-n', '19', config.movies.ffmpegPath, ...args]) : spawn(config.movies.ffmpegPath, args);
          let err = '';
          // Someone started watching: pause the copy (SIGSTOP) until they're done, then carry on.
          let paused = false;
          const pauser = setInterval(() => {
            const w = someoneWatching();
            if (w !== paused && proc.pid) {
              try {
                process.kill(proc.pid, w ? 'SIGSTOP' : 'SIGCONT');
                paused = w;
                copyStatus.paused = w;
              } catch {
                /* already finished */
              }
            }
          }, 2000);
          proc.on('close', () => {
            clearInterval(pauser);
            copyStatus.paused = false;
          });
          proc.stdout.on('data', (c) => {
            const m = [...c.toString().matchAll(/out_time_us=(\d+)/g)].pop();
            if (m && dur) copyStatus.percent = Math.min(99, Math.round(Number(m[1]) / 1e6 / dur * 100));
          });
          proc.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
          proc.on('error', reject);
          proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `ffmpeg exited with code ${code}`))));
        });
        if (fsSync.existsSync(target)) throw new Error(`a ${path.basename(target)} appeared while copying — that one was kept as it is`);
        await fs.rename(part, target);
        await fs.utimes(target, new Date(f.mtimeMs), new Date(f.mtimeMs)).catch(() => {}); // sorts by "added" like the original
        copyStatus.made++;
        if (cache) cache.at = 0; // show it on the next look
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ENOENT' && !fsSync.existsSync(src)) continue;
        if (e.code !== 'EEXIST') await fs.unlink(part).catch(() => {}); // only ever our own half-made .part
        if (e.code === 'ENOENT') break; // no ffmpeg — try again next round
        copyFailed.set(f.rel, e.message.slice(0, 300));
        copyStatus.failed = [...copyFailed].map(([file, error]) => ({ file, error })).slice(-20);
      } finally {
        copyStatus.waiting = Math.max(0, copyStatus.waiting - 1);
      }
    }
  } finally {
    copyStatus.running = null;
    copyStatus.percent = null;
    copying = false;
  }
}

/** Look at the share every 10 minutes so new movies (and their lengths) are ready before anyone opens the page. */
export function startMovieLibrary(): void {
  const tick = () => void listLibrary(true).catch((e) => console.warn('[movies] library scan failed:', e));
  setTimeout(tick, 90_000);
  setInterval(tick, 10 * 60_000);
}
