import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db, getSetting, setSetting } from '../../db.js';
import { config } from '../../config.js';
import { getOrCreateThumbnail, listPhotos } from '../photos.js';
import { cosineSimilarity, detectFaces, ensureModels, modelsPresent } from './engine.js';

/**
 * Face recognition for the Photos section — opt-in, entirely on this machine (see engine.ts; no
 * photo, face, or faceprint is ever sent anywhere). Each photo is scanned once in the background
 * (from its cached, upright thumbnail), its faces stored with their faceprints; someone then names
 * a few faces and the app suggests the rest, which a person confirms or rejects. Suggestions are
 * never applied on their own.
 */

/**
 * Thresholds, from measurements on real photos (cosine similarity of SFace faceprints): the same
 * person across years, sizes, and blur scored 0.70–0.96; different people typically ~0.1 — but
 * relatives run much higher (a father and son: 0.48), and a family photo library is full of
 * relatives. So these sit well above that, still well below same-person scores.
 */
/** At or above this, an unconfirmed face is suggested as a known person… */
const SUGGEST_THRESHOLD = 0.52;
/** …and only if that person beats the next-best by this much (two siblings nearly tied → no guess). */
const SUGGEST_MARGIN = 0.05;
/** Lower-quality faces (small, turned away, uncertain) need a stronger match to be suggested. */
const SUGGEST_THRESHOLD_LOW_QUALITY = 0.6;
/** "Who's this?" groups: a face joins a group only if it's this close to the group's first face and
 *  to its members on average (and none of them is way off) — never against a running average,
 *  which drifts toward a generic face and snowballs different people into one group. */
const GROUP_THRESHOLD = 0.55;
const GROUP_MIN_MEMBER = 0.4;
/** Group at most this many (best-quality) unnamed faces at once — keeps grouping quick on a Pi. */
const GROUP_POOL = 2500;

const SETTING_KEY = 'faces_enabled';

export function facesEnabled(): boolean {
  return getSetting(SETTING_KEY, '') === '1';
}

let lastError: string | null = null;
let preparing = false;

/** Turning faces on downloads the two models first (once) — the only time this feature uses the
 *  internet, and nothing is sent but the download request itself. */
export async function setFacesEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    preparing = true;
    lastError = null;
    try {
      await ensureModels();
    } catch (err) {
      lastError = (err as Error).message;
      throw err;
    } finally {
      preparing = false;
    }
  }
  setSetting(SETTING_KEY, enabled ? '1' : '');
}

interface FaceRow {
  id: number;
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  embedding: Buffer;
  person_id: string | null;
  confirmed: number;
  quality: number | null;
  ignored: number;
  no_group: number;
}

/** Clear enough to group and suggest automatically: a confident detection, not tiny (≥ ~3% of the
 *  photo's width, ~58px in a 1920px thumbnail), and roughly facing the camera. Faces that fail this
 *  are still shown photo by photo to name by hand. */
function isGoodFace(r: Pick<FaceRow, 'score' | 'w' | 'quality'>): boolean {
  return r.score >= 0.9 && r.w >= 0.03 && (r.quality === null || r.quality >= 0.5);
}

let version = 0; // bumped on any change to faces/people, to invalidate the suggestion cache

export function facesChanged(): void {
  version++;
}

/** Scans one photo for faces if faces are on and it's new or changed. Never throws. */
export async function scanPhotoFaces(absolutePath: string): Promise<void> {
  if (!facesEnabled() || !modelsPresent()) return;
  try {
    const rel = path.relative(config.photosDir, absolutePath);
    const { mtimeMs } = await fs.stat(absolutePath);
    const seen = db.prepare('SELECT mtime_ms FROM face_scans WHERE path = ?').get(rel) as { mtime_ms: number } | undefined;
    if (seen && seen.mtime_ms === mtimeMs) return;
    const found = await detectFaces(await getOrCreateThumbnail(absolutePath));
    const insert = db.prepare(
      'INSERT INTO faces (path, x, y, w, h, score, quality, embedding) VALUES (@path, @x, @y, @w, @h, @score, @quality, @embedding)'
    );
    db.transaction(() => {
      // A replaced photo starts over (its old faces' names can't be assumed to still apply).
      db.prepare('DELETE FROM faces WHERE path = ?').run(rel);
      for (const f of found) {
        insert.run({ path: rel, x: f.x, y: f.y, w: f.w, h: f.h, score: f.score, quality: f.frontal, embedding: Buffer.from(f.embedding.buffer) });
      }
      db.prepare(
        `INSERT INTO face_scans (path, mtime_ms, faces, scanned_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET mtime_ms = excluded.mtime_ms, faces = excluded.faces, scanned_at = excluded.scanned_at`
      ).run(rel, mtimeMs, found.length, new Date().toISOString());
    })();
    if (found.length) facesChanged();
  } catch (err) {
    lastError = (err as Error).message;
    console.warn(`[faces] couldn't scan "${absolutePath}":`, (err as Error).message);
  }
}

