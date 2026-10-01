import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { config } from '../config.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const FADE_SECONDS = 1;
/** With music, the video carries on this long past the last photo — the picture fades to black
 *  over the first END_FADE_SECONDS of it while the music finishes fading out. Without music
 *  there's nothing to hear during a black tail, so the movie just ends with the last photo. */
const MUSIC_TAIL_SECONDS = 4;
const END_FADE_SECONDS = 2;
/** The music fades out over the movie's final this-many seconds. */
const MUSIC_FADE_SECONDS = 10;
/** Share of the progress bar given to preparing (orienting/letterboxing) the photos, before
 *  ffmpeg itself starts — the rest tracks ffmpeg's own -progress output. */
const PREP_PROGRESS_SHARE = 25;
/** Kept low on purpose — each worker decodes a full-size original (easily 12-48MP) in memory,
 *  which adds up fast on a Pi, and each one is also a full-file read over the SMB share. */
const PREP_CONCURRENCY = 2;

/** ffmpeg's concat-demuxer list format needs a path wrapped in single quotes, with any literal
 *  single quote in the path itself escaped as '\''. */
function concatQuote(absolutePath: string): string {
  return `'${absolutePath.replace(/'/g, "'\\''")}'`;
}

/** Deliberately *not* using the common trick of repeating the last file once more with no
 *  duration: that made the video run on well past the last photo's own duration, and for a
 *  single-photo movie it collapsed the whole thing to one frame once -t was applied. Instead the
 *  video filter's tpad holds the last frame and -t cuts the output at exactly the right length. */
function buildConcatList(photoPaths: string[], secondsPerPhoto: number): string {
  const lines = ['ffconcat version 1.0'];
  for (const p of photoPaths) {
    lines.push(`file ${concatQuote(p)}`);
    lines.push(`duration ${secondsPerPhoto}`);
  }
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
 * Turns each photo into a ready-to-encode WIDTHxHEIGHT JPEG frame in `frameDir`: rotated upright
 * per its EXIF Orientation tag (sharp's .rotate() — ffmpeg's own image decoding doesn't reliably
 * honor that tag, so a portrait phone photo stored sideways came out sideways) and letterboxed
 * onto black. Every frame being the same size also matters to ffmpeg: a size change between
 * photos makes it rebuild its filter graph mid-stream, which resets the fps/tpad/fade state and
 * drops photos.
 *
 * Reads the full-size original rather than the cached slideshow thumbnail (services/photos.ts):
 * slower over an SMB share, but the thumbnail is only 1920px wide (too small for a portrait photo
 * to fill a 1080p frame's height) and already JPEG-compressed once, so starting from it would cost
 * quality. Frames are written at high JPEG quality so this step adds as little loss as possible.
 */
async function prepareFrames(
  photoPaths: string[],
  frameDir: string,
  onProgress?: (percent: number) => void
): Promise<string[]> {
  const results = new Array<string>(photoPaths.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < photoPaths.length) {
      const i = next++;
      const framePath = path.join(frameDir, `${String(i).padStart(6, '0')}.jpg`);
      await sharp(photoPaths[i])
        .rotate() // upright per EXIF Orientation
        .resize(WIDTH, HEIGHT, { fit: 'contain', background: '#000000' })
        .flatten({ background: '#000000' })
        .jpeg({ quality: 95 })
        .toFile(framePath);
      results[i] = framePath;
      done++;
      onProgress?.((done / photoPaths.length) * PREP_PROGRESS_SHARE);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PREP_CONCURRENCY, photoPaths.length) }, worker));
  return results;
}

/**
 * Joins several music tracks, back to back in order, into one temporary FLAC (lossless, so the
 * final AAC encode is still only a single lossy generation) — the main render then just loops that
 * one file, the same as it would a single track. Each track is normalized to the same sample
 * rate/layout first since the concat filter needs every segment to match, and a library can easily
 * mix 44.1kHz MP3s with 48kHz FLACs.
 */
async function concatMusic(trackPaths: string[], outputPath: string): Promise<void> {
  const args = ['-y'];
  for (const t of trackPaths) args.push('-i', t);
  const normalized = trackPaths
    .map((_, i) => `[${i}:a:0]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`)
    .join(';');
  const inputs = trackPaths.map((_, i) => `[a${i}]`).join('');
  args.push(
    '-filter_complex', `${normalized};${inputs}concat=n=${trackPaths.length}:v=0:a=1[out]`,
    '-map', '[out]', '-c:a', 'flac', outputPath
  );
  await runFfmpeg(args, 1);
}

