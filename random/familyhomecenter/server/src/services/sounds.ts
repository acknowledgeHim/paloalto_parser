import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const DATA_URL_RE = /^data:audio\/(mpeg|mp3);base64,(.+)$/;
// Uploads aren't trimmed server-side (no audio processing dependency) — playback stops itself
// after a few seconds instead (see client/src/utils/sounds.ts's playCustomSound).
const MAX_BYTES = 10 * 1024 * 1024; // 10MB — comfortably fits a full song at typical bitrates

function soundPath(id: string): string {
  return path.join(config.soundsDir, `${id}.mp3`);
}

/** Decodes a base64 MP3 data URL from the client and saves it for this member. */
export async function saveCompletionSound(id: string, dataUrl: string): Promise<void> {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('audioDataUrl must be a base64 audio/mpeg data URL');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_BYTES) throw new Error('That MP3 is too large (10MB max)');
  await fs.mkdir(config.soundsDir, { recursive: true });
  await fs.writeFile(soundPath(id), buffer);
}

export async function deleteCompletionSound(id: string): Promise<void> {
  await fs.rm(soundPath(id), { force: true });
}

export async function findCompletionSound(id: string): Promise<string | null> {
  const file = soundPath(id);
  try {
    await fs.access(file);
    return file;
  } catch {
    return null;
  }
}
