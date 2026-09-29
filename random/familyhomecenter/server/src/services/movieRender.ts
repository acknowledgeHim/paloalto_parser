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

/**
 * Runs ffmpeg, optionally reporting live progress. `-progress pipe:1` (added by the caller) makes
 * ffmpeg write periodic `key=value` lines to stdout — `out_time_us` (microseconds into the output
 * timeline; deliberately not `out_time_ms`, which despite its name also reports microseconds in
 * ffmpeg's own progress output, a long-standing naming quirk not worth depending on) as a fraction
 * of `totalSeconds` (the slideshow's known total duration) is the percent shown in the UI. This
 * stream has to actually be drained once we ask ffmpeg to produce it, or its pipe buffer fills and
 * ffmpeg blocks trying to write to it — hence always attaching the listener below, not just when
 * onProgress is given.
 */
function runFfmpeg(args: string[], totalSeconds: number, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.movies.ffmpegPath, args);
    let stderr = '';
    let stdoutTail = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      // Cap what we retain — a failing run can produce megabytes of frame-by-frame logging.
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.stdout.on('data', (chunk) => {
      stdoutTail += chunk.toString();
      const lines = stdoutTail.split('\n');
      stdoutTail = lines.pop() ?? ''; // keep any trailing partial line for the next chunk
      if (!onProgress) return;
      for (const line of lines) {
        const match = /^out_time_us=(\d+)/.exec(line);
        if (!match) continue;
        const seconds = Number(match[1]) / 1_000_000;
        onProgress(Math.min(100, Math.max(0, (seconds / totalSeconds) * 100)));
      }
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
  onProgress?: (percent: number) => void;
}): Promise<{ fileName: string }> {
  const { photoPaths, secondsPerPhoto, musicAbsolutePath, onProgress } = params;
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
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath);

  try {
    await runFfmpeg(args, totalSeconds, onProgress);
  } finally {
    await fs.rm(concatListPath, { force: true });
  }

  return { fileName };
}

export async function deleteMovieFile(fileName: string): Promise<void> {
  await fs.rm(path.join(config.moviesDir, fileName), { force: true });
}
