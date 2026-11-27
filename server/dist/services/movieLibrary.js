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
const idFor = (rel) => crypto.createHash('sha1').update(rel).digest('base64url').slice(0, 16);
/** "The.Lion.King.1994.1080p.BluRay" → "The Lion King", 1994. A 2025/ folder gives the year for home videos. */
export function titleFrom(rel) {
    const ext = path.extname(rel);
    let t = path.basename(rel, ext).replace(/[._]+/g, ' ').trim();
    let year = null;
    // The last year in the name that isn't its start ("Blade Runner 2049 (2017)" → 2017, "2001 … (1968)" → 1968).
    const maxYear = new Date().getFullYear() + 1;
    const years = [...t.matchAll(/[\s([]((?:19|20)\d\d)(?=[\])\s]|$)/g)].filter((m) => Number(m[1]) <= maxYear);
    const last = years[years.length - 1];
    if (last && last.index > 0) {
        year = Number(last[1]);
        t = t.slice(0, last.index).replace(/[\s([-]+$/, '').trim() || t;
    }
    t = t.replace(/\s+(1080p|720p|2160p|4k|bluray|brrip|webrip|web-dl|hdrip|x264|x265|hevc|dvdrip)\b.*$/i, '').trim() || path.basename(rel, ext);
    if (!year) {
        const y = rel.split(path.sep).slice(0, -1).reverse().map((p) => p.match(/^((?:19|20)\d\d)$/)?.[1]).find(Boolean);
        if (y)
            year = Number(y);
    }
    return { title: t, year };
}
let cache = null;
let scanning = null;
async function walk(root) {
    const out = [];
    const go = async (d, depth) => {
        if (depth > 12)
            return;
        const items = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
        for (const it of items) {
            if (it.name.startsWith('.') || it.name.startsWith('@') || it.name === '#recycle')
                continue; // hidden, .part, NAS system folders
            const p = path.join(d, it.name);
            if (it.isDirectory())
                await go(p, depth + 1);
            else if (it.isFile() && LIBRARY_EXTS.has(path.extname(it.name).toLowerCase())) {
                const st = await fs.stat(p).catch(() => null);
                if (st && st.size > 0)
                    out.push({ rel: path.relative(root, p), size: st.size, mtimeMs: st.mtimeMs });
            }
        }
    };
    await go(root, 0);
    return out;
}
async function scan() {
    const dir = libraryDir();
    const problem = await folderProblem(dir);
    if (problem) {
        const where = dir !== libraryLocation() ? ` (${libraryLocation()} → ${dir} on the Pi)` : '';
        cache = { at: Date.now(), dir, movies: [], error: `Can't open the movies folder${where}: ${problem} See docs/MOVIES_LIBRARY.md.` };
        return;
    }
    const files = await walk(dir);
    const info = new Map(db.prepare('SELECT * FROM movie_library_info').all().map((i) => [i.rel_path, i]));
    const movies = files.map((f) => {
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
    const rank = (m) => {
        const e = path.extname(m.rel_path).toLowerCase();
        const extRank = { '.mp4': 0, '.m4v': 1, '.webm': 2, '.mov': 3 }[e] ?? 4;
        const upright = UPRIGHT.test(path.basename(m.rel_path, path.extname(m.rel_path))) ? -100 : 0; // a copy saved upright wins
        return upright + (m.playable ? 0 : 10) + (m.video_codec === 'h264' ? 0 : 5) + extRank;
    };
    const groups = new Map();
    for (const m of movies) {
        const key = m.rel_path.slice(0, m.rel_path.length - path.extname(m.rel_path).length).replace(UPRIGHT, '').toLowerCase();
        groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    const shown = [];
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
export async function listLibrary(force = false) {
    // A folder that couldn't be opened is tried again on every look (it may have just been mounted).
    const stale = !cache || !!cache.error || cache.dir !== libraryDir() || Date.now() - cache.at > 10 * 60_000;
    if (force || stale) {
        scanning ??= scan().finally(() => (scanning = null));
        // A first look waits for the list; later ones get the old list while it refreshes.
        if (!cache || force || cache.error || cache.dir !== libraryDir())
            await scanning;
    }
    return { dir: cache.dir, location: libraryLocation(), movies: cache.movies, error: cache.error, scanned_at: cache ? new Date(cache.at).toISOString() : null };
}
export async function findMovie(id) {
    const { dir, movies } = await listLibrary();
    const movie = movies.find((m) => m.id === id);
    if (!movie)
        return null;
    const abs = path.resolve(dir, movie.rel_path);
    if (!abs.startsWith(path.resolve(dir) + path.sep))
        return null;
    return { movie, abs };
}
function run(cmd, args, timeoutMs) {
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
            if (code === 0)
                resolve(out);
            else
                reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `exit ${code}`));
        });
    });
}
/**
 * 🍿 Who's watching right now. A browser fetches a video in many short pieces, so "watching" means
 * a piece was sent in the last 30 s (per person + movie). While anyone is, background work on the
 * share (the .mpg → .mp4 copier, reading lengths, posters) steps aside so the movie and the rest of
 * the app stay smooth.
 */
