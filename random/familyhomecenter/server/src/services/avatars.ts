import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

const AVATAR_SIZE = 256;
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/;

function avatarPath(id: string): string {
  return path.join(config.avatarsDir, `${id}.jpg`);
}

/** Decodes a base64 image data URL from the client, crops it square, and saves it for this member. */
export async function saveAvatarImage(id: string, dataUrl: string): Promise<void> {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('imageDataUrl must be a base64 data URL (png/jpg/webp/gif)');
  await fs.mkdir(config.avatarsDir, { recursive: true });
  const buffer = Buffer.from(match[2], 'base64');
  await sharp(buffer)
    .rotate()
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: 'cover' })
    .jpeg({ quality: 88 })
    .toFile(avatarPath(id));
}

export async function deleteAvatarImage(id: string): Promise<void> {
  await fs.rm(avatarPath(id), { force: true });
}

export async function findAvatarImage(id: string): Promise<string | null> {
  const file = avatarPath(id);
  try {
    await fs.access(file);
    return file;
  } catch {
    return null;
  }
}
