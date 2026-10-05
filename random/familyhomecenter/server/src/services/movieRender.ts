import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { config } from '../config.js';

const OUT_WIDTH = 1920;
const OUT_HEIGHT = 1080;
const FPS = 30;
const FADE_SECONDS = 1;
/** How long the optional title card shows (it counts toward the movie's length). */
export const TITLE_CARD_SECONDS = 4;
/** Crossfade length between photos — it happens within a photo's own time, so it doesn't change
 *  the movie's length. */
const CROSSFADE_SECONDS = 1;
/** Pan & zoom works from frames twice the output size, so the slow motion stays smooth — zoompan
 *  moves in whole source pixels, which at 1:1 shows up as a visible shimmer. */
const MOTION_SCALE = 2;
/** How far pan & zoom zooms over a photo's time on screen. */
const MOTION_ZOOM = 0.12;
/** With music, the video carries on this long past the last photo — the picture fades to black
 *  over the first END_FADE_SECONDS of it while the music finishes fading out. Without music
 *  there's nothing to hear during a black tail, so the movie just ends with the last photo. */
export const MUSIC_TAIL_SECONDS = 4;
const END_FADE_SECONDS = 2;
/** The music fades out over the movie's final this-many seconds. */
const MUSIC_FADE_SECONDS = 10;
/** Share of the progress bar given to preparing (orienting/letterboxing) the photos, before
 *  ffmpeg itself starts — the rest tracks ffmpeg's own -progress output. */
const PREP_PROGRESS_SHARE = 15;
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
 *  video filter's tpad holds the last frame and -t cuts the output at exactly the right length.
 *  `durations` omitted = a plain file list (for joining finished clips). */
function buildConcatList(files: string[], durations?: number[]): string {
  const lines = ['ffconcat version 1.0'];
  files.forEach((f, i) => {
    lines.push(`file ${concatQuote(f)}`);
    if (durations) lines.push(`duration ${durations[i]}`);
  });
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

/** What's shown in the movie, in order: the optional title card, then the photos. */
interface MovieItem {
  kind: 'title' | 'photo';
  /** Source photo (photos only). */
  source?: string;
  caption: string | null;
  seconds: number;
}

/** Fonts the Pi (and most Linux boxes) has; librsvg (inside sharp) picks the first available. */
const FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif";

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** Greedy word wrap by an approximate character budget (no font metrics available here). */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, '…');
  }
  return lines;
}

/** A transparent overlay with the caption on a soft dark band along the bottom. */
function captionSvg(caption: string, width: number, height: number): Buffer {
  const scale = width / 1920;
  const fontSize = Math.round(46 * scale);
  const lineHeight = Math.round(fontSize * 1.3);
  const lines = wrap(caption, 64, 3);
  const bandHeight = lines.length * lineHeight + Math.round(48 * scale);
  const top = height - bandHeight;
  const text = lines
    .map(
      (l, i) =>
        `<text x="${width / 2}" y="${top + Math.round(24 * scale) + (i + 0.8) * lineHeight}" font-family="${FONT}" font-size="${fontSize}" fill="#ffffff" text-anchor="middle">${escapeXml(l)}</text>`
    )
    .join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.35" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient></defs>` +
      `<rect x="0" y="${top - Math.round(30 * scale)}" width="${width}" height="${bandHeight + Math.round(30 * scale)}" fill="url(#g)"/>${text}</svg>`
  );
}

/** The opening card: the title (and optional subtitle) centered on a dark background. */
function titleCardSvg(title: string, subtitle: string, width: number, height: number): Buffer {
  const scale = width / 1920;
  const titleSize = Math.round(96 * scale);
  const subSize = Math.round(48 * scale);
  const titleLines = wrap(title, 30, 3);
  const subLines = subtitle.trim() ? wrap(subtitle, 56, 2) : [];
  const total = titleLines.length * titleSize * 1.2 + (subLines.length ? 30 * scale + subLines.length * subSize * 1.3 : 0);
  let y = height / 2 - total / 2;
  const parts: string[] = [];
  for (const l of titleLines) {
    y += titleSize * 1.2;
    parts.push(`<text x="${width / 2}" y="${y - titleSize * 0.25}" font-family="${FONT}" font-size="${titleSize}" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(l)}</text>`);
  }
  if (subLines.length) y += 30 * scale;
  for (const l of subLines) {
    y += subSize * 1.3;
    parts.push(`<text x="${width / 2}" y="${y - subSize * 0.3}" font-family="${FONT}" font-size="${subSize}" fill="#d0d4dc" text-anchor="middle">${escapeXml(l)}</text>`);
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<defs><radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2b3445"/><stop offset="1" stop-color="#0b0e14"/></radialGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#bg)"/>${parts.join('')}</svg>`
  );
}

