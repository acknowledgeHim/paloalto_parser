import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { config } from '../config.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FADE_SECONDS = 1;

/** ffmpeg's concat-demuxer list format needs a path wrapped in single quotes, with any literal
 *  single quote in the path itself escaped as '\''. */
function concatQuote(absolutePath: string): string {
  return `'${absolutePath.replace(/'/g, "'\\''")}'`;
}

/** The concat demuxer ignores the *last* entry's `duration` line unless that file is repeated
 *  once more afterward with no duration — a well-known quirk, not a bug here. */
function buildConcatList(photoPaths: string[], secondsPerPhoto: number): string {
  const lines = ['ffconcat version 1.0'];
  for (const p of photoPaths) {
    lines.push(`file ${concatQuote(p)}`);
    lines.push(`duration ${secondsPerPhoto}`);
  }
  lines.push(`file ${concatQuote(photoPaths[photoPaths.length - 1])}`);
  return lines.join('\n');
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.movies.ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      // Cap what we retain — a failing run can produce megabytes of frame-by-frame logging.
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`ffmpeg isn't installed (or not on PATH) — see docs/MOVIES_SETUP.md`));
      } else {
        reject(err);
      }
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').slice(-15).join('\n') || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Renders `photoPaths` (in order) into an MP4 slideshow, each shown for `secondsPerPhoto`, with
 * `musicAbsolutePath` looped underneath if given (silent otherwise). Read-only against every
 * source file — ffmpeg is invoked with the photos/music as inputs only; the sole thing ever
 * written is the new file at the returned path, under config.moviesDir. Throws on failure (a
 * missing ffmpeg binary, an unreadable input, etc.) — never partially "succeeds".
 */
export async function renderMovie(params: {
  photoPaths: string[];
  secondsPerPhoto: number;
  musicAbsolutePath: string | null;
}): Promise<{ fileName: string }> {
  const { photoPaths, secondsPerPhoto, musicAbsolutePath } = params;
  if (photoPaths.length === 0) throw new Error('No photos to render');

  await fs.mkdir(config.moviesDir, { recursive: true });
  const id = crypto.randomUUID();
  const fileName = `${id}.mp4`;
  const outputPath = path.join(config.moviesDir, fileName);

  const concatListPath = path.join(os.tmpdir(), `movie-${id}.ffconcat`);
  await fs.writeFile(concatListPath, buildConcatList(photoPaths, secondsPerPhoto), 'utf8');

  const totalSeconds = photoPaths.length * secondsPerPhoto;
  const fadeOutStart = Math.max(0, totalSeconds - FADE_SECONDS);
  const vf =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,` +
    `fade=t=in:st=0:d=${FADE_SECONDS},fade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}`;

  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath];
  if (musicAbsolutePath) {
    args.push('-stream_loop', '-1', '-i', musicAbsolutePath);
  }
  args.push('-vf', vf, '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
  if (musicAbsolutePath) {
    args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);

  try {
    await runFfmpeg(args);
  } finally {
    await fs.rm(concatListPath, { force: true });
  }

  return { fileName };
}

export async function deleteMovieFile(fileName: string): Promise<void> {
  await fs.rm(path.join(config.moviesDir, fileName), { force: true });
}