export async function faceStatus() {
  const total = (await listPhotos()).length;
  const scanned = (db.prepare('SELECT COUNT(*) AS n FROM face_scans').get() as { n: number }).n;
  return {
    enabled: facesEnabled(),
    models_present: modelsPresent(),
    preparing,
    scanned: Math.min(scanned, total),
    total,
    faces: (db.prepare('SELECT COUNT(*) AS n FROM faces WHERE ignored = 0').get() as { n: number }).n,
    ignored: (db.prepare('SELECT COUNT(*) AS n FROM faces WHERE ignored = 1').get() as { n: number }).n,
    people: (db.prepare('SELECT COUNT(*) AS n FROM people').get() as { n: number }).n,
    error: lastError,
  };
}

// ---- Suggestions & grouping ----

const toVector = (b: Buffer) => new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);

export interface FaceInfo {
  id: number;
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  person_id: string | null;
  confirmed: boolean;
  /** For an unconfirmed face: the best-matching known person, if close enough. */
  suggested_person_id: string | null;
  similarity: number | null;
  /** Clear enough to group/suggest automatically (see isGoodFace). */
  good: boolean;
  /** "Different people" — named one at a time, never grouped. */
  no_group: boolean;
}

let cache: { version: number; faces: FaceInfo[]; vectors: Map<number, Float32Array> } | null = null;

/** Every (not ignored) face with its current suggestion. Each unconfirmed face is compared with
 *  every confirmed face — best match per person, skipping "not this person" rejections — and is
 *  suggested only if one person clearly wins (see the thresholds above). Cached until anything
 *  changes. */
export function allFaces(): { faces: FaceInfo[]; vectors: Map<number, Float32Array> } {
  if (cache && cache.version === version) return cache;
  const rows = db.prepare('SELECT * FROM faces WHERE ignored = 0').all() as FaceRow[];
  const rejected = new Set(
    (db.prepare('SELECT face_id, person_id FROM face_rejections').all() as Array<{ face_id: number; person_id: string }>).map(
      (r) => `${r.face_id}:${r.person_id}`
    )
  );
  const vectors = new Map(rows.map((r) => [r.id, toVector(r.embedding)]));
  const confirmed = rows.filter((r) => r.confirmed && r.person_id);
  const faces = rows.map((r): FaceInfo => {
    const good = isGoodFace(r);
    const base = {
      id: r.id, path: r.path, x: r.x, y: r.y, w: r.w, h: r.h, person_id: r.person_id, confirmed: Boolean(r.confirmed),
      good, no_group: Boolean(r.no_group),
    };
    if (r.confirmed) return { ...base, suggested_person_id: null, similarity: null };
    // Best match per person.
    const perPerson = new Map<string, number>();
    const v = vectors.get(r.id)!;
    for (const c of confirmed) {
      if (rejected.has(`${r.id}:${c.person_id}`)) continue;
      const sim = cosineSimilarity(v, vectors.get(c.id)!);
      if (sim > (perPerson.get(c.person_id!) ?? -1)) perPerson.set(c.person_id!, sim);
    }
    const ranked = [...perPerson.entries()].sort((a, b) => b[1] - a[1]);
    const [best, second] = ranked;
    const needed = good ? SUGGEST_THRESHOLD : SUGGEST_THRESHOLD_LOW_QUALITY;
    const clearWinner = best && best[1] >= needed && (!second || best[1] - second[1] >= SUGGEST_MARGIN);
    return clearWinner
      ? { ...base, suggested_person_id: best[0], similarity: best[1] }
      : { ...base, suggested_person_id: null, similarity: best?.[1] ?? null };
  });
  cache = { version, faces, vectors };
  return cache;
}