interface PreparedFrame {
  /** The picture (with any caption burned in, unless captions are overlaid separately). */
  frame: string;
  /** Separate transparent caption overlay — only for pan & zoom, so the caption stays still while
   *  the photo moves under it. */
  captionOverlay: string | null;
}

/**
 * Turns each item into a ready-to-encode JPEG frame in `frameDir`, all exactly `width`x`height`:
 * photos rotated upright per their EXIF Orientation tag (sharp's .rotate() — ffmpeg's own image
 * decoding doesn't reliably honor that tag, so a portrait phone photo stored sideways came out
 * sideways) and letterboxed onto black; the title card drawn from SVG. Every frame being the same
 * size also matters to ffmpeg: a size change between photos makes it rebuild its filter graph
 * mid-stream, which resets the fps/tpad/fade state and drops photos.
 *
 * Reads the full-size original rather than the cached slideshow thumbnail (services/photos.ts):
 * slower over an SMB share, but the thumbnail is only 1920px wide (too small for a portrait photo
 * to fill a 1080p frame's height, let alone the 4K frames pan & zoom works from) and already
 * JPEG-compressed once. Frames are written at high JPEG quality so this step adds little loss.
 */
async function prepareFrames(
  items: MovieItem[],
  frameDir: string,
  opts: { width: number; height: number; titleCard: { title: string; subtitle: string } | null; separateCaptions: boolean },
  onProgress?: (percent: number) => void
): Promise<PreparedFrame[]> {
  const { width, height } = opts;
  const results = new Array<PreparedFrame>(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      const base = path.join(frameDir, String(i).padStart(6, '0'));
      const framePath = `${base}.jpg`;
      let captionOverlay: string | null = null;
      if (item.kind === 'title') {
        await sharp(titleCardSvg(opts.titleCard?.title ?? '', opts.titleCard?.subtitle ?? '', width, height)).jpeg({ quality: 95 }).toFile(framePath);
      } else {
        let img = sharp(item.source!)
          .rotate() // upright per EXIF Orientation
          .resize(width, height, { fit: 'contain', background: '#000000' })
          .flatten({ background: '#000000' });
        if (item.caption && !opts.separateCaptions) {
          img = sharp(await img.toBuffer()).composite([{ input: captionSvg(item.caption, width, height) }]);
        }
        await img.jpeg({ quality: 95 }).toFile(framePath);
        if (item.caption && opts.separateCaptions) {
          captionOverlay = `${base}-caption.png`;
          await sharp(captionSvg(item.caption, OUT_WIDTH, OUT_HEIGHT)).png().toFile(captionOverlay);
        }
      }
      results[i] = { frame: framePath, captionOverlay };
      done++;
      onProgress?.((done / items.length) * PREP_PROGRESS_SHARE);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PREP_CONCURRENCY, items.length) }, worker));
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

export interface MovieStyle {
  transition: 'cut' | 'crossfade';
  motion: 'none' | 'kenburns';
  /** Show an opening card with the title (and optional subtitle). */
  titleCard: { title: string; subtitle: string } | null;
}

export const DEFAULT_STYLE: MovieStyle = { transition: 'cut', motion: 'none', titleCard: null };

/** The movie's length: title card + photos + (with music) the closing tail. Shared with the
 *  client's "Movie length" readout and "Fit to music" (which mirror it). */
export function movieSeconds(photoCount: number, secondsPerPhoto: number, hasMusic: boolean, style: MovieStyle): number {
  return (style.titleCard ? TITLE_CARD_SECONDS : 0) + photoCount * secondsPerPhoto + (hasMusic ? MUSIC_TAIL_SECONDS : 0);
}