const viewers = new Map();
const WATCH_WINDOW = 30_000;
export function streamStarted(who, title) {
    const v = viewers.get(who) ?? { title, at: 0, open: 0 };
    v.title = title;
    v.at = Date.now();
    v.open++;
    viewers.set(who, v);
    let done = false;
    return () => {
        if (done)
            return;
        done = true;
        v.open--;
        v.at = Date.now();
    };
}
export function watchingNow() {
    const now = Date.now();
    for (const [k, v] of viewers)
        if (v.open <= 0 && now - v.at > WATCH_WINDOW)
            viewers.delete(k);
    return [...viewers.values()].map((v) => ({ title: v.title, open: v.open }));
}
export const someoneWatching = () => watchingNow().length > 0;
/** Wait until nobody's watching (checked every 5 s). */
async function whenIdle() {
    while (someoneWatching())
        await new Promise((r) => setTimeout(r, 5000));
}
let probing = false;
/** Length / picture size for files not read yet — one at a time, in the background. */
async function probeMissing(dir, files) {
    if (probing)
        return;
    probing = true;
    try {
        const known = new Map(db.prepare('SELECT rel_path, size, mtime_ms FROM movie_library_info').all().map((i) => [i.rel_path, i]));
        const todo = files.filter((f) => {
            const k = known.get(f.rel);
            return !k || k.size !== f.size || k.mtime_ms !== Math.round(f.mtimeMs);
        });
        const save = db.prepare(`INSERT INTO movie_library_info (rel_path, size, mtime_ms, duration, width, height, video_codec, recorded_at, probed_at, error)
       VALUES (@rel_path, @size, @mtime_ms, @duration, @width, @height, @video_codec, @recorded_at, @probed_at, @error)
       ON CONFLICT(rel_path) DO UPDATE SET size = @size, mtime_ms = @mtime_ms, duration = @duration, width = @width, height = @height,
         video_codec = @video_codec, recorded_at = @recorded_at, probed_at = @probed_at, error = @error`);
        let done = 0;
        for (const f of todo) {
            await whenIdle();
            const row = { rel_path: f.rel, size: f.size, mtime_ms: Math.round(f.mtimeMs), duration: null, width: null, height: null, video_codec: null, recorded_at: null, probed_at: new Date().toISOString(), error: null };
            try {
                const j = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path.join(dir, f.rel)], 60_000));
                const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
                const d = Number(j.format?.duration);
                row.duration = Number.isFinite(d) ? d : null;
                row.width = v?.width ?? null;
                row.height = v?.height ?? null;
                row.video_codec = v?.codec_name ?? null;
                const tags = Object.fromEntries(Object.entries((j.format?.tags ?? {})).map(([k, val]) => [k.toLowerCase(), val]));
                const c = tags['com.apple.quicktime.creationdate'] ?? tags['creation_time'];
                const when = c ? new Date(String(c).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) : null;
                row.recorded_at = when && !Number.isNaN(when.getTime()) && when.getFullYear() > 1970 ? when.toISOString() : null;
            }
            catch (err) {
                if (err.code === 'ENOENT')
                    return; // no ffprobe: lengths just stay blank
                row.error = err.message.slice(0, 300);
            }
            save.run(row);
            if (++done % 25 === 0 && cache)
                applyInfo();
        }
        if (done)
            applyInfo();
    }
    finally {
        probing = false;
    }
}
function applyRotations(movies) {
    const rot = new Map(db.prepare('SELECT rel_path, degrees FROM movie_rotation').all().map((r) => [r.rel_path, r.degrees]));
    for (const m of movies)
        m.rotation = rot.get(m.rel_path) ?? 0;
}
/** 🔄 Show a movie turned (0 / 90 / 180 / 270 clockwise). Only remembered here — the file isn't touched. */
export function setRotation(id, degrees, by) {
    const m = cache?.movies.find((x) => x.id === id);
    if (!m)
        return null;
    db.prepare(`INSERT INTO movie_rotation (rel_path, degrees, set_at, by_member) VALUES (?, ?, ?, ?)
     ON CONFLICT(rel_path) DO UPDATE SET degrees = excluded.degrees, set_at = excluded.set_at, by_member = excluded.by_member`).run(m.rel_path, degrees, new Date().toISOString(), by);
    m.rotation = degrees;
    return m;
}
/**
 * ℹ️ What's inside one video — the picture's codec, profile, bit depth, interlacing, size — and
 * anything about it that phones often can't show (they decode in hardware, which handles less
 * than a computer's browser: a phone can play the sound but show a black picture).
 */
