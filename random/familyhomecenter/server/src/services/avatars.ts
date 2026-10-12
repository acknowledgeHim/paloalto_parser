import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { config } from '../config.js';

const AVATAR_SIZE = 256;
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/;

function avatarPath(id: string): string {
  return path.join(config.avatarsDir, `${id}.jpg`);
}

/** A "living photo" avatar's looping video (avatar = 'video'); its still (the .jpg above) is the
 *  first frame, shown wherever an avatar is too small to be worth playing. */
function avatarVideoPath(id: string): string {
  return path.join(config.avatarsDir, `${id}.mp4`);
}

/** Video avatars are small on purpose — several can be playing at once on the Family Board. */
const VIDEO_AVATAR_SIZE = 240;

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.movies.ffmpegPath, ['-y', '-loglevel', 'error', ...args]);
    let stderr = '';
    proc.stderr.on('data', (c) => (stderr = (stderr + c.toString()).slice(-2000)));
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`))));
  });
}

/**
 * Makes a member's avatar from a living-photo clip (1920x1080): a square cut from it, centered on
 * `centerX` (0–1 across — where the faces are), shrunk to a small looping video, plus its first
 * frame as the still.
 */
export async function saveAvatarVideo(id: string, clipPath: string, centerX: number): Promise<void> {
  await fs.mkdir(config.avatarsDir, { recursive: true });
  const left = Math.round(Math.max(0, Math.min(1920 - 1080, centerX * 1920 - 540)));
  const vf = `crop=1080:1080:${left}:0,scale=${VIDEO_AVATAR_SIZE}:${VIDEO_AVATAR_SIZE}`;
  const tmp = `${avatarVideoPath(id)}.tmp.mp4`;
  await ffmpeg(['-i', clipPath, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]);
  await ffmpeg(['-i', tmp, '-frames:v', '1', '-q:v', '3', avatarPath(id)]);
  await fs.rename(tmp, avatarVideoPath(id));
}

export async function findAvatarVideo(id: string): Promise<string | null> {
  try {
    await fs.access(avatarVideoPath(id));
    return avatarVideoPath(id);
  } catch {
    return null;
  }
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
  await fs.rm(avatarVideoPath(id), { force: true }); // a new photo replaces a living one
}

export async function deleteAvatarImage(id: string): Promise<void> {
  await fs.rm(avatarPath(id), { force: true });
  await fs.rm(avatarVideoPath(id), { force: true });
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
