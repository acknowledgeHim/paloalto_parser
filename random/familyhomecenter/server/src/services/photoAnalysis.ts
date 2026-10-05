import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '../db.js';
import { config } from '../config.js';
import { getOrCreateThumbnail } from './photos.js';

/**
 * Spots near-duplicate and blurry photos, to help when picking a lot of them at once (a phone dump
 * of 40 shots of the same moment). Run per photo in the background, right after its thumbnail is
 * warmed (services/photos.ts), and read from the slideshow-sized thumbnail rather than the original
 * so it's quick even over an SMB share. Read-only against the photos themselves.
 *
 * - Fingerprint: a 64-bit "difference hash" — shrink to 9x8 grey and record whether each pixel is
 *   brighter than its right-hand neighbour. Near-identical photos (same scene a second apart, a
 *   re-saved or resized copy) differ in only a few bits.
 * - Sharpness: variance of the Laplacian (an edge detector) on a 512px-wide grey copy. Blurry
 *   photos have soft edges and score low. A heuristic — a deliberately soft photo (fog, a plain
 *   sky) can score low too, hence "possibly blurry" in the UI.
 */

const SHARPNESS_WIDTH = 512;
/** Below this Laplacian variance (on 0-255 grey at SHARPNESS_WIDTH), a photo is flagged "possibly
 *  blurry". Calibrated on real photos taken from a 1920px thumbnail: in-focus shots scored ~200-530
 *  (a naturally soft one — clouds — 77), while the same photos visibly blurred (Gaussian sigma 4 at
 *  1920px) scored 9-58. */
export const BLURRY_THRESHOLD = 60;
/** Max differing fingerprint bits (of 64) to count two photos as near-duplicates. */
const DUPLICATE_MAX_DISTANCE = 6;

interface AnalysisRow {
  path: string;
  mtime_ms: number;
  dhash: string;
  sharpness: number;
  pixels: number;
}

async function fingerprint(source: string): Promise<string> {
  const { data } = await sharp(source).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  }
  // 64 bits → 16 hex chars, in two 32-bit halves (BigInt-free for speed when comparing).
  return parseInt(bits.slice(0, 32), 2).toString(16).padStart(8, '0') + parseInt(bits.slice(32), 2).toString(16).padStart(8, '0');
}

async function sharpness(source: string): Promise<number> {
  const { data, info } = await sharp(source)
    .greyscale()
    .resize({ width: SHARPNESS_WIDTH, withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

let version = 0; // bumped whenever an analysis row changes, to invalidate the grouping cache below

/** Analyzes one photo if it's new or changed since last time. Never throws (a photo sharp can't
 *  read just stays unanalyzed). */
export async function analyzePhoto(absolutePath: string): Promise<void> {
  try {
    const rel = path.relative(config.photosDir, absolutePath);
    const { mtimeMs } = await fs.stat(absolutePath);
    const existing = db.prepare('SELECT mtime_ms FROM photo_analysis WHERE path = ?').get(rel) as { mtime_ms: number } | undefined;
    if (existing && existing.mtime_ms === mtimeMs) return;
    const thumb = await getOrCreateThumbnail(absolutePath);
    // The original's resolution (a header read, cheap even over SMB) — see pickBest below.
    const meta = await sharp(absolutePath).metadata();
    const pixels = (meta.width ?? 0) * (meta.height ?? 0);
    const [dhash, score] = await Promise.all([fingerprint(thumb), sharpness(thumb)]);
    db.prepare(
      `INSERT INTO photo_analysis (path, mtime_ms, dhash, sharpness, pixels) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET mtime_ms = excluded.mtime_ms, dhash = excluded.dhash,
         sharpness = excluded.sharpness, pixels = excluded.pixels`
    ).run(rel, mtimeMs, dhash, score, pixels);
    version++;
  } catch (err) {
    console.warn(`[photos] couldn't analyze "${absolutePath}":`, (err as Error).message);
  }
}

function popcount32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export interface PhotoQuality {
  /** null = not analyzed yet. */
  blurry: boolean | null;
  /** Shared by every photo in a near-duplicate group; null if it has no near-duplicates. */
  dup_group: string | null;
  /** The sharpest photo of its duplicate group (the one "hide duplicates" keeps). */
  dup_best: boolean;
}

/** The one of a near-duplicate group to keep: among the ones close to the sharpest (within 20%),
 *  the highest-resolution original. Sharpness alone isn't enough — a smaller, more compressed copy
 *  of the same shot scores *higher*, since JPEG artifacts read as extra edges. */
function pickBest(group: AnalysisRow[]): AnalysisRow {
  const maxSharpness = Math.max(...group.map((r) => r.sharpness));
  const contenders = group.filter((r) => r.sharpness >= maxSharpness * 0.8);
  return contenders.reduce((a, b) => (b.pixels > a.pixels || (b.pixels === a.pixels && b.sharpness > a.sharpness) ? b : a));
}

let cache: { version: number; byPath: Map<string, PhotoQuality> } | null = null;

/** Quality info for every analyzed photo, keyed by path relative to PHOTOS_DIR. Duplicate groups
 *  are found by comparing every pair of fingerprints (union-find) — fine for a family library of a
 *  few thousand photos, and cached until any analysis changes. */
export function getPhotoQuality(): Map<string, PhotoQuality> {
  if (cache && cache.version === version) return cache.byPath;
  const rows = db.prepare('SELECT * FROM photo_analysis').all() as AnalysisRow[];
  const hi = rows.map((r) => parseInt(r.dhash.slice(0, 8), 16) >>> 0);
  const lo = rows.map((r) => parseInt(r.dhash.slice(8), 16) >>> 0);
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (popcount32((hi[i] ^ hi[j]) >>> 0) + popcount32((lo[i] ^ lo[j]) >>> 0) <= DUPLICATE_MAX_DISTANCE) {
        parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  const byPath = new Map<string, PhotoQuality>();
  for (const members of groups.values()) {
    const best = pickBest(members.map((i) => rows[i]));
    const bestIndex = members.find((i) => rows[i] === best)!;
    for (const i of members) {
      byPath.set(rows[i].path, {
        blurry: rows[i].sharpness < BLURRY_THRESHOLD,
        dup_group: members.length > 1 ? best.path : null,
        dup_best: members.length > 1 && i === bestIndex,
      });
    }
  }
  cache = { version, byPath };
  return byPath;
}

/** Drops photos the caller asked to leave out: possibly blurry ones, and/or all but the sharpest
 *  of each near-duplicate group. Unanalyzed photos are always kept. */
export function filterByQuality(absolutePaths: string[], opts: { excludeBlurry?: boolean; excludeDuplicates?: boolean }): string[] {
  if (!opts.excludeBlurry && !opts.excludeDuplicates) return absolutePaths;
  const quality = getPhotoQuality();
  return absolutePaths.filter((abs) => {
    const q = quality.get(path.relative(config.photosDir, abs));
    if (!q) return true;
    if (opts.excludeBlurry && q.blurry) return false;
    if (opts.excludeDuplicates && q.dup_group && !q.dup_best) return false;
    return true;
  });
}
