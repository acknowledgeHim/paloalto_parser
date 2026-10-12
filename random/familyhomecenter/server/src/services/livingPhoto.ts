import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { config } from '../config.js';

/**
 * "Living photos": one photo turned into a short video clip that loops seamlessly — a slow zoom
 * toward the faces, a gentle side-to-side drift, or a 3-D depth effect (the people float in front
 * of a softly blurred background) — optionally with sparkles, snow, hearts, bubbles, or petals
 * drifting over it. Entirely on this machine: every frame is cut from the photo with sharp and
 * streamed into ffmpeg; the original photo is only read.
 *
 * Everything moves on a loop (cosine/sine of the clip's own length), so the last frame flows back
 * into the first — it can play on repeat (or as the screensaver) without a jump.
 */

export const LIVING_EFFECTS = ['zoom', 'drift', 'depth'] as const;
export const LIVING_OVERLAYS = ['none', 'sparkles', 'snow', 'hearts', 'bubbles', 'petals'] as const;
export const LIVING_SECONDS = [5, 8, 12] as const;
export type LivingEffect = (typeof LIVING_EFFECTS)[number];
export type LivingOverlay = (typeof LIVING_OVERLAYS)[number];

const W = 1920;
const H = 1080;
const FPS = 25;
/** Frames are cut from a copy twice the output size, so slow motion stays smooth (no shimmer). */
const S = 2;
const CW = W * S;
const CH = H * S;

/** Faces (fractions of the upright photo, from face recognition) — where to zoom / what to lift. */
export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The photo, fitted into a 16:9 canvas over a blurred, darkened copy of itself (no black bars). */
async function prepareCanvas(photoPath: string): Promise<{ canvas: Buffer; photoRect: Rect }> {
  const upright = await sharp(photoPath).rotate().removeAlpha().toBuffer({ resolveWithObject: true });
  const { width: pw, height: ph } = upright.info;
  const fit = Math.min(CW / pw, CH / ph);
  const width = Math.round(pw * fit);
  const height = Math.round(ph * fit);
  const photoRect = { left: Math.round((CW - width) / 2), top: Math.round((CH - height) / 2), width, height };
  const fill = await sharp(upright.data)
    .resize(CW / 8, CH / 8, { fit: 'cover' })
    .blur(6)
    .modulate({ brightness: 0.55 })
    .resize(CW, CH)
    .toBuffer();
  const photo = await sharp(upright.data).resize(width, height).toBuffer();
  const canvas = await sharp(fill).composite([{ input: photo, left: photoRect.left, top: photoRect.top }]).removeAlpha().raw().toBuffer();
  return { canvas, photoRect };
}

/** Face boxes in canvas pixels. */
function facesOnCanvas(faces: FaceBox[], r: Rect): Rect[] {
  return faces.map((f) => ({ left: r.left + f.x * r.width, top: r.top + f.y * r.height, width: f.w * r.width, height: f.h * r.height }));
}

function union(rects: Rect[]): Rect {
  const l = Math.min(...rects.map((r) => r.left));
  const t = Math.min(...rects.map((r) => r.top));
  const rr = Math.max(...rects.map((r) => r.left + r.width));
  const b = Math.max(...rects.map((r) => r.top + r.height));
  return { left: l, top: t, width: rr - l, height: b - t };
}

/** The 3-D effect's foreground: the people (head and shoulders under each face), or the middle of
 *  the photo if there are no faces — as a soft-edged mask. */
async function subjectMask(faces: Rect[], photoRect: Rect): Promise<Buffer> {
  const shapes = faces.length
    ? faces.map((f) => {
        const cx = f.left + f.width / 2;
        const cy = f.top + f.height * 1.5;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${f.width * 1.6}" ry="${f.height * 2.4}" />`;
      })
    : [
        `<ellipse cx="${photoRect.left + photoRect.width / 2}" cy="${photoRect.top + photoRect.height * 0.58}" rx="${photoRect.width * 0.3}" ry="${photoRect.height * 0.42}" />`,
      ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}"><rect width="100%" height="100%" fill="black"/><g fill="white">${shapes.join('')}</g></svg>`;
  return sharp(Buffer.from(svg))
    .resize(CW / 4, CH / 4) // blurring a quarter-size mask is much quicker, and it's soft anyway
    .blur(CW / 4 / 120)
    .resize(CW, CH)
    .extractChannel(0)
    .raw()
    .toBuffer();
}

/** Where to look in the canvas at this moment: a w×h window (the output's shape), kept inside. */
function view(cx: number, cy: number, zoom: number): Rect {
  const width = Math.round(CW / zoom);
  const height = Math.round(CH / zoom);
  const left = Math.round(Math.min(CW - width, Math.max(0, cx - width / 2)));
  const top = Math.round(Math.min(CH - height, Math.max(0, cy - height / 2)));
  return { left, top, width, height };
}

