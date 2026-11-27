import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getSetting } from '../db.js';
import { folderDate } from './photoDates.js';
/**
 * 🎬 Videos from the 📥 Inbox (and 📤 Add photos) go to <VIDEOS_DIR>/<YYYY>/ — by default
 * /share/media/movies/takk/2025/ — by the year they were recorded.
 *  - Every video (.mov, .mp4, .m4v) is moved as it is — the same bytes, so all its metadata.
 *    A .mov can be downloaded as an .mp4 from 🎬 Movies (mp4Stream(), made while it downloads).
 *  - Nothing is deleted: across disks it's copied and the original is kept in Inbox/Filed.
 *  - The same video already there (same bytes; or an .mp4 made from it earlier, same name and
 *    length) → the original goes to Inbox/Duplicates.
 */
export const MOV_EXTS = new Set(['.mov', '.qt']);
export const VIDEO_EXTS = new Set([...MOV_EXTS, '.mp4', '.m4v']);
import { resolveShare } from './sharePaths.js';
/** Where videos go, as written (a share location like /share/media/movies/takk, or a Pi folder). */
export const videosLocation = () => getSetting('video_dest_dir') || config.videosDir;
/** …and that folder on the Pi (the mounted share, services/sharePaths.ts). */
export const videosDir = () => resolveShare(videosLocation()).local;
const ffprobePath = () => process.env.FFPROBE_PATH || config.movies.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
function run(cmd, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args);
        let out = '';
        let err = '';
        const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
        proc.stdout.on('data', (c) => (out += c.toString()));
        proc.stderr.on('data', (c) => {
            err += c.toString();
            if (err.length > 8000)
                err = err.slice(-8000);
        });
        proc.on('error', (e) => {
            clearTimeout(timer);
            reject(e.code === 'ENOENT' ? new Error(`${path.basename(cmd)} isn't installed — sudo apt install -y ffmpeg (docs/MOVIES_SETUP.md)`) : e);
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0)
                resolve(out);
            else
                reject(new Error(err.trim().split('\n').slice(-6).join('\n') || `${path.basename(cmd)} exited with code ${code}`));
        });
    });
}
/** Can videos be filed now? The movies folder must already exist (a mounted share), so nothing is ever made on the Pi's own disk by mistake. */
export const videosFolderReady = () => fsSync.existsSync(videosDir());
/** Is ffmpeg there? Checked once per Inbox round, so a Pi without it just leaves videos waiting. */
export async function haveFfmpeg() {
    try {
        await run(config.movies.ffmpegPath, ['-version'], 20_000);
        await run(ffprobePath(), ['-version'], 20_000);
        return true;
    }
    catch {
        return false;
    }
}
async function probe(file) {
    const json = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], 60_000));
    const tags = json.format?.tags ?? {};
    const lower = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]));
    // iPhone: com.apple.quicktime.creationdate keeps the local time zone ("2025-08-14T17:22:01-0700");
    // creation_time is UTC. Either is when it was recorded.
    const created = [lower['com.apple.quicktime.creationdate'], lower['creation_time'], ...(json.streams ?? []).map((s) => s.tags?.creation_time)]
        .filter(Boolean)
        .map((s) => new Date(s.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')))
        .find((d) => !Number.isNaN(d.getTime()) && d.getFullYear() > 1970);
    const v = (json.streams ?? []).find((s) => s.codec_type === 'video');
    const duration = Number(json.format?.duration);
    return { duration: Number.isFinite(duration) ? duration : null, created: created ?? null, videoCodec: v?.codec_name ?? null };
}
/** When was it recorded? The video's own date; then a YEAR folder it came in; then the phone's date; then the file's. */
async function recordedDate(file, p, hint) {
    if (p.created)
        return { date: p.created, from: 'video' };
    const f = folderDate(file);
    if (f)
        return { date: new Date(f.year, f.month ?? 0, 1, 12), from: 'folder' };
    if (hint && hint > 0)
        return { date: new Date(hint), from: 'phone' };
    return { date: (await fs.stat(file)).mtime, from: 'file' };
}
async function freeName(dir, name) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    for (let i = 1;; i++) {
        const n = i === 1 ? name : `${base} (${i})${ext}`;
        if (!(await fs.stat(path.join(dir, n)).catch(() => null)))
            return n;
    }
}
async function sha1(file) {
    const h = crypto.createHash('sha1');
    for await (const chunk of fsSync.createReadStream(file))
        h.update(chunk);
    return h.digest('hex');
}
/** Already filed? The same bytes under its name (or "name (2)"…); for a .mov also an .mp4 made from it before (same name, same length). */
async function alreadyThere(dir, file, name, p) {
    const all = await fs.readdir(dir).catch(() => []);
    const like = (n, target) => {
        const ext = path.extname(target);
        const base = path.basename(target, ext);
        return n === target || (n.startsWith(`${base} (`) && n.endsWith(ext));
    };
    const size = (await fs.stat(file)).size;
    let hash = null;
    for (const n of all.filter((n) => like(n, name))) {
        const st = await fs.stat(path.join(dir, n)).catch(() => null);
        if (!st?.isFile() || st.size !== size)
            continue;
        hash ??= await sha1(file);
        if ((await sha1(path.join(dir, n))) === hash)
            return n;
    }
    if (MOV_EXTS.has(path.extname(name).toLowerCase()) && p.duration !== null) {
        const mp4 = `${path.basename(name, path.extname(name))}.mp4`;
        for (const n of all.filter((n) => like(n, mp4))) {
            const other = await probe(path.join(dir, n)).catch(() => null);
            if (other?.duration != null && Math.abs(other.duration - p.duration) < 0.25)
                return n;
        }
    }
    return null;
}
/** Into the Inbox's own keep folder (Converted / Duplicates / Filed) — never deleted. */
async function keepIn(inbox, folder, file, name) {
    const dir = path.join(inbox, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(file, path.join(dir, await freeName(dir, name))); // same disk as the Inbox: a rename
}
/**
 * A .mov as an .mp4, made while it downloads (written to `out`, nothing kept on disk): the same
 * picture and sound (copied, not re-encoded — only sound an .mp4 can't hold is redone as AAC) with
 * all the metadata (recorded date, location, camera, com.apple.quicktime.*, stream tags, chapters,
 * rotation). A fragmented .mp4, since it's written as a stream — every player opens it.
 */
export async function mp4Stream(file, out, onError) {
    const json = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_streams', file], 60_000).catch(() => '{}'));
    const streams = (json.streams ?? []);
    const v = streams.find((s) => s.codec_type === 'video');
    const audioOk = streams.filter((s) => s.codec_type === 'audio').every((s) => /^(aac|mp3|alac|ac3|eac3|opus|flac)$/.test(s.codec_name ?? ''));
    const args = [
        '-nostdin', '-v', 'error', '-i', file,
        '-map', '0:v', '-map', '0:a?',
        '-c:v', 'copy', ...(v?.codec_name === 'hevc' ? ['-tag:v', 'hvc1'] : []),
        ...(audioOk ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k']),
        '-map_metadata', '0', '-map_metadata:s:v', '0:s:v', '-map_metadata:s:a', '0:s:a', '-map_chapters', '0',
        // The .mov's own file-type labels aren't about the recording — drop them so they aren't copied in as tags.
        '-metadata', 'major_brand=', '-metadata', 'minor_version=', '-metadata', 'compatible_brands=',
        '-movflags', 'frag_keyframe+empty_moov+use_metadata_tags',
        '-f', 'mp4', 'pipe:1',
    ];
    const proc = spawn(config.movies.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
    proc.on('error', (e) => onError(e));
    proc.on('close', (code) => {
        if (code)
            onError(new Error(err.trim().split('\n').slice(-3).join(' ') || `ffmpeg exited with code ${code}`));
    });
    proc.stdout.pipe(out);
    return () => proc.kill('SIGKILL');
}
/** When a video was recorded (for 📤 Add photos' "only between these dates"). */
export async function videoRecordedDate(file, hint) {
    return (await recordedDate(file, await probe(file), hint)).date;
}
/** File one video sitting in the Inbox (or just uploaded there). `inbox` is where originals are kept. */
export async function fileVideo(file, inbox, dateHint, name = path.basename(file)) {
    try {
        const p = await probe(file);
        const { date, from } = await recordedDate(file, p, dateHint);
        if (!fsSync.existsSync(videosDir()))
            throw new Error(`The movies folder ${videosLocation()} isn't there — is that share mounted on the Pi?`);
        const dir = path.join(videosDir(), String(date.getFullYear()));
        await fs.mkdir(dir, { recursive: true });
        const base = { name, taken_at: date.toISOString(), date_from: from };
        const twin = await alreadyThere(dir, file, name, p);
        if (twin) {
            await keepIn(inbox, 'Duplicates', file, name);
            return { ...base, result: 'duplicate', dest: path.join(dir, twin), note: 'Already in the movies folder — moved to Inbox/Duplicates' };
        }
        const target = path.join(dir, await freeName(dir, name));
        const note = null;
        try {
            await fs.rename(file, target);
        }
        catch (err) {
            if (err.code !== 'EXDEV')
                throw err;
            await fs.copyFile(file, target, fsSync.constants.COPYFILE_EXCL); // same bytes, so all its metadata
            await keepIn(inbox, 'Filed', file, name);
        }
        await fs.utimes(target, date, date).catch(() => { }); // so the folder sorts by when it was recorded
        return { ...base, result: 'filed', dest: target, note };
    }
    catch (err) {
        return { name, result: 'error', dest: null, taken_at: null, date_from: null, note: err.message.slice(0, 300) };
    }
}
