import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/;
const VIDEO_DATA_URL_RE = /^data:video\/(mp4|webm|quicktime|ogg);base64,(.+)$/;
const VIDEO_EXT: Record<string, string> = { mp4: 'mp4', webm: 'webm', quicktime: 'mov', ogg: 'ogv' };

const IMAGE_MAX_DIMENSION = 1600; // plenty for a how-to photo on any screen this app runs on

function mediaPath(fileName: string): string {
  return path.join(config.kbMediaDir, fileName);
}

/** Decodes a base64 image data URL, downscales it, and saves it — returns the file name to store
 *  on the kb_media row. Keeps storage sane regardless of how large the original phone photo was. */
export async function saveKbImage(id: string, dataUrl: string): Promise<string> {
  const match = IMAGE_DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('image must be a base64 data URL (png/jpg/webp/gif)');
  await fs.mkdir(config.kbMediaDir, { recursive: true });
  const fileName = `${id}.jpg`;
  const buffer = Buffer.from(match[2], 'base64');
  await sharp(buffer)
    .rotate()
    .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(mediaPath(fileName));
  return fileName;
}

/** Decodes a base64 video data URL and saves it as-is (sharp can't process video) — returns the
 *  file name to store on the kb_media row. No transcoding, so keep clips short. */
export async function saveKbVideo(id: string, dataUrl: string): Promise<string> {
  const match = VIDEO_DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('video must be a base64 data URL (mp4/webm/mov/ogg)');
  await fs.mkdir(config.kbMediaDir, { recursive: true });
  const fileName = `${id}.${VIDEO_EXT[match[1]] ?? 'mp4'}`;
  const buffer = Buffer.from(match[2], 'base64');
  await fs.writeFile(mediaPath(fileName), buffer);
  return fileName;
}

export async function deleteKbMediaFile(fileName: string): Promise<void> {
  await fs.rm(mediaPath(fileName), { force: true });
}

export async function findKbMediaFile(fileName: string): Promise<string | null> {
  const file = mediaPath(fileName);
  try {
    await fs.access(file);
    return file;
  } catch {
    return null;
  }
}