// ---- Overlays ----

/** A seeded random so a clip's particles are the same every frame (and every remake). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Particle {
  x: number; // 0–1 across
  phase: number; // 0–1 where in its loop it starts
  size: number;
  laps: number; // whole trips per clip, so it loops seamlessly
  sway: number;
  spin: number;
  hue: number;
}

function particlesFor(overlay: LivingOverlay): Particle[] {
  const rand = seeded(overlay.length * 7919);
  const count = { none: 0, sparkles: 45, snow: 90, hearts: 26, bubbles: 30, petals: 34 }[overlay];
  return Array.from({ length: count }, () => ({
    x: rand(),
    phase: rand(),
    size: rand(),
    laps: 1 + Math.floor(rand() * 2),
    sway: rand() * Math.PI * 2,
    spin: rand() < 0.5 ? -1 : 1,
    hue: rand(),
  }));
}

const HEART = 'M0,-0.3 C-0.5,-1 -1.2,-0.2 0,0.8 C1.2,-0.2 0.5,-1 0,-0.3 Z';

/**
 * Overlay particles are small pictures ("sprites") drawn once each (from SVG) and then just stamped
 * onto every frame — drawing a full-screen SVG per frame was the slow part (~0.3s a frame). Size,
 * angle, and opacity are rounded to a handful of steps so there are only so many to draw.
 */
interface Sprite {
  key: string;
  /** Square sprite's side in pixels, and its SVG (centered on side/2). */
  side: number;
  svg: () => string;
  x: number; // where its center goes on the frame
  y: number;
}

const q = (v: number, steps: number) => Math.max(0, Math.min(steps, Math.round(v * steps))) / steps;

