import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { config } from '../config.js';
import { estimateDepth } from './depth.js';

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

export const LIVING_EFFECTS = ['zoom', 'drift', 'depth', 'still'] as const;
export const LIVING_OVERLAYS = ['none', 'sparkles', 'snow', 'rain', 'hearts', 'bubbles', 'petals'] as const;
export const LIVING_SECONDS = [5, 8, 12] as const;
/** What a painted area does: water/clouds flow (in `direction`), flames lick upward and flicker,
 *  sway rocks gently (leaves, grass), shimmer ripples (heat haze, a pool's surface), twinkle makes
 *  bright spots glint (lights, sparkling water). */
export const REGION_EFFECTS = ['water', 'flames', 'sway', 'shimmer', 'clouds', 'twinkle'] as const;
export const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
export type LivingEffect = (typeof LIVING_EFFECTS)[number];
export type LivingOverlay = (typeof LIVING_OVERLAYS)[number];
export type RegionEffect = (typeof REGION_EFFECTS)[number];
export type Direction = (typeof DIRECTIONS)[number];

/** A painted area: `mask` is a PNG the size/shape of the photo, painted where it should move. */
export interface LivingRegion {
  effect: RegionEffect;
  direction: Direction;
  mask: Buffer;
}

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
  const count = { none: 0, sparkles: 45, snow: 90, rain: 140, hearts: 26, bubbles: 30, petals: 34 }[overlay];
  return Array.from({ length: count }, () => ({
    x: rand(),
    phase: rand(),
    size: rand(),
    laps: overlay === 'rain' ? 4 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2),
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
    } else if (overlay === 'rain') {
      // Thin slanted streaks, fast (several trips a clip).
      const len = 30 + Math.round(q(p.size, 3) * 40);
      const opacity = (0.25 + q(p.hue, 3) * 0.3).toFixed(2);
      const side = len + 4;
      out.push({
        key: `r${len}:${opacity}`,
        side,
        x: p.x * (W + 200) - t * 160,
        y: -60 + t * (H + 120),
        svg: () => wrap(side, `<line x1="${len * 0.12}" y1="${-len / 2}" x2="${-len * 0.12}" y2="${len / 2}" stroke="#dfe9f5" stroke-width="2.2" stroke-linecap="round" opacity="${opacity}"/>`),
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

// ---- Depth and painted areas: moving every pixel ----

/** Depth maps and masks are kept at a quarter of the canvas — they're smooth anyway. */
const DW = CW / 4;
const DH = CH / 4;

/** A painted area's mask on the canvas (DW × DH, 0–255), soft-edged. */
async function regionMask(png: Buffer, r: Rect): Promise<Uint8Array> {
  const w = Math.max(1, Math.round(r.width / 4));
  const h = Math.max(1, Math.round(r.height / 4));
  const left = Math.max(0, Math.min(DW - w, Math.round(r.left / 4)));
  const top = Math.max(0, Math.min(DH - h, Math.round(r.top / 4)));
  const alpha = await sharp(png).ensureAlpha().resize(w, h, { fit: 'fill' }).extractChannel(3).raw().toBuffer();
  const placed = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .extend({ left, top, right: DW - w - left, bottom: DH - h - top, background: '#000000' })
    .blur(2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return new Uint8Array(placed.buffer, placed.byteOffset, DW * DH);
}

/** Depth of the canvas (0 far … 1 near) from the depth model — or, if it can't be had (no internet
 *  the first time), the old stand-in: the people (from their faces) near, everything else far. */
async function depthMap(canvas: Buffer, faces: Rect[], photoRect: Rect): Promise<Float32Array> {
  try {
    return await estimateDepth(canvas, CW, CH, { width: DW, height: DH });
  } catch (err) {
    console.warn('[living] depth model unavailable, using faces instead:', (err as Error).message);
    const mask = await sharp(await subjectMask(faces, photoRect), { raw: { width: CW, height: CH, channels: 1 } }).resize(DW, DH).extractChannel(0).raw().toBuffer();
    return Float32Array.from(mask, (v) => v / 255);
  }
}

const DIRECTION_VECTORS: Record<Direction, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

interface PreparedRegion {
  effect: RegionEffect;
  mask: Uint8Array;
  dx: number;
  dy: number;
}

/**
 * One frame, every output pixel worked out on its own: where the camera looks (`v`), how far it
 * has glided (`ease`/`swing`) — near pixels (depth) move and grow more than far ones — and, inside
 * painted areas, the extra motion. Flowing motion samples the photo at two offsets half a cycle
 * apart and cross-fades them, so it streams continuously and loops without a jump.
 */
function warpFrame(
  canvas: Buffer,
  out: Buffer,
  v: Rect,
  depth: Float32Array | null,
  regions: PreparedRegion[],
  u: number,
  seconds: number,
  center: { x: number; y: number }
): void {
  const TAU = Math.PI * 2;
  const ease = (1 - Math.cos(TAU * u)) / 2;
  const swing = Math.sin(TAU * u);
  const sx = v.width / W;
  const sy = v.height / H;
  const maxX = CW - 1.001;
  const maxY = CH - 1.001;
  let r = 0;
  let g = 0;
  let b = 0;
  // Bilinear sample of the canvas at (x, y) into r, g, b.
  const sample = (x: number, y: number) => {
    x = x < 0 ? 0 : x > maxX ? maxX : x;
    y = y < 0 ? 0 : y > maxY ? maxY : y;
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i00 = (y0 * CW + x0) * 3;
    const i10 = i00 + 3;
    const i01 = i00 + CW * 3;
    const i11 = i01 + 3;
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;
    r = canvas[i00] * w00 + canvas[i10] * w10 + canvas[i01] * w01 + canvas[i11] * w11;
    g = canvas[i00 + 1] * w00 + canvas[i10 + 1] * w10 + canvas[i01 + 1] * w01 + canvas[i11 + 1] * w11;
    b = canvas[i00 + 2] * w00 + canvas[i10 + 2] * w10 + canvas[i01 + 2] * w01 + canvas[i11 + 2] * w11;
  };
  // Flow phases (whole cycles per clip, so the loop is seamless): water ~1.5 cycles/s, flames faster.
  // Short trips, often: the cross-fade between the two offsets is what you'd notice on a long one.
  const waterLaps = Math.max(2, Math.round(seconds * 1.1));
  const flameLaps = Math.max(2, Math.round(seconds * 1.6));
  const phase = (laps: number) => (u * laps) % 1;
  const zoomAt = 0.07; // how much nearer things grow, at full depth
  const slide = 0.014 * CW; // how far nearer things slide sideways, at full depth
  let o = 0;
  for (let oy = 0; oy < H; oy++) {
    const baseY = v.top + (oy + 0.5) * sy;
    for (let ox = 0; ox < W; ox++) {
      let X = v.left + (ox + 0.5) * sx;
      let Y = baseY;
      const di = ((Y / 4) | 0) * DW + ((X / 4) | 0);
      if (depth) {
        const d = depth[di];
        const m = 1 + zoomAt * d * ease;
        X = center.x + (X - center.x) / m - swing * slide * d;
        Y = center.y + (Y - center.y) / m;
      }
      // The painted area that covers this pixel most (areas rarely overlap).
      let reg: PreparedRegion | null = null;
      let mw = 0;
      if (regions.length) {
        const mi = (((Y < 0 ? 0 : Y > maxY ? maxY : Y) / 4) | 0) * DW + (((X < 0 ? 0 : X > maxX ? maxX : X) / 4) | 0);
        for (const rg of regions) {
          const val = rg.mask[mi];
          if (val > mw) {
            mw = val;
            reg = rg;
          }
        }
        mw /= 255;
      }
      if (!reg || mw === 0) {
        sample(X, Y);
      } else if (reg.effect === 'water' || reg.effect === 'clouds' || reg.effect === 'flames') {
        const laps = reg.effect === 'flames' ? flameLaps : reg.effect === 'water' ? waterLaps : 1;
        const dist = (reg.effect === 'clouds' ? 22 * seconds : reg.effect === 'flames' ? 34 : 32) * S * mw;
        const p1 = phase(laps);
        const p2 = (p1 + 0.5) % 1;
        const w1 = 1 - Math.abs(2 * p1 - 1);
        // A little sideways wobble, so it doesn't look like a conveyor belt.
        const along = reg.dx !== 0 ? Y : X;
        const wob = (reg.effect === 'flames' ? 6 : 2) * S * mw * Math.sin(along * 0.02 + TAU * u * laps * 0.5 + X * 0.003);
        const wx = reg.dy !== 0 ? wob : 0;
        const wy = reg.dx !== 0 ? wob : 0;
        sample(X - reg.dx * dist * p1 + wx, Y - reg.dy * dist * p1 + wy);
        const r1 = r;
        const g1 = g;
        const b1 = b;
        sample(X - reg.dx * dist * p2 + wx, Y - reg.dy * dist * p2 + wy);
        r = r1 * w1 + r * (1 - w1);
        g = g1 * w1 + g * (1 - w1);
        b = b1 * w1 + b * (1 - w1);
        if (reg.effect === 'flames') {
          const flicker = 1 + mw * 0.16 * Math.sin(TAU * u * flameLaps * 1.5 + X * 0.011 + Y * 0.007) * Math.sin(TAU * u * flameLaps * 0.5 + Y * 0.004);
          r *= flicker;
          g *= flicker;
          b *= flicker;
        }
      } else if (reg.effect === 'sway') {
        const laps = Math.max(1, Math.round(seconds / 2.5));
        sample(X + mw * 7 * S * Math.sin(TAU * u * laps + Y * 0.004 + X * 0.001), Y + mw * 1.5 * S * Math.sin(TAU * u * laps * 2 + X * 0.006));
      } else if (reg.effect === 'shimmer') {
        const laps = Math.max(2, Math.round(seconds));
        sample(X + mw * 2.5 * S * Math.sin(Y * 0.045 + TAU * u * laps), Y + mw * 2 * S * Math.sin(X * 0.04 + TAU * u * (laps - 1)));
      } else {
        // twinkle: bright spots glint, each on its own beat.
        sample(X, Y);
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        if (lum > 150) {
          const cell = Math.sin(((X / 18) | 0) * 12.9898 + ((Y / 18) | 0) * 78.233) * 43758.5453;
          const beat = cell - Math.floor(cell);
          const glint = Math.max(0, Math.sin(TAU * (u * Math.max(2, Math.round(seconds / 2)) + beat)));
          const boost = 1 + mw * ((lum - 150) / 105) * 0.6 * glint * glint;
          r *= boost;
          g *= boost;
          b *= boost;
        }
      }
      out[o++] = r > 255 ? 255 : r;
      out[o++] = g > 255 ? 255 : g;
      out[o++] = b > 255 ? 255 : b;
    }
  }
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
  regions?: LivingRegion[];
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

  // 3-D and painted areas move pixel by pixel (warpFrame); a plain zoom/drift is just a moving cut.
  const depth = effect === 'depth' ? await depthMap(canvas, faces, photoRect) : null;
  const regions: PreparedRegion[] = [];
  for (const rg of params.regions ?? []) {
    const [dx, dy] = DIRECTION_VECTORS[rg.direction];
    regions.push({ effect: rg.effect, mask: await regionMask(rg.mask, photoRect), dx, dy });
  }
  const perPixel = Boolean(depth) || regions.length > 0;
  const warped = perPixel ? Buffer.alloc(W * H * 3) : null;
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
      // Where the camera looks this frame.
      let v: Rect;
      if (effect === 'zoom') v = view(CW / 2 + (fx - CW / 2) * ease, CH / 2 + (fy - CH / 2) * ease, 1 + (maxZoom - 1) * ease);
      else if (effect === 'drift') v = view(CW / 2 + swing * (CW - CW / 1.12) * 0.5, CH / 2 + ease * (fy - CH / 2) * 0.3, 1.12);
      // 3-D: the view stays put (a little zoomed, for room at the edges) and the pixels move instead.
      else if (effect === 'depth') v = view(CW / 2 + (fx - CW / 2) * 0.3, CH / 2 + (fy - CH / 2) * 0.3, 1.1);
      else v = view(CW / 2, CH / 2, regions.length ? 1.02 : 1);
      let frame: Buffer;
      if (warped) {
        warpFrame(canvas, warped, v, depth, regions, u, seconds, { x: v.left + v.width / 2, y: v.top + v.height / 2 });
        frame = Buffer.from(warped); // (ffmpeg may still be reading the last one)
      } else {
        frame = await cut(canvas, 3, v);
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
