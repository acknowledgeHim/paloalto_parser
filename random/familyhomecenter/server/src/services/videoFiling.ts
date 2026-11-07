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
 *  - .mov is turned into .mp4 (a quick copy into the new container when the phone's video and sound
 *    fit in an .mp4, which is the usual iPhone case; otherwise re-encoded to H.264 + AAC).
 *  - .mp4 / .m4v are moved as they are.
 *  - Nothing is deleted: the original .mov is moved to Inbox/Converted. An .mp4 is written as a
 *    hidden .part file first and only renamed once ffmpeg finished, so a half-made file never shows.
 *  - The same video already there (same length, same name) → the original goes to Inbox/Duplicates.
 */

export const CONVERT_EXTS = new Set(['.mov', '.qt']);
export const VIDEO_EXTS = new Set([...CONVERT_EXTS, '.mp4', '.m4v']);

import { resolveShare } from './sharePaths.js';

/** Where videos go, as written (a share location like /share/media/movies/takk, or a Pi folder). */
export const videosLocation = () => getSetting('video_dest_dir') || config.videosDir;
/** …and that folder on the Pi (the mounted share, services/sharePaths.ts). */
export const videosDir = () => resolveShare(videosLocation()).local;

const ffprobePath = () => process.env.FFPROBE_PATH || config.movies.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout.on('data', (c) => (out += c.toString()));
    proc.stderr.on('data', (c) => {
      err += c.toString();
      if (err.length > 8000) err = err.slice(-8000);
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new Error(`${path.basename(cmd)} isn't installed — sudo apt install -y ffmpeg (docs/MOVIES_SETUP.md)`) : e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').slice(-6).join('\n') || `${path.basename(cmd)} exited with code ${code}`));
    });
  });
}

/** Can videos be filed now? The movies folder must already exist (a mounted share), so nothing is ever made on the Pi's own disk by mistake. */
export const videosFolderReady = () => fsSync.existsSync(videosDir());

/** Is ffmpeg there? Checked once per Inbox round, so a Pi without it just leaves videos waiting. */
export async function haveFfmpeg(): Promise<boolean> {
  try {
    await run(config.movies.ffmpegPath, ['-version'], 20_000);
    await run(ffprobePath(), ['-version'], 20_000);
    return true;
  } catch {
    return false;
  }
}

interface Probe {
  duration: number | null;
  created: Date | null;
  videoCodec: string | null;
}

async function probe(file: string): Promise<Probe> {
  const json = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], 60_000));
  const tags: Record<string, string> = json.format?.tags ?? {};
  const lower = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]));
  // iPhone: com.apple.quicktime.creationdate keeps the local time zone ("2025-08-14T17:22:01-0700");
  // creation_time is UTC. Either is when it was recorded.
  const created = [lower['com.apple.quicktime.creationdate'], lower['creation_time'], ...(json.streams ?? []).map((s: { tags?: Record<string, string> }) => s.tags?.creation_time)]
    .filter(Boolean)
    .map((s: string) => new Date(s.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')))
    .find((d: Date) => !Number.isNaN(d.getTime()) && d.getFullYear() > 1970);
  const v = (json.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'video');
  const duration = Number(json.format?.duration);
  return { duration: Number.isFinite(duration) ? duration : null, created: created ?? null, videoCodec: v?.codec_name ?? null };
}

/** When was it recorded? The video's own date; then a YEAR folder it came in; then the phone's date; then the file's. */
async function recordedDate(file: string, p: Probe, hint?: number | null): Promise<{ date: Date; from: 'video' | 'folder' | 'phone' | 'file' }> {
  if (p.created) return { date: p.created, from: 'video' };
  const f = folderDate(file);
  if (f) return { date: new Date(f.year, f.month ?? 0, 1, 12), from: 'folder' };
  if (hint && hint > 0) return { date: new Date(hint), from: 'phone' };
  return { date: (await fs.stat(file)).mtime, from: 'file' };
}

async function freeName(dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  for (let i = 1; ; i++) {
    const n = i === 1 ? name : `${base} (${i})${ext}`;
    if (!(await fs.stat(path.join(dir, n)).catch(() => null))) return n;
  }
}

async function sha1(file: string): Promise<string> {
  const h = crypto.createHash('sha1');
  for await (const chunk of fsSync.createReadStream(file)) h.update(chunk as Buffer);
  return h.digest('hex');
}

/** Already filed? Same bytes (for a moved .mp4), or for a converted .mov: an .mp4 of that name with the same length. */
async function alreadyThere(dir: string, file: string, mp4Name: string, p: Probe, converting: boolean): Promise<string | null> {
  const ext = path.extname(mp4Name);
  const base = path.basename(mp4Name, ext);
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => n === mp4Name || (n.startsWith(`${base} (`) && n.endsWith(ext)));
  if (converting) {
    if (p.duration === null) return null;
    for (const n of names) {
      const other = await probe(path.join(dir, n)).catch(() => null);
      if (other?.duration != null && Math.abs(other.duration - p.duration) < 0.25) return n;
    }
    return null;
  }
  const size = (await fs.stat(file)).size;
  let hash: string | null = null;
  for (const n of names) {
    const st = await fs.stat(path.join(dir, n)).catch(() => null);
    if (!st?.isFile() || st.size !== size) continue;
    hash ??= await sha1(file);
    if ((await sha1(path.join(dir, n))) === hash) return n;
  }
  return null;
}