const frames = (seconds: number) => Math.max(1, Math.round(seconds * FPS));

/** zoompan expressions for item `k`, at progress p = (on + offset) / total frames — alternating
 *  zoom in / zoom out and center / pan left→right / pan right→left so consecutive photos differ. */
function motionFilter(k: number, offsetFrames: number, totalFrames: number, outFrames: number): string {
  const p = `((on+${offsetFrames})/${totalFrames})`;
  const zoomIn = k % 2 === 0;
  const z = zoomIn ? `1+${MOTION_ZOOM}*${p}` : `${1 + MOTION_ZOOM}-${MOTION_ZOOM}*${p}`;
  const pan = k % 3; // 0 center, 1 left→right, 2 right→left
  const x = pan === 0 ? 'iw/2-(iw/zoom/2)' : pan === 1 ? `(iw-iw/zoom)*${p}` : `(iw-iw/zoom)*(1-${p})`;
  const y = 'ih/2-(ih/zoom/2)';
  return `zoompan=z='${z}':x='${x}':y='${y}':d=${outFrames}:s=${OUT_WIDTH}x${OUT_HEIGHT}:fps=${FPS}`;
}

/**
 * One item's picture as a filter chain producing `outFrames` frames, starting `offsetFrames` into
 * its own motion (so a photo's pan/zoom carries on smoothly through the crossfade that ends it,
 * which is rendered as part of the *next* clip). Adds the caption overlay on top when it's separate.
 */
function itemChain(
  inputIndex: number,
  captionInputIndex: number | null,
  motion: boolean,
  k: number,
  offsetFrames: number,
  totalFrames: number,
  outFrames: number,
  label: string
): string {
  // Each chain ends by restating the frame rate: trim/setpts/overlay leave it undeclared, and xfade
  // refuses to run on anything but a declared constant frame rate. The timestamps are re-laid on an
  // exact 1/FPS grid first — zoompan's own are slightly off it, and fps alone then drops a frame.
  const base = motion
    ? `[${inputIndex}:v]${motionFilter(k, offsetFrames, totalFrames, outFrames)},setsar=1,format=yuv420p`
    : // Still pictures (the title card) are prepared at the same, larger size as moving ones when
      // pan & zoom is on — bring them back to output size.
      `[${inputIndex}:v]scale=${OUT_WIDTH}:${OUT_HEIGHT},fps=${FPS},trim=end_frame=${outFrames},setpts=PTS-STARTPTS,setsar=1,format=yuv420p`;
  const settle = `setpts=N/${FPS}/TB,fps=${FPS}`;
  if (captionInputIndex === null) return `${base},${settle}[${label}]`;
  return `${base},${settle}[${label}base];[${label}base][${captionInputIndex}:v]overlay=0:0:shortest=1,format=yuv420p,${settle}[${label}]`;
}

/**
 * Crossfade and/or pan & zoom: renders one short clip per item, then joins them without
 * re-encoding. Each clip only ever has two pictures open (its own, and the previous one fading
 * out), so memory stays flat however many photos there are — a single filter graph with an input
 * per photo would hold every one of them at once.
 *
 * Timeline: item k owns [S_k, S_k + d_k). With crossfade, its first CROSSFADE_SECONDS blend in from
 * item k-1, so each item is visible for d + crossfade overall and the movie's length is unchanged.
 */