/**
 * Unnamed faces with no suggestion, grouped by likely-same-person — biggest groups first, so naming
 * one group tags many photos at once. Only clear faces (isGoodFace), not marked "different people",
 * best quality first. A face joins the group it matches best, but only if it's close to that
 * group's first face, close to its members on average, and not far from any of them (checked
 * against up to 12 members) — pairwise rather than against a running average, which drifts toward
 * a generic face and pulls different people together.
 */
export function unnamedGroups(limit = 30, perGroup = 24): FaceInfo[][] {
  const { faces, vectors } = allFaces();
  const quality = new Map(
    (db.prepare('SELECT id, score, w, quality FROM faces WHERE ignored = 0').all() as Array<{ id: number; score: number; w: number; quality: number | null }>).map(
      (r) => [r.id, r.score * Math.min(1, r.w * 10) * (r.quality ?? 0.8)]
    )
  );
  const pool = faces
    .filter((f) => !f.confirmed && !f.suggested_person_id && f.good && !f.no_group)
    .sort((a, b) => (quality.get(b.id) ?? 0) - (quality.get(a.id) ?? 0))
    .slice(0, GROUP_POOL);
  const groups: FaceInfo[][] = [];
  for (const f of pool) {
    const v = vectors.get(f.id)!;
    let best: { g: FaceInfo[]; avg: number } | null = null;
    for (const g of groups) {
      if (cosineSimilarity(v, vectors.get(g[0].id)!) < GROUP_THRESHOLD) continue;
      const sims = g.slice(0, 12).map((m) => cosineSimilarity(v, vectors.get(m.id)!));
      const avg = sims.reduce((a, b) => a + b, 0) / sims.length;
      if (avg >= GROUP_THRESHOLD && Math.min(...sims) >= GROUP_MIN_MEMBER && (!best || avg > best.avg)) best = { g, avg };
    }
    if (best) best.g.push(f);
    else groups.push([f]);
  }
  return groups
    .sort((a, b) => b.length - a.length)
    .slice(0, limit)
    .map((g) => g.slice(0, perGroup));
}

/** Photos with faces still to name (not confirmed, not ignored), most faces first — the
 *  "photo by photo" queue. Includes the small/turned-away faces grouping leaves out. */
export function photosToName(): Array<{ path: string; faces: number }> {
  const counts = new Map<string, number>();
  for (const f of allFaces().faces) if (!f.confirmed) counts.set(f.path, (counts.get(f.path) ?? 0) + 1);
  return [...counts.entries()].map(([path, faces]) => ({ path, faces })).sort((a, b) => b.faces - a.faces || a.path.localeCompare(b.path));
}

// ---- Face crops ----

const cropsDir = () => path.join(config.dataDir, 'faces');

/** A square crop around one face (with some margin), cached — for the People screens. */
export async function faceCrop(faceId: number): Promise<string | null> {
  const face = db.prepare('SELECT path, x, y, w, h FROM faces WHERE id = ?').get(faceId) as Pick<FaceRow, 'path' | 'x' | 'y' | 'w' | 'h'> | undefined;
  if (!face) return null;
  const file = path.join(cropsDir(), `${faceId}.jpg`);
  try {
    await fs.access(file);
    return file;
  } catch {
    // not cached yet
  }
  const thumb = await getOrCreateThumbnail(path.join(config.photosDir, face.path));
  const meta = await sharp(thumb).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  const size = Math.max(face.w * W, face.h * H) * 1.6;
  const cx = (face.x + face.w / 2) * W;
  const cy = (face.y + face.h / 2) * H;
  const left = Math.max(0, Math.round(cx - size / 2));
  const top = Math.max(0, Math.round(cy - size / 2));
  const side = Math.max(1, Math.round(Math.min(size, W - left, H - top)));
  await fs.mkdir(cropsDir(), { recursive: true });
  await sharp(thumb).extract({ left, top, width: side, height: side }).resize(200, 200).jpeg({ quality: 85 }).toFile(file);
  return file;
}