export async function videoDetails(abs) {
    const j = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', abs], 60_000));
    const streams = (j.streams ?? []);
    const v = streams.find((x) => x.codec_type === 'video');
    const a = streams.filter((x) => x.codec_type === 'audio');
    const rate = (r) => {
        const [n, d] = (r ?? '').split('/').map(Number);
        return n && d ? Math.round((n / d) * 100) / 100 : null;
    };
    const kbps = Math.round(Number(v?.bit_rate ?? j.format?.bit_rate ?? 0) / 1000);
    const problems = [];
    if (v) {
        const c = v.codec_name ?? '';
        const pf = v.pix_fmt ?? '';
        if (/10|12/.test(pf))
            problems.push(`${/10/.test(pf) ? '10' : '12'}-bit picture (${pf}) — most phones only play 8-bit ${c === 'hevc' ? 'HEVC/' : ''}H.264`);
        if (/422|444/.test(pf))
            problems.push(`${/422/.test(pf) ? '4:2:2' : '4:4:4'} colour (${pf}) — phones only play 4:2:0`);
        if (v.field_order && !['progressive', 'unknown'].includes(v.field_order))
            problems.push(`interlaced picture (${v.field_order}) — phones often show it black or broken`);
        if (c === 'h264' && (v.level ?? 0) > 51)
            problems.push(`H.264 level ${(v.level ?? 0) / 10} — higher than most phones handle (5.1)`);
        if ((v.width ?? 0) > 3840 || (v.height ?? 0) > 2160)
            problems.push(`very large picture (${v.width}×${v.height})`);
        if (c === 'hevc')
            problems.push(`HEVC${v.codec_tag_string === 'hev1' ? ' (tagged hev1, which Android/Chrome often refuse — hvc1 is the one they play)' : ''} — only plays on phones with an HEVC decoder`);
        if (['mpeg4', 'msmpeg4v3', 'mpeg2video', 'mpeg1video', 'vc1', 'wmv3'].includes(c))
            problems.push(`${c} video — browsers don't play it`);
        if (kbps > 40000)
            problems.push(`a very high bitrate (${Math.round(kbps / 1000)} Mbit/s)`);
    }
    for (const x of a)
        if (['ac3', 'eac3', 'dts', 'truehd', 'pcm_s16le', 'pcm_s24le'].includes(x.codec_name ?? ''))
            problems.push(`${x.codec_name} sound — many phones play the picture silently or not at all`);
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
    if (!cache)
        return;
    const info = new Map(db.prepare('SELECT * FROM movie_library_info').all().map((i) => [i.rel_path, i]));
    for (const m of cache.movies) {
        const i = info.get(m.rel_path);
        if (!i || i.size !== m.size)
            continue;
        m.duration = i.duration;
        m.width = i.width;
        m.height = i.height;
        m.video_codec = i.video_codec;
        m.recorded_at = i.recorded_at;
        m.year ??= i.recorded_at ? new Date(i.recorded_at).getFullYear() : null;
    }
}
const posterJobs = new Map();
let posterRunning = 0;
const posterQueue = [];
/** A poster frame (a picture from a bit into the movie), made once and kept. Null if it can't be made. */
export async function posterFor(id) {
    const out = path.join(postersDir, `${id}.jpg`);
    if (fsSync.existsSync(out))
        return out;
    const failed = `${out}.failed`;
    if (fsSync.existsSync(failed))
        return null;
    if (!posterJobs.has(id)) {
        posterJobs.set(id, (async () => {
            const found = await findMovie(id);
            if (!found)
                return null;
            // Two at a time, so a page of posters doesn't swamp a Pi — one while someone's watching a movie.
            while (posterRunning >= (someoneWatching() ? 1 : 2))
                await new Promise((r) => posterQueue.push(r));
            posterRunning++;
            try {
                await fs.mkdir(postersDir, { recursive: true });
                const at = found.movie.duration ? Math.min(found.movie.duration * 0.1, 120) : 5;
                const tmp = `${out}.${process.pid}.tmp.jpg`;
                const args = (t) => ['-nostdin', '-y', '-v', 'error', '-ss', String(t), '-i', found.abs, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', tmp];
                try {
                    await run(config.movies.ffmpegPath, args(at), 120_000);
                    if (!fsSync.existsSync(tmp))
                        await run(config.movies.ffmpegPath, args(0), 120_000);
                    await fs.rename(tmp, out);
                    return out;
                }
                catch (err) {
                    await fs.unlink(tmp).catch(() => { });
                    if (err.code !== 'ENOENT')
                        await fs.writeFile(failed, err.message).catch(() => { });
                    return null;
                }
            }
            finally {
                posterRunning--;
                posterQueue.shift()?.();
            }
        })().finally(() => posterJobs.delete(id)));
    }
    return posterJobs.get(id);
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
const mp4Of = (rel) => rel.slice(0, rel.length - path.extname(rel).length) + '.mp4';
export const mp4CopiesOn = () => getSetting('movie_mp4_copies') !== 'off';
export const copyStatus = {
    running: null,
    paused: false,
    percent: null,
    waiting: 0,
    made: 0,
    failed: [],
};
const copyFailed = new Map(); // rel → why (tried again after a restart)
let copying = false;
async function makeMp4Copies(dir, files) {
    if (copying || !mp4CopiesOn())
        return;
    copying = true;
    try {
        const have = new Set(files.map((f) => f.rel.toLowerCase()));
        const todo = files.filter((f) => COPY_EXTS.has(path.extname(f.rel).toLowerCase()) && !have.has(mp4Of(f.rel).toLowerCase()) && !copyFailed.has(f.rel));
        copyStatus.waiting = todo.length;
        for (const f of todo) {
            if (!mp4CopiesOn())
                break;
            const src = path.join(dir, f.rel);
            const target = path.join(dir, mp4Of(f.rel));
            const part = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.part`);
            await whenIdle();
            copyStatus.running = f.rel;
            copyStatus.percent = null;
            try {
                if (fsSync.existsSync(target))
                    continue; // something by that name is already there — leave it be
                await fs.access(path.dirname(target), fsSync.constants.W_OK).catch(() => {
                    throw new Error("the folder can't be written to by the Family Home Center (read-only share?)");
                });
                const dur = db.prepare('SELECT duration FROM movie_library_info WHERE rel_path = ?').get(f.rel)?.duration ?? null;
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
                await new Promise((resolve, reject) => {
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
                            }
                            catch {
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
                        if (m && dur)
                            copyStatus.percent = Math.min(99, Math.round(Number(m[1]) / 1e6 / dur * 100));
                    });
                    proc.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
                    proc.on('error', reject);
                    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `ffmpeg exited with code ${code}`))));
                });
                if (fsSync.existsSync(target))
                    throw new Error(`a ${path.basename(target)} appeared while copying — that one was kept as it is`);
                await fs.rename(part, target);
                await fs.utimes(target, new Date(f.mtimeMs), new Date(f.mtimeMs)).catch(() => { }); // sorts by "added" like the original
                copyStatus.made++;
                if (cache)
                    cache.at = 0; // show it on the next look
            }
            catch (err) {
                const e = err;
                if (e.code === 'ENOENT' && !fsSync.existsSync(src))
                    continue;
                if (e.code !== 'EEXIST')
                    await fs.unlink(part).catch(() => { }); // only ever our own half-made .part
                if (e.code === 'ENOENT')
                    break; // no ffmpeg — try again next round
                copyFailed.set(f.rel, e.message.slice(0, 300));
                copyStatus.failed = [...copyFailed].map(([file, error]) => ({ file, error })).slice(-20);
            }
            finally {
                copyStatus.waiting = Math.max(0, copyStatus.waiting - 1);
            }
        }
    }
    finally {
        copyStatus.running = null;
        copyStatus.percent = null;
        copying = false;
    }
}
/** "Clip (upright).mp4" — a copy saved the right way up, when "Clip.mp4" was already taken. */
const UPRIGHT = / \(upright\)$/i;
/**
 * 💾 Save it upright: for a video recorded sideways (its "which way up" flag missing or wrong). A
 * new .mp4 is made with the picture really turned — so it plays upright everywhere: phones, VLC,
 * TVs, downloads — next to the original, which is never changed: "Clip.mov" → "Clip.mp4" (or
 * "Clip (upright).mp4" when that's taken; never over an existing file). Date, location and other
 * tags are kept. In the background, one at a time, paused while anyone's watching. 🎬 Movies then
 * lists the pair once, showing the upright one.
 */
export const turnJobs = new Map();
let turning = false;
export function queueUpright(id, degrees) {
    const m = cache?.movies.find((x) => x.id === id);
    if (!m || !cache)
        return 'No such movie';
    if (![90, 180, 270].includes(degrees))
        return 'Turn it first (↺ / ↻)';
    const j = turnJobs.get(id);
    if (j && (j.state === 'waiting' || j.state === 'working'))
        return null;
    turnJobs.set(id, { title: m.title, degrees, state: 'waiting', percent: null, note: null });
    void runTurnJobs(cache.dir);
    return null;
}
async function runTurnJobs(dir) {
    if (turning)
        return;
    turning = true;
    try {
        for (;;) {
            const next = [...turnJobs.entries()].find(([, j]) => j.state === 'waiting');
            if (!next)
                break;
            const [id, job] = next;
            const m = cache?.movies.find((x) => x.id === id);
            if (!m) {
                Object.assign(job, { state: 'failed', note: 'That movie is gone' });
                continue;
            }
            await whenIdle();
            job.state = 'working';
            const src = path.join(dir, m.rel_path);
            const base = m.rel_path.slice(0, m.rel_path.length - path.extname(m.rel_path).length).replace(UPRIGHT, '');
            let target = path.join(dir, `${base}.mp4`);
            if (fsSync.existsSync(target))
                target = path.join(dir, `${base} (upright).mp4`);
            const part = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.part`);
            try {
                if (fsSync.existsSync(target))
                    throw new Error(`${path.basename(target)} is already there — that one was left as it is`);
                await fs.access(path.dirname(target), fsSync.constants.W_OK).catch(() => {
                    throw new Error("the folder can't be written to by the Family Home Center (read-only share?)");
                });
                const turn = job.degrees === 90 ? 'transpose=1' : job.degrees === 270 ? 'transpose=2' : 'hflip,vflip';
                const args = [
                    '-nostdin', '-y', '-v', 'error', '-progress', 'pipe:1', '-i', src,
                    '-map', '0:v:0', '-map', '0:a?',
                    // ffmpeg first applies any "which way up" flag the file has (as the browser did), then our turn.
                    '-vf', `${turn},format=yuv420p`,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-threads', '2',
                    '-c:a', 'aac', '-b:a', '192k',
                    '-map_metadata', '0', '-metadata:s:v:0', 'rotate=0',
                    '-metadata', 'major_brand=', '-metadata', 'minor_version=', '-metadata', 'compatible_brands=',
                    '-movflags', '+faststart+use_metadata_tags',
                    '-f', 'mp4', part,
                ];
                const nice = process.platform === 'linux' && fsSync.existsSync('/usr/bin/nice');
                await new Promise((resolve, reject) => {
                    const proc = nice ? spawn('/usr/bin/nice', ['-n', '10', config.movies.ffmpegPath, ...args]) : spawn(config.movies.ffmpegPath, args);
                    let err = '';
                    let paused = false;
                    const pauser = setInterval(() => {
                        const w = someoneWatching();
                        if (w !== paused && proc.pid) {
                            try {
                                process.kill(proc.pid, w ? 'SIGSTOP' : 'SIGCONT');
                                paused = w;
                            }
                            catch {
                                /* finished */
                            }
                        }
                    }, 2000);
                    proc.stdout.on('data', (c) => {
                        const t = [...c.toString().matchAll(/out_time_us=(\d+)/g)].pop();
                        if (t && m.duration)
                            job.percent = Math.min(99, Math.round((Number(t[1]) / 1e6 / m.duration) * 100));
                    });
                    proc.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
                    proc.on('error', reject);
                    proc.on('close', (code) => {
                        clearInterval(pauser);
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error(err.trim().split('\n').slice(-3).join(' ') || `ffmpeg exited with code ${code}`));
                    });
                });
                if (fsSync.existsSync(target))
                    throw new Error(`a ${path.basename(target)} appeared meanwhile — that one was kept as it is`);
                await fs.rename(part, target);
                const st = await fs.stat(src).catch(() => null);
                if (st)
                    await fs.utimes(target, st.atime, st.mtime).catch(() => { }); // sorts by "added" like the original
                Object.assign(job, { state: 'done', percent: 100, note: path.basename(target) });
                if (cache)
                    cache.at = 0; // list it on the next look
            }
            catch (err) {
                await fs.unlink(part).catch(() => { }); // only ever our own half-made file
                Object.assign(job, { state: 'failed', note: err.message.slice(0, 300) });
            }
        }
    }
    finally {
        turning = false;
    }
}
/** Look at the share every 10 minutes so new movies (and their lengths) are ready before anyone opens the page. */
export function startMovieLibrary() {
    const tick = () => void listLibrary(true).catch((e) => console.warn('[movies] library scan failed:', e));
    setTimeout(tick, 90_000);
    setInterval(tick, 10 * 60_000);
}
