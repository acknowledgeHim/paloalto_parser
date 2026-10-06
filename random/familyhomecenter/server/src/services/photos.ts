import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import cron from 'node-cron';
import { config } from '../config.js';
import { db } from '../db.js';
import { getPhotoDate } from './photoDates.js';
import { analyzePhoto } from './photoAnalysis.js';
import { backfillFaceQuality, recordFaceScanFailure, scanPhotoFaces, scanProgress } from './faces/index.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const THUMB_WIDTH = 1920; // downsized for smooth slideshow playback on the Pi's GPU

let cachedList: { scannedAt: number; files: string[] } | null = null;
const RESCAN_MS = 5 * 60 * 1000;

/** Recursively find image files under config.photosDir (handles a local dir or an SMB-mounted share alike). */
async function scanDir(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[photos] cannot read photos dir "${dir}":`, (err as Error).message);
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanDir(full)));
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

export async function listPhotos(): Promise<string[]> {
  if (cachedList && Date.now() - cachedList.scannedAt < RESCAN_MS) return cachedList.files;
  const files = await scanDir(config.photosDir);
  cachedList = { scannedAt: Date.now(), files };
  return files;
}

function thumbIdFor(absolutePath: string): string {
  return crypto.createHash('sha1').update(absolutePath).digest('hex');
}

/** Returns the path to a cached, downsized JPEG for the given absolute photo path, generating it if needed. */
/** Thumbnails being made right now, so two requests for the same photo share one job. */
const inFlight = new Map<string, Promise<string>>();

export async function getOrCreateThumbnail(absolutePath: string): Promise<string> {
  await fs.mkdir(config.thumbsDir, { recursive: true });
  const thumbPath = path.join(config.thumbsDir, `${thumbIdFor(absolutePath)}.jpg`);
  try {
    await fs.access(thumbPath);
    return thumbPath;
  } catch {
    // not cached yet
  }
  const pending = inFlight.get(thumbPath);
  if (pending) return pending;
  // Written to a temp file and renamed into place, so nothing can ever read a half-written thumbnail
  // (the background warm-up and a browser asking for the same photo used to race: the reader saw a
  // partial file and failed with "unsupported image format").
  const job = (async () => {
    const tmp = `${thumbPath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await sharp(absolutePath)
        .rotate() // respect EXIF orientation
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(tmp);
      await fs.rename(tmp, thumbPath);
      return thumbPath;
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    } finally {
      inFlight.delete(thumbPath);
    }
  })();
  inFlight.set(thumbPath, job);
  return job;
}

export function photoIdFor(absolutePath: string): string {
  return thumbIdFor(absolutePath);
}

/** Relative path → photo id for the whole library, worked out once per listing (not per request). */
let idMapCache: { files: string[]; map: Map<string, string>; reverse: Map<string, string> } | null = null;

async function idMaps() {
  const files = await listPhotos();
  if (idMapCache?.files !== files) {
    const map = new Map(files.map((abs) => [path.relative(config.photosDir, abs), thumbIdFor(abs)]));
    idMapCache = { files, map, reverse: new Map([...map].map(([rel, id]) => [id, rel])) };
  }
  return idMapCache;
}

export async function photoIdsByPath(): Promise<Map<string, string>> {
  return (await idMaps()).map;
}

/** Photo id → relative path. */
export async function photoPathsById(): Promise<Map<string, string>> {
  return (await idMaps()).reverse;
}

export async function findPhotoById(id: string): Promise<string | null> {
  const files = await listPhotos();
  return files.find((f) => thumbIdFor(f) === id) ?? null;
}

// ---- Background thumbnail warming ----
// The slow part of viewing a photo for the first time isn't the resize — it's sharp() reading the
// full original file over the network (an SMB share especially). Generating thumbnails ahead of
// time, in the background, means an actual viewer only ever hits the local cache. Sequential (not
// parallel) on purpose: it's gentler on the Pi's memory/CPU and the SMB link while the family is
// using everything else, and it's a one-time cost per photo either way (already-cached files are a
// cheap fs.access check via getOrCreateThumbnail, not re-read).
let warming = false;

/** One photo should take seconds; anything past this (a file that hangs being read over the share)
 *  is given up on so it can't stall the whole library behind it. */
const PHOTO_TIMEOUT_MS = 3 * 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`took longer than ${Math.round(ms / 60_000)} minutes — skipped`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Photos that couldn't be made into a thumbnail, by path → mtime: not re-read every pass, only
 *  once the file changes (or the server restarts). */
const unreadable = new Map<string, number>();

export async function warmThumbnailCache(): Promise<{ processed: number; failed: number }> {
  if (warming) return { processed: 0, failed: 0 };
  warming = true;
  scanProgress.running = true;
  let processed = 0;
  let failed = 0;
  try {
    const files = await listPhotos();
    for (const file of files) {
      const mtime = unreadable.has(file) ? await fs.stat(file).then((s) => s.mtimeMs, () => -1) : null;
      if (mtime !== null && unreadable.get(file) === mtime) continue;
      try {
        await withTimeout(
          (async () => {
            await getOrCreateThumbnail(file);
            // Also warm the date-taken cache, so sorting the movie maker's photo grid by date (and
            // date-range movie selections) doesn't have to read every photo's EXIF on first use.
            await getPhotoDate(file);
            // …and the duplicate/blur analysis (from the thumbnail just made — cheap once it exists).
            await analyzePhoto(file);
            // …and, if face recognition is turned on, look for faces (from the same thumbnail).
            await scanPhotoFaces(file);
          })(),
          PHOTO_TIMEOUT_MS
        );
        unreadable.delete(file);
        processed++;
      } catch (err) {
        failed++;
        console.warn(`[photos] failed to warm thumbnail for "${file}":`, (err as Error).message);
        unreadable.set(file, await fs.stat(file).then((s) => s.mtimeMs, () => -1));
        // Counts as looked at for faces (with the reason), instead of holding the count short forever.
        await recordFaceScanFailure(file, err as Error);
      }
      scanProgress.lastAt = new Date().toISOString();
    }
  } finally {
    warming = false;
    scanProgress.running = false;
  }
  // Faces found before the "facing the camera" score existed get it filled in (once, in the background).
  backfillFaceQuality().catch((e) => console.warn('[faces] re-scoring failed', e));
  if (processed || failed) {
    console.log(`[photos] thumbnail warm-up: ${processed} ok${failed ? `, ${failed} failed` : ''}`);
  }
  return { processed, failed };
}

/** Warms on boot, then re-checks periodically for newly added photos. */
export function startThumbnailWarmSchedule(): void {
  warmThumbnailCache().catch((e) => console.warn('[photos] initial thumbnail warm-up failed', e));
  cron.schedule('*/30 * * * *', () => {
    warmThumbnailCache().catch((e) => console.warn('[photos] scheduled thumbnail warm-up failed', e));
  });
}

// ---- Hidden photos ----

/** Paths (relative to PHOTOS_DIR) of photos marked hidden — see db.ts's hidden_photos. */
export function hiddenPhotoPaths(): Set<string> {
  return new Set((db.prepare('SELECT path FROM hidden_photos').all() as Array<{ path: string }>).map((r) => r.path));
}

/** The library minus hidden photos — what the slideshow, On this day, and random picks draw from. */
export async function listVisiblePhotos(): Promise<string[]> {
  const hidden = hiddenPhotoPaths();
  if (hidden.size === 0) return listPhotos();
  return (await listPhotos()).filter((abs) => !hidden.has(path.relative(config.photosDir, abs)));
}