/** Into the Inbox's own keep folder (Converted / Duplicates / Filed) — never deleted. */
async function keepIn(inbox: string, folder: string, file: string, name: string): Promise<void> {
  const dir = path.join(inbox, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.rename(file, path.join(dir, await freeName(dir, name))); // same disk as the Inbox: a rename
}

/** .mov → .mp4. Tries a straight copy into .mp4 first; then keeps the picture and redoes the sound; then redoes both. */
async function convert(from: string, part: string, p: Probe): Promise<'copied' | 'audio' | 'encoded'> {
  const common = ['-nostdin', '-y', '-v', 'error', '-i', from, '-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0', '-movflags', '+faststart+use_metadata_tags'];
  const tag = p.videoCodec === 'hevc' ? ['-tag:v', 'hvc1'] : []; // so iPhones / Macs / TVs play HEVC in .mp4
  const tries: Array<[string[], 'copied' | 'audio' | 'encoded']> = [
    [['-c', 'copy', ...tag], 'copied'],
    [['-c:v', 'copy', ...tag, '-c:a', 'aac', '-b:a', '192k'], 'audio'],
    [['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k'], 'encoded'],
  ];
  let last: Error | null = null;
  for (const [args, how] of tries) {
    try {
      await run(config.movies.ffmpegPath, [...common, ...args, '-f', 'mp4', part], 6 * 3600_000);
      return how;
    } catch (err) {
      last = err as Error;
      await fs.unlink(part).catch(() => {}); // only ever our own half-written .part
    }
  }
  throw last ?? new Error('ffmpeg could not convert it');
}

export interface VideoFiling {
  name: string;
  result: 'filed' | 'duplicate' | 'error';
  dest: string | null;
  taken_at: string | null;
  date_from: string | null;
  note: string | null;
}

/** File one video sitting in the Inbox (or just uploaded there). `inbox` is where originals are kept. */
export async function fileVideo(file: string, inbox: string, dateHint?: number | null, name = path.basename(file)): Promise<VideoFiling> {
  try {
    const ext = path.extname(name).toLowerCase();
    const converting = CONVERT_EXTS.has(ext);
    const p = await probe(file);
    const { date, from } = await recordedDate(file, p, dateHint);
    if (!fsSync.existsSync(videosDir())) throw new Error(`The movies folder ${videosLocation()} isn't there — is that share mounted on the Pi?`);
    const dir = path.join(videosDir(), String(date.getFullYear()));
    await fs.mkdir(dir, { recursive: true });
    const mp4Name = converting ? `${path.basename(name, path.extname(name))}.mp4` : name;
    const base = { name, taken_at: date.toISOString(), date_from: from };

    const twin = await alreadyThere(dir, file, mp4Name, p, converting);
    if (twin) {
      await keepIn(inbox, 'Duplicates', file, name);
      return { ...base, result: 'duplicate', dest: path.join(dir, twin), note: 'Already in the movies folder — moved to Inbox/Duplicates' };
    }

    const target = path.join(dir, await freeName(dir, mp4Name));
    let note: string | null = null;
    if (converting) {
      const part = path.join(dir, `.${path.basename(target)}.${process.pid}.part`);
      const how = await convert(file, part, p);
      await fs.rename(part, target);
      await keepIn(inbox, 'Converted', file, name);
      note = `${ext} → .mp4${how === 'copied' ? '' : how === 'audio' ? ' (sound re-encoded)' : ' (re-encoded)'} · original kept in Inbox/Converted`;
    } else {
      try {
        await fs.rename(file, target);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
        await fs.copyFile(file, target, fsSync.constants.COPYFILE_EXCL);
        await keepIn(inbox, 'Filed', file, name);
      }
    }
    await fs.utimes(target, date, date).catch(() => {}); // so the folder sorts by when it was recorded
    return { ...base, result: 'filed', dest: target, note };
  } catch (err) {
    return { name, result: 'error', dest: null, taken_at: null, date_from: null, note: (err as Error).message.slice(0, 300) };
  }
}
