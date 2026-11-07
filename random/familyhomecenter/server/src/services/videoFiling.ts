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
 *  - .mov is turned into .mp4 with all its metadata (see convert()) (a quick copy into the new container when the phone's video and sound
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

/** The video's tags (file-level and per-stream), to check none went missing in the .mp4. */
async function tagsOf(file: string): Promise<Map<string, string>> {
  const json = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], 60_000));
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries((json.format?.tags ?? {}) as Record<string, string>)) out.set(k.toLowerCase(), String(v));
  for (const st of (json.streams ?? []) as Array<{ codec_type?: string; tags?: Record<string, string> }>) {
    if (st.codec_type !== 'video' && st.codec_type !== 'audio') continue;
    for (const [k, v] of Object.entries(st.tags ?? {})) {
      // Container bookkeeping that is rewritten by design, not metadata of the recording.
      if (/^(handler_name|vendor_id|encoder|major_brand|minor_version|compatible_brands|language)$/i.test(k)) continue;
      out.set(`${st.codec_type}:${k.toLowerCase()}`, String(v));
    }
  }
  return out;
}

/**
 * .mov → .mp4, keeping all the metadata: every file-level tag (recorded date, location, camera
 * make / model / software, the com.apple.quicktime.* keys) via -map_metadata 0 + use_metadata_tags,
 * per-stream tags, chapters, rotation, every video and sound track — and, when the .mp4 can carry
 * them, the iPhone's extra data tracks (timed location, Live Photo link). Tries a straight copy
 * first; then keeps the picture and redoes the sound; then redoes both. Afterwards the .mp4's tags
 * are compared with the .mov's; anything missing is named in the note (the .mov is kept anyway).
 */
async function convert(from: string, part: string, p: Probe): Promise<{ how: 'copied' | 'audio' | 'encoded'; lost: string[]; dataDropped: boolean }> {
  const meta = ['-map_metadata', '0', '-map_metadata:s:v', '0:s:v', '-map_metadata:s:a', '0:s:a', '-map_chapters', '0', '-movflags', '+faststart+use_metadata_tags'];
  const tag = p.videoCodec === 'hevc' ? ['-tag:v', 'hvc1'] : []; // so iPhones / Macs / TVs play HEVC in .mp4
  const allTracks = ['-map', '0:v', '-map', '0:a?'];
  const withData = [...allTracks, '-map', '0:d?', '-copy_unknown', '-c:d', 'copy'];
  const tries: Array<[string[], 'copied' | 'audio' | 'encoded', boolean]> = [
    [[...withData, '-c:v', 'copy', '-c:a', 'copy', ...tag], 'copied', false],
    [[...allTracks, '-c', 'copy', ...tag], 'copied', true],
    [[...withData, '-c:v', 'copy', ...tag, '-c:a', 'aac', '-b:a', '192k'], 'audio', false],
    [[...allTracks, '-c:v', 'copy', ...tag, '-c:a', 'aac', '-b:a', '192k'], 'audio', true],
    // Re-encoding: just the main picture (ffmpeg turns it upright, so the rotation flag isn't needed).
    [['-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k'], 'encoded', true],
  ];
  let last: Error | null = null;
  for (const [args, how, noData] of tries) {
    try {
      await run(config.movies.ffmpegPath, ['-nostdin', '-y', '-v', 'error', '-i', from, ...args, ...meta, '-f', 'mp4', part], 6 * 3600_000);
      const [before, after] = await Promise.all([tagsOf(from).catch(() => new Map<string, string>()), tagsOf(part).catch(() => new Map<string, string>())]);
      const lost = [...before.keys()].filter((k) => !after.has(k) && !(how === 'encoded' && /^video:(rotate|timecode)$/.test(k)));
      const hadData = noData && (await run(ffprobePath(), ['-v', 'error', '-select_streams', 'd', '-show_entries', 'stream=index', '-of', 'csv=p=0', from], 60_000).catch(() => '')).trim() !== '';
      return { how, lost, dataDropped: hadData };
    } catch (err) {
      last = err as Error;
      await fs.unlink(part).catch(() => {}); // only ever our own half-written .part
    }
  }
  throw last ?? new Error('ffmpeg could not convert it');
}

/** When a video was recorded (for 📤 Add photos' "only between these dates"). */
export async function videoRecordedDate(file: string, hint?: number | null): Promise<Date> {
  return (await recordedDate(file, await probe(file), hint)).date;
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
      const { how, lost, dataDropped } = await convert(file, part, p);
      await fs.rename(part, target);
      await keepIn(inbox, 'Converted', file, name);
      const kept = lost.length ? ` · ⚠️ not carried over: ${lost.slice(0, 6).join(', ')}${lost.length > 6 ? ` +${lost.length - 6}` : ''}` : ' · all metadata kept';
      const data = dataDropped ? ' · iPhone data track (e.g. Live Photo link) only in the original' : '';
      note = `${ext} → .mp4${how === 'copied' ? '' : how === 'audio' ? ' (sound re-encoded)' : ' (re-encoded)'}${kept}${data} · original kept in Inbox/Converted`;
    } else {
      try {
        await fs.rename(file, target);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
        await fs.copyFile(file, target, fsSync.constants.COPYFILE_EXCL); // same bytes, so all its metadata
        await keepIn(inbox, 'Filed', file, name);
      }
    }
    await fs.utimes(target, date, date).catch(() => {}); // so the folder sorts by when it was recorded
    return { ...base, result: 'filed', dest: target, note };
  } catch (err) {
    return { name, result: 'error', dest: null, taken_at: null, date_from: null, note: (err as Error).message.slice(0, 300) };
  }
}