/**
 * Renders `photoPaths` (in order) into an MP4 slideshow, each shown for `secondsPerPhoto`, with
 * `musicPaths` played back to back underneath (looping from the first track again if they run out
 * before the photos do), or silent if none are given. With music, the video ends
 * MUSIC_TAIL_SECONDS after the last photo — fading to black — and the music fades out over the
 * final MUSIC_FADE_SECONDS; any music left over past that point is simply cut.
 *
 * Read-only against every source file — the photos/music are only ever ffmpeg/sharp inputs; the
 * sole things written are the new movie file under config.moviesDir and a temp working dir (always
 * removed afterward). Throws on failure (a missing ffmpeg binary, an unreadable input,
 * etc.) — never partially "succeeds".
 */
export async function renderMovie(params: {
  photoPaths: string[];
  secondsPerPhoto: number;
  musicPaths: string[];
  onProgress?: (percent: number) => void;
}): Promise<{ fileName: string }> {
  const { photoPaths, secondsPerPhoto, musicPaths, onProgress } = params;
  if (photoPaths.length === 0) throw new Error('No photos to render');

  await fs.mkdir(config.moviesDir, { recursive: true });
  const id = crypto.randomUUID();
  const fileName = `${id}.mp4`;
  const outputPath = path.join(config.moviesDir, fileName);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `movie-${id}-`));
  const concatListPath = path.join(workDir, 'photos.ffconcat');
  const joinedMusicPath = path.join(workDir, 'music.flac');

  try {
    const framePaths = await prepareFrames(photoPaths, workDir, onProgress);
    await fs.writeFile(concatListPath, buildConcatList(framePaths, secondsPerPhoto), 'utf8');

    let musicInput: string | null = null;
    if (musicPaths.length === 1) {
      musicInput = musicPaths[0];
    } else if (musicPaths.length > 1) {
      await concatMusic(musicPaths, joinedMusicPath);
      musicInput = joinedMusicPath;
    }

    const photosSeconds = photoPaths.length * secondsPerPhoto;
    const totalSeconds = musicInput ? photosSeconds + MUSIC_TAIL_SECONDS : photosSeconds;
    // With music the picture fades to black right as the photos end and stays black for the rest
    // of the tail; without music it fades during the last photo instead.
    const videoFadeOut = musicInput
      ? `fade=t=out:st=${photosSeconds}:d=${END_FADE_SECONDS}`
      : `fade=t=out:st=${Math.max(0, photosSeconds - FADE_SECONDS)}:d=${FADE_SECONDS}`;
    // fps=30 comes before the fades on purpose: the concat demuxer yields just one frame per photo,
    // so fading before the frame-rate conversion turned that whole first (or last) photo black
    // rather than fading it. The last photo's single frame then only lasts a fraction of
    // a second, so tpad holds it for a full photo's duration plus the tail (see buildConcatList),
    // a bit longer than needed, with -t below doing the exact cut.
    // No scale/pad needed — prepareFrames already made every frame exactly WIDTHxHEIGHT.
    const vf =
      `setsar=1,format=yuv420p,fps=30:start_time=0,` +
      `tpad=stop_mode=clone:stop_duration=${secondsPerPhoto + MUSIC_TAIL_SECONDS + 1},` +
      `fade=t=in:st=0:d=${FADE_SECONDS},${videoFadeOut}`;

    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath];
    if (musicInput) args.push('-stream_loop', '-1', '-i', musicInput);
    args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
    if (musicInput) {
      const musicFadeStart = Math.max(0, totalSeconds - MUSIC_FADE_SECONDS);
      args.push(
        '-map', '0:v:0', '-map', '1:a:0',
        '-af', `afade=t=out:st=${musicFadeStart}:d=${Math.min(MUSIC_FADE_SECONDS, totalSeconds)}`,
        '-c:a', 'aac', '-b:a', '192k'
      );
    } else {
      args.push('-an');
    }
    // An explicit -t rather than -shortest: with a looped (endless) music input, -shortest is
    // known to overshoot past the end of the video, leaving a long black stretch of music.
    args.push('-t', String(totalSeconds), '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath);

    await runFfmpeg(args, totalSeconds, (percent) =>
      onProgress?.(PREP_PROGRESS_SHARE + (percent * (100 - PREP_PROGRESS_SHARE)) / 100)
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  return { fileName };
}

export async function deleteMovieFile(fileName: string): Promise<void> {
  await fs.rm(path.join(config.moviesDir, fileName), { force: true });
}