async function renderClips(
  items: MovieItem[],
  prepared: PreparedFrame[],
  workDir: string,
  opts: { crossfade: boolean; motion: boolean; tailSeconds: number; fadeOutSeconds: number },
  onProgress: (fraction: number) => void
): Promise<string> {
  const T = opts.crossfade ? CROSSFADE_SECONDS : 0;
  const totalFrames = items.reduce((n, it) => n + frames(it.seconds), 0) + frames(opts.tailSeconds || 0.001);
  let doneFrames = 0;
  const clipPaths: string[] = [];

  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    const isLast = k === items.length - 1;
    const ownFrames = frames(item.seconds + (isLast ? opts.tailSeconds : 0));
    // How long item k is visible in total (its own time + the fade into the next item), which its
    // pan & zoom spreads across.
    const span = (i: number) => frames(items[i].seconds + (i === items.length - 1 ? opts.tailSeconds : T));
    const moves = (i: number) => opts.motion && items[i].kind === 'photo';

    const args = ['-y'];
    const filters: string[] = [];
    let nextInput = 0;
    const addPicture = (i: number): { pic: number; cap: number | null } => {
      const pic = nextInput++;
      if (moves(i)) args.push('-i', prepared[i].frame);
      else args.push('-loop', '1', '-framerate', String(FPS), '-i', prepared[i].frame);
      let cap: number | null = null;
      if (prepared[i].captionOverlay) {
        cap = nextInput++;
        args.push('-loop', '1', '-framerate', String(FPS), '-i', prepared[i].captionOverlay!);
      }
      return { pic, cap };
    };

    const b = addPicture(k);
    filters.push(itemChain(b.pic, b.cap, moves(k), k, 0, span(k), ownFrames, 'b'));
    let out = 'b';
    if (T > 0 && k > 0) {
      const a = addPicture(k - 1);
      const tFrames = frames(T);
      filters.push(itemChain(a.pic, a.cap, moves(k - 1), k - 1, frames(items[k - 1].seconds), span(k - 1), tFrames, 'a'));
      filters.push(`[a][b]xfade=transition=fade:duration=${T}:offset=0[x]`);
      out = 'x';
    }
    const extra: string[] = [];
    if (k === 0) extra.push(`fade=t=in:st=0:d=${FADE_SECONDS}`);
    // The end: with a tail (music), fade to black as the photo's own time ends and stay black
    // through the tail; without one, fade during the photo's last moments.
    if (isLast) {
      const st = opts.tailSeconds ? item.seconds : Math.max(0, item.seconds - opts.fadeOutSeconds);
      extra.push(`fade=t=out:st=${st}:d=${opts.fadeOutSeconds}`);
    }
    if (extra.length) {
      filters.push(`[${out}]${extra.join(',')}[v]`);
      out = 'v';
    }

    const clipPath = path.join(workDir, `clip-${String(k).padStart(6, '0')}.mp4`);
    args.push(
      '-filter_complex', filters.join(';'),
      '-map', `[${out}]`,
      '-frames:v', String(ownFrames),
      '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      // Identical encoder settings + timescale in every clip, so they can be joined by stream copy.
      '-video_track_timescale', '15360',
      '-an', '-progress', 'pipe:1', '-nostats', clipPath
    );
    const before = doneFrames;
    await runFfmpeg(args, ownFrames / FPS, (pct) => onProgress((before + (pct / 100) * ownFrames) / totalFrames));
    doneFrames += ownFrames;
    onProgress(doneFrames / totalFrames);
    clipPaths.push(clipPath);
  }

  const listPath = path.join(workDir, 'clips.ffconcat');
  await fs.writeFile(listPath, buildConcatList(clipPaths), 'utf8');
  const joined = path.join(workDir, 'joined.mp4');
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', joined], 1);
  return joined;
}

