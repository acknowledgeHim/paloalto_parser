import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import cron from 'node-cron';
import { config } from '../config.js';

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
export async function getOrCreateThumbnail(absolutePath: string): Promise<string> {
  await fs.mkdir(config.thumbsDir, { recursive: true });
  const thumbPath = path.join(config.thumbsDir, `${thumbIdFor(absolutePath)}.jpg`);
  try {
    await fs.access(thumbPath);
    return thumbPath;
  } catch {
    // not cached yet
  }
  await sharp(absolutePath)
    .rotate() // respect EXIF orientation
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(thumbPath);
  return thumbPath;
}

export function photoIdFor(absolutePath: string): string {
  return thumbIdFor(absolutePath);
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

export async function warmThumbnailCache(): Promise<{ processed: number; failed: number }> {
  if (warming) return { processed: 0, failed: 0 };
  warming = true;
  let processed = 0;
  let failed = 0;
  try {
    const files = await listPhotos();
    for (const file of files) {
      try {
        await getOrCreateThumbnail(file);
        processed++;
      } catch (err) {
        failed++;
        console.warn(`[photos] failed to warm thumbnail for "${file}":`, (err as Error).message);
      }
    }
  } finally {
    warming = false;
  }
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