function spritesFor(overlay: LivingOverlay, particles: Particle[], u: number): Sprite[] {
  const TAU = Math.PI * 2;
  const out: Sprite[] = [];
  const wrap = (side: number, body: string, defs = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><defs>${defs}</defs><g transform="translate(${side / 2},${side / 2})">${body}</g></svg>`;
  for (const p of particles) {
    const t = (u * p.laps + p.phase) % 1; // 0–1 through this particle's own trip
    const wobble = Math.sin(TAU * (u * p.laps * 2) + p.sway);
    const fade = Math.min(1, t * 6, (1 - t) * 6);
    if (overlay === 'sparkles') {
      const glow = q(Math.max(0, Math.sin(TAU * t)), 8);
      if (glow < 0.1) continue;
      const r = Math.round((14 + q(p.size, 4) * 26) * glow);
      const angle = Math.round(((u * 90 * p.spin) % 90) / 15) * 15;
      const color = p.hue < 0.5 ? '#fff6c8' : '#ffffff';
      const side = r * 2 + 4;
      out.push({
        key: `s${r}:${angle}:${color}:${glow}`,
        side,
        x: p.x * W,
        y: ((p.phase * 7.31) % 1) * H,
        svg: () =>
          wrap(
            side,
            `<g transform="rotate(${angle})" opacity="${(0.9 * glow).toFixed(2)}"><circle r="${r * 0.55}" fill="url(#g)"/>` +
              `<path d="M0,${-r} L${r * 0.16},${-r * 0.16} L${r},0 L${r * 0.16},${r * 0.16} L0,${r} L${-r * 0.16},${r * 0.16} L${-r},0 L${-r * 0.16},${-r * 0.16} Z" fill="${color}"/></g>`,
            '<radialGradient id="g"><stop offset="0" stop-color="#fff8d0" stop-opacity="0.9"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>'
          ),
      });
    } else if (overlay === 'snow') {
      const r = 3 + Math.round(q(p.size, 4) * 7);
      const opacity = (0.55 + q(p.size, 2) * 0.4).toFixed(2);
      out.push({
        key: `n${r}:${opacity}`,
        side: r * 2 + 2,
        x: p.x * W + wobble * 30,
        y: -20 + t * (H + 40),
        svg: () => wrap(r * 2 + 2, `<circle r="${r}" fill="white" opacity="${opacity}"/>`),
      });
    } else if (overlay === 'hearts') {
      const r = 18 + Math.round(q(p.size, 4) * 30);
      const angle = Math.round(wobble * 3) * 4;
      const fill = ['#ff5c8a', '#ff8fb1', '#ff3d6e', '#ffc2d4'][Math.floor(p.hue * 4)];
      const opacity = (0.85 * q(fade, 4)).toFixed(2);
      if (Number(opacity) === 0) continue;
      const side = r * 2 + 4;
      out.push({
        key: `h${r}:${angle}:${fill}:${opacity}`,
        side,
        x: p.x * W + wobble * 40,
        y: H + 60 - t * (H + 120),
        svg: () => wrap(side, `<path d="${HEART}" transform="rotate(${angle}) scale(${r})" fill="${fill}" opacity="${opacity}"/>`),
      });
    } else if (overlay === 'bubbles') {
      const r = 14 + Math.round(q(p.size, 5) * 34);
      const opacity = (0.8 * q(fade, 4)).toFixed(2);
      if (Number(opacity) === 0) continue;
      const side = r * 2 + 6;
      out.push({
        key: `b${r}:${opacity}`,
        side,
        x: p.x * W + wobble * 35,
        y: H + 60 - t * (H + 120),
        svg: () =>
          wrap(
            side,
            `<g opacity="${opacity}"><circle r="${r}" fill="url(#b)" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>` +
              `<circle cx="${-r * 0.35}" cy="${-r * 0.35}" r="${r * 0.18}" fill="white" opacity="0.8"/></g>`,
            '<radialGradient id="b" cx="0.4" cy="0.35"><stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="0.8" stop-color="#bfe6ff" stop-opacity="0.15"/><stop offset="1" stop-color="#e0f4ff" stop-opacity="0.45"/></radialGradient>'
          ),
      });
    } else if (overlay === 'petals') {
      const r = 10 + Math.round(q(p.size, 3) * 14);
      const angle = Math.round(((u * 360 * p.laps * p.spin + p.sway * 57) % 360) / 20) * 20;
      const fill = ['#ffb7c9', '#ffd1dc', '#ff9eb8'][Math.floor(p.hue * 3)];
      const side = r * 2 + 4;
      out.push({
        key: `p${r}:${angle}:${fill}`,
        side,
        x: p.x * W + wobble * 70,
        y: -30 + t * (H + 60),
        svg: () => wrap(side, `<ellipse rx="${r}" ry="${r * 0.55}" fill="${fill}" opacity="0.9" transform="rotate(${angle})"/>`),
      });
    }
  }
  return out;
}

/** Room around the frame, so particles can drift in and out past the edges. */
const PAD = 80;

async function addOverlay(frame: Buffer, sprites: Sprite[], cache: Map<string, Buffer>): Promise<Buffer> {
  const inputs: sharp.OverlayOptions[] = [];
  for (const s of sprites) {
    let px = cache.get(s.key);
    if (!px) {
      px = await sharp(Buffer.from(s.svg())).ensureAlpha().raw().toBuffer();
      cache.set(s.key, px);
    }
    const left = Math.round(s.x - s.side / 2) + PAD;
    const top = Math.round(s.y - s.side / 2) + PAD;
    if (left < 0 || top < 0 || left + s.side > W + 2 * PAD || top + s.side > H + 2 * PAD) continue;
    inputs.push({ input: px, raw: { width: s.side, height: s.side, channels: 4 }, left, top });
  }
  if (!inputs.length) return frame;
  const padded = await sharp(frame, { raw: { width: W, height: H, channels: 3 } })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: '#000000' })
    .raw()
    .toBuffer();
  return sharp(padded, { raw: { width: W + 2 * PAD, height: H + 2 * PAD, channels: 3 } })
    .composite(inputs)
    .extract({ left: PAD, top: PAD, width: W, height: H })
    .removeAlpha()
    .raw()
    .toBuffer();
}

/** Where the faces are, across the clip (0–1), for cutting a square avatar out of it — the middle
 *  if there are none. Matches how the clip lays the photo out (prepareCanvas). */
export async function livingFocusX(photoPath: string, faces: FaceBox[]): Promise<number> {
  if (!faces.length) return 0.5;
  const meta = await sharp(photoPath).metadata();
  const turned = (meta.orientation ?? 1) >= 5; // EXIF says it's stored sideways
  const pw = (turned ? meta.height : meta.width) ?? 1;
  const ph = (turned ? meta.width : meta.height) ?? 1;
  const fit = Math.min(CW / pw, CH / ph);
  const width = pw * fit;
  const left = (CW - width) / 2;
  const u = union(faces.map((f) => ({ left: f.x, top: f.y, width: f.w, height: f.h })));
  return (left + (u.left + u.width / 2) * width) / CW;
}

// ---- Rendering ----

async function cut(canvas: Buffer, channels: 3 | 4, r: Rect): Promise<Buffer> {
  return sharp(canvas, { raw: { width: CW, height: CH, channels } }).extract(r).resize(W, H, { kernel: 'cubic' }).raw().toBuffer();
}

/**
 * Renders the clip and returns its file name (in config.moviesDir). `onProgress` gets 0–100.
 */
export async function renderLivingPhoto(params: {
  photoPath: string;
  effect: LivingEffect;
  overlay: LivingOverlay;
  seconds: number;
  faces: FaceBox[];
  onProgress?: (percent: number) => void;
}): Promise<{ fileName: string }> {
  const { effect, overlay, seconds } = params;
  await fs.mkdir(config.moviesDir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(config.moviesDir, fileName);

  const { canvas, photoRect } = await prepareCanvas(params.photoPath);
  const faces = facesOnCanvas(params.faces, photoRect);
  const focus = faces.length ? union(faces) : null;
  // Zoom target: the faces (all of them still in view), else the middle of the photo.
  const fx = focus ? focus.left + focus.width / 2 : photoRect.left + photoRect.width / 2;
  const fy = focus ? focus.top + focus.height / 2 : photoRect.top + photoRect.height * 0.45;
  const maxZoom = focus ? Math.max(1.12, Math.min(1.3, CW / (focus.width * 2), CH / (focus.height * 2))) : 1.22;

  // The 3-D effect: a blurred background, and the people cut out (soft edges) on top of it.
  let background = canvas;
  let foreground: Buffer | null = null;
  if (effect === 'depth') {
    background = await sharp(canvas, { raw: { width: CW, height: CH, channels: 3 } }).blur(5).raw().toBuffer();
    const mask = await subjectMask(faces, photoRect);
    foreground = await sharp(canvas, { raw: { width: CW, height: CH, channels: 3 } }).joinChannel(mask, { raw: { width: CW, height: CH, channels: 1 } }).raw().toBuffer();
  }
  const particles = particlesFor(overlay);
  const sprites = new Map<string, Buffer>();

  const totalFrames = Math.round(seconds * FPS);
  const ffmpeg = spawn(config.movies.ffmpegPath, [
    '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath,
  ]);
  let stderr = '';
  ffmpeg.stderr.on('data', (c) => {
    stderr = (stderr + c.toString()).slice(-4000);
  });
  const finished = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', (err) =>
      reject((err as NodeJS.ErrnoException).code === 'ENOENT' ? new Error("ffmpeg isn't installed (or not on PATH) — see docs/MOVIES_SETUP.md") : err)
    );
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim().split('\n').slice(-8).join('\n') || `ffmpeg exited with code ${code}`))));
  });
  ffmpeg.stdin.on('error', () => {}); // reported via 'close'

  try {
    const TAU = Math.PI * 2;
    for (let n = 0; n < totalFrames; n++) {
      const u = n / totalFrames;
      const ease = (1 - Math.cos(TAU * u)) / 2; // 0 → 1 → 0 over the clip
      const swing = Math.sin(TAU * u); // 0 → 1 → 0 → -1 → 0
      let frame: Buffer;
      if (effect === 'zoom') {
        const z = 1 + (maxZoom - 1) * ease;
        frame = await cut(canvas, 3, view(CW / 2 + (fx - CW / 2) * ease, CH / 2 + (fy - CH / 2) * ease, z));
      } else if (effect === 'drift') {
        const z = 1.12;
        frame = await cut(canvas, 3, view(CW / 2 + swing * (CW - CW / z) * 0.5, CH / 2 + ease * (fy - CH / 2) * 0.3, z));
      } else {
        // Background and people move against each other, as if seen from a slowly swaying camera:
        // lined up exactly at the start (no doubled outline), the people then drift the other way
        // and grow toward you a little.
        const cx = CW / 2 + (fx - CW / 2) * 0.5;
        const cy = CH / 2 + (fy - CH / 2) * 0.5;
        const bg = await cut(background, 3, view(cx + swing * CW * 0.01, cy, 1.08));
        const fg = await cut(foreground!, 4, view(cx - swing * CW * 0.01, cy, 1.08 + 0.05 * ease));
        frame = await sharp(bg, { raw: { width: W, height: H, channels: 3 } })
          .composite([{ input: fg, raw: { width: W, height: H, channels: 4 } }])
          .removeAlpha()
          .raw()
          .toBuffer();
      }
      if (particles.length) frame = await addOverlay(frame, spritesFor(overlay, particles, u), sprites);
      if (!ffmpeg.stdin.write(frame)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      params.onProgress?.(((n + 1) / totalFrames) * 99);
    }
    ffmpeg.stdin.end();
    await finished;
  } catch (err) {
    ffmpeg.kill();
    await fs.rm(outputPath, { force: true });
    throw err;
  }
  return { fileName };
}