/**
 * Renders `photoPaths` (in order) into an MP4 slideshow, each shown for `secondsPerPhoto`, with
 * `musicPaths` played back to back underneath (looping from the first track again if they run out
 * before the photos do), or silent if none are given. With music, the video ends
 * MUSIC_TAIL_SECONDS after the last photo — fading to black — and the music fades out over the
 * final MUSIC_FADE_SECONDS; any music left over past that point is simply cut.
 *
 * Optional style: crossfades between photos, slow pan & zoom, an opening title card, and a caption
 * on any photo (`captions[i]` for `photoPaths[i]`).
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
  captions?: Array<string | null>;
  style?: MovieStyle;
  onProgress?: (percent: number) => void;
}): Promise<{ fileName: string }> {
  const { photoPaths, secondsPerPhoto, musicPaths, onProgress } = params;
  const style = params.style ?? DEFAULT_STYLE;
  if (photoPaths.length === 0) throw new Error('No photos to render');

  await fs.mkdir(config.moviesDir, { recursive: true });
  const id = crypto.randomUUID();
  const fileName = `${id}.mp4`;
  const outputPath = path.join(config.moviesDir, fileName);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `movie-${id}-`));
  const joinedMusicPath = path.join(workDir, 'music.flac');

  const items: MovieItem[] = [
    ...(style.titleCard ? [{ kind: 'title' as const, caption: null, seconds: TITLE_CARD_SECONDS }] : []),
    ...photoPaths.map((source, i) => ({ kind: 'photo' as const, source, caption: params.captions?.[i]?.trim() || null, seconds: secondsPerPhoto })),
  ];
  const motion = style.motion === 'kenburns';
  const crossfade = style.transition === 'crossfade';

  try {
    const scale = motion ? MOTION_SCALE : 1;
    const prepared = await prepareFrames(
      items,
      workDir,
      { width: OUT_WIDTH * scale, height: OUT_HEIGHT * scale, titleCard: style.titleCard, separateCaptions: motion },
      onProgress
    );

    let musicInput: string | null = null;
    if (musicPaths.length === 1) {
      musicInput = musicPaths[0];
    } else if (musicPaths.length > 1) {
      await concatMusic(musicPaths, joinedMusicPath);
      musicInput = joinedMusicPath;
    }

    const itemsSeconds = items.reduce((n, it) => n + it.seconds, 0);
    const totalSeconds = musicInput ? itemsSeconds + MUSIC_TAIL_SECONDS : itemsSeconds;
    const toOverall = (percent: number) => onProgress?.(PREP_PROGRESS_SHARE + (percent * (100 - PREP_PROGRESS_SHARE)) / 100);

    if (crossfade || motion) {
      // With music the picture fades to black as the photos end and stays black for the rest of the
      // tail; without music it fades during the last photo.
      const video = await renderClips(
        items,
        prepared,
        workDir,
        {
          crossfade,
          motion,
          tailSeconds: musicInput ? MUSIC_TAIL_SECONDS : 0,
          fadeOutSeconds: musicInput ? END_FADE_SECONDS : FADE_SECONDS,
        },
        (fraction) => toOverall(fraction * 97)
      );
      const args = ['-y', '-i', video];
      if (musicInput) {
        const musicFadeStart = Math.max(0, totalSeconds - MUSIC_FADE_SECONDS);
        args.push(
          '-stream_loop', '-1', '-i', musicInput,
          '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
          '-af', `afade=t=out:st=${musicFadeStart}:d=${Math.min(MUSIC_FADE_SECONDS, totalSeconds)}`,
          '-c:a', 'aac', '-b:a', '192k'
        );
      } else {
        args.push('-c', 'copy');
      }
      args.push('-t', String(totalSeconds), '-movflags', '+faststart', outputPath);
      await runFfmpeg(args, totalSeconds);
      onProgress?.(100);
      return { fileName };
    }

    const concatListPath = path.join(workDir, 'photos.ffconcat');
    await fs.writeFile(concatListPath, buildConcatList(prepared.map((p) => p.frame), items.map((it) => it.seconds)), 'utf8');
    const lastSeconds = items[items.length - 1].seconds;
    // With music the picture fades to black right as the photos end and stays black for the rest
    // of the tail; without music it fades during the last photo instead.
    const videoFadeOut = musicInput
      ? `fade=t=out:st=${itemsSeconds}:d=${END_FADE_SECONDS}`
      : `fade=t=out:st=${Math.max(0, itemsSeconds - FADE_SECONDS)}:d=${FADE_SECONDS}`;
    // fps=30 comes before the fades on purpose: the concat demuxer yields just one frame per photo,
    // so fading before the frame-rate conversion turned that whole first (or last) photo black
    // rather than fading it. The last photo's single frame then only lasts a fraction of
    // a second, so tpad holds it for a full photo's duration plus the tail (see buildConcatList),
    // a bit longer than needed, with -t below doing the exact cut.
    // No scale/pad needed — prepareFrames already made every frame exactly OUT_WIDTHxOUT_HEIGHT.
    const vf =
      `setsar=1,format=yuv420p,fps=${FPS}:start_time=0,` +
      `tpad=stop_mode=clone:stop_duration=${lastSeconds + MUSIC_TAIL_SECONDS + 1},` +
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

    await runFfmpeg(args, totalSeconds, toOverall);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  return { fileName };
}

export async function deleteMovieFile(fileName: string): Promise<void> {
  await fs.rm(path.join(config.moviesDir, fileName), { force: true });
}
