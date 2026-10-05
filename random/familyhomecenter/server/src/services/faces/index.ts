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

/** Cosine similarity at or above which a face is suggested as a known person. SFace's authors use
 *  0.363 for "same person"; a little stricter here since a wrong suggestion is more annoying than a
 *  missed one. (Measured on real portraits: same person years apart ~0.73–0.79, different people
 *  ≤ 0.21.) */
const SUGGEST_THRESHOLD = 0.42;
/** Unnamed faces this similar are grouped together under "Who's this?". */
const GROUP_THRESHOLD = 0.45;

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
      'INSERT INTO faces (path, x, y, w, h, score, embedding) VALUES (@path, @x, @y, @w, @h, @score, @embedding)'
    );
    db.transaction(() => {
      // A replaced photo starts over (its old faces' names can't be assumed to still apply).
      db.prepare('DELETE FROM faces WHERE path = ?').run(rel);
      for (const f of found) {
        insert.run({ path: rel, x: f.x, y: f.y, w: f.w, h: f.h, score: f.score, embedding: Buffer.from(f.embedding.buffer) });
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
    faces: (db.prepare('SELECT COUNT(*) AS n FROM faces').get() as { n: number }).n,
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
}

let cache: { version: number; faces: FaceInfo[]; vectors: Map<number, Float32Array> } | null = null;

/** Every face with its current suggestion. Each unconfirmed face is compared with every confirmed
 *  face (best match per person, skipping "not this person" rejections) — a few thousand faces is
 *  quick; cached until anything changes. */
export function allFaces(): { faces: FaceInfo[]; vectors: Map<number, Float32Array> } {
  if (cache && cache.version === version) return cache;
  const rows = db.prepare('SELECT * FROM faces').all() as FaceRow[];
  const rejected = new Set(
    (db.prepare('SELECT face_id, person_id FROM face_rejections').all() as Array<{ face_id: number; person_id: string }>).map(
      (r) => `${r.face_id}:${r.person_id}`
    )
  );
  const vectors = new Map(rows.map((r) => [r.id, toVector(r.embedding)]));
  const confirmed = rows.filter((r) => r.confirmed && r.person_id);
  const faces = rows.map((r): FaceInfo => {
    const base = { id: r.id, path: r.path, x: r.x, y: r.y, w: r.w, h: r.h, person_id: r.person_id, confirmed: Boolean(r.confirmed) };
    if (r.confirmed) return { ...base, suggested_person_id: null, similarity: null };
    let best: { person: string; sim: number } | null = null;
    const v = vectors.get(r.id)!;
    for (const c of confirmed) {
      if (rejected.has(`${r.id}:${c.person_id}`)) continue;
      const sim = cosineSimilarity(v, vectors.get(c.id)!);
      if (!best || sim > best.sim) best = { person: c.person_id!, sim };
    }
    return best && best.sim >= SUGGEST_THRESHOLD
      ? { ...base, suggested_person_id: best.person, similarity: best.sim }
      : { ...base, suggested_person_id: null, similarity: best?.sim ?? null };
  });
  cache = { version, faces, vectors };
  return cache;
}

/** Unnamed faces with no suggestion, grouped by likely-same-person (greedy, against each group's
 *  average faceprint) — biggest groups first, so naming one group tags many photos at once. */
export function unnamedGroups(limit = 30, perGroup = 24): FaceInfo[][] {
  const { faces, vectors } = allFaces();
  const pool = faces.filter((f) => !f.confirmed && !f.suggested_person_id);
  const groups: Array<{ members: FaceInfo[]; sum: Float32Array }> = [];
  for (const f of pool) {
    const v = vectors.get(f.id)!;
    let best: { g: (typeof groups)[number]; sim: number } | null = null;
    for (const g of groups) {
      let norm = 0;
      for (const x of g.sum) norm += x * x;
      const sim = cosineSimilarity(v, g.sum) / (Math.sqrt(norm) || 1);
      if (!best || sim > best.sim) best = { g, sim };
    }
    if (best && best.sim >= GROUP_THRESHOLD) {
      best.g.members.push(f);
      for (let i = 0; i < v.length; i++) best.g.sum[i] += v[i];
    } else {
      groups.push({ members: [f], sum: Float32Array.from(v) });
    }
  }
  return groups
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, limit)
    .map((g) => g.members.slice(0, perGroup));
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
