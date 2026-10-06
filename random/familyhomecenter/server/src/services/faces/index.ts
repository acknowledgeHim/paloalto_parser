import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db, getSetting, setSetting } from '../../db.js';
import { config } from '../../config.js';
import { getOrCreateThumbnail, listPhotos } from '../photos.js';
import { detectFaces, ensureModels, modelsPresent } from './engine.js';
import { addFaceprints, faceIndex, forgetPeopleExcept, personColumn, similarityRows } from './matcher.js';

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
let userVersion = 0; // the version of the last change someone made (naming, confirming…) — not a scan

/** Call after any change; `scan` for new photos scanned (which only add faces). */
export function facesChanged(kind: 'user' | 'scan' = 'user'): void {
  version++;
  if (kind === 'user') userVersion = version;
}

function userChangedSince(v: number): boolean {
  return userVersion > v;
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
    if (found.length) facesChanged('scan');
  } catch (err) {
    recordFaceScanFailure(absolutePath, err as Error);
  }
}

/**
 * Marks a photo that couldn't be read (corrupt, empty, not really an image, timed out over the
 * share…) as looked at, with the reason — otherwise it'd hold the progress count short forever and
 * be re-read over the network on every pass. Tried again once the file changes.
 */
export async function recordFaceScanFailure(absolutePath: string, err: Error): Promise<void> {
  if (!facesEnabled()) return;
  console.warn(`[faces] couldn't scan "${absolutePath}":`, err.message);
  try {
    const rel = path.relative(config.photosDir, absolutePath);
    const mtimeMs = await fs.stat(absolutePath).then((s) => s.mtimeMs, () => 0);
    db.prepare(
      `INSERT INTO face_scans (path, mtime_ms, faces, scanned_at, error) VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(path) DO UPDATE SET mtime_ms = excluded.mtime_ms, faces = 0, scanned_at = excluded.scanned_at, error = excluded.error`
    ).run(rel, mtimeMs, new Date().toISOString(), err.message.slice(0, 300));
  } catch {
    // best effort
  }
}

/** Photos that couldn't be read, for the People page's "which ones?" list. */
export function unreadablePhotos(limit = 500): Array<{ path: string; error: string }> {
  return db.prepare('SELECT path, error FROM face_scans WHERE error IS NOT NULL ORDER BY path LIMIT ?').all(limit) as Array<{ path: string; error: string }>;
}

/** "Try again": forget the failures so the next pass reads those photos again. */
export function retryUnreadable(): number {
  return db.prepare('DELETE FROM face_scans WHERE error IS NOT NULL').run().changes;
}

/**
 * Faces found before the "facing the camera" score existed have quality NULL. This fills it in, a
 * photo at a time in the background, by running just the face finder on the cached thumbnail again
 * and matching its boxes to the stored faces — names, confirmations, and faceprints are untouched.
 * Resumable: it simply picks up whatever is still NULL next time.
 */
let rescoring: { done: number; total: number } | null = null;

/** Set by the photo warm-up loop (services/photos.ts) so the People page can tell "busy" from "stuck". */
export const scanProgress: { running: boolean; lastAt: string | null } = { running: false, lastAt: null };

export async function backfillFaceQuality(): Promise<void> {
  if (rescoring || !facesEnabled() || !modelsPresent()) return;
  const paths = (db.prepare('SELECT DISTINCT path FROM faces WHERE quality IS NULL').all() as Array<{ path: string }>).map((r) => r.path);
  if (!paths.length) return;
  rescoring = { done: 0, total: paths.length };
  const update = db.prepare('UPDATE faces SET quality = ? WHERE id = ?');
  try {
    for (const rel of paths) {
      if (!facesEnabled()) break;
      try {
        const stored = db.prepare('SELECT id, x, y, w, h FROM faces WHERE path = ? AND quality IS NULL').all(rel) as Array<{ id: number; x: number; y: number; w: number; h: number }>;
        const found = await detectFaces(await getOrCreateThumbnail(path.join(config.photosDir, rel)), { faceprints: false });
        db.transaction(() => {
          for (const s of stored) {
            // Same thumbnail, same detector → the same box; match by overlap to be safe.
            let best = 0;
            let quality = 0.5; // not found again: call it borderline
            for (const f of found) {
              const ix = Math.max(0, Math.min(s.x + s.w, f.x + f.w) - Math.max(s.x, f.x));
              const iy = Math.max(0, Math.min(s.y + s.h, f.y + f.h) - Math.max(s.y, f.y));
              const inter = ix * iy;
              const iou = inter / (s.w * s.h + f.w * f.h - inter || 1);
              if (iou > best && iou > 0.5) {
                best = iou;
                quality = f.frontal;
              }
            }
            update.run(quality, s.id);
          }
        })();
      } catch (err) {
        // Photo gone/unreadable: mark its faces borderline so this doesn't retry them forever.
        db.prepare('UPDATE faces SET quality = 0.5 WHERE path = ? AND quality IS NULL').run(rel);
        console.warn(`[faces] couldn't re-score "${rel}":`, (err as Error).message);
      }
      rescoring.done++;
      if (rescoring.done % 500 === 0) facesChanged('scan');
    }
  } finally {
    rescoring = null;
    facesChanged();
  }
}

export async function faceStatus() {
  const total = (await listPhotos()).length;
  const scanned = (db.prepare('SELECT COUNT(*) AS n FROM face_scans').get() as { n: number }).n;
  const unreadable = (db.prepare('SELECT COUNT(*) AS n FROM face_scans WHERE error IS NOT NULL').get() as { n: number }).n;
  return {
    enabled: facesEnabled(),
    models_present: modelsPresent(),
    preparing,
    scanned: Math.min(scanned, total),
    total,
    faces: (db.prepare('SELECT COUNT(*) AS n FROM faces WHERE ignored = 0').get() as { n: number }).n,
    ignored: (db.prepare('SELECT COUNT(*) AS n FROM faces WHERE ignored = 1').get() as { n: number }).n,
    people: (db.prepare('SELECT COUNT(*) AS n FROM people').get() as { n: number }).n,
    rescoring,
    unreadable,
    /** The background pass is running right now, and when it last finished a photo. */
    working: scanProgress.running,
    last_progress_at: scanProgress.lastAt,
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

let loadedUpToId = 0;

/** Reads faceprints added since last time into the matcher (a face's faceprint never changes — a
 *  re-scanned photo gets new face rows). */
function loadNewFaceprints(): void {
  const rows = db.prepare('SELECT id, embedding FROM faces WHERE id > ? ORDER BY id').all(loadedUpToId) as Array<{ id: number; embedding: Buffer }>;
  if (!rows.length) return;
  addFaceprints(rows.map((r) => ({ id: r.id, vector: toVector(r.embedding) })));
  loadedUpToId = rows[rows.length - 1].id;
}

let cache: { version: number; faces: FaceInfo[] } | null = null;
let building: Promise<{ faces: FaceInfo[] }> | null = null;

/** Every (not ignored) face with its current suggestion: the person whose confirmed faces it best
 *  matches — skipping "not this person" rejections — but only if one person clearly wins (see the
 *  thresholds above). Cached until anything changes; one refresh at a time. */
export async function allFaces(): Promise<{ faces: FaceInfo[] }> {
  // Only new photos scanned since: answer right away with what we have, and catch up in the background.
  if (cache && cache.version !== version && !userChangedSince(cache.version)) {
    if (!building) {
      building = buildAllFaces().finally(() => {
        building = null;
      });
      building.catch((e) => console.warn('[faces] refresh failed', e));
    }
    return cache;
  }
  while (!cache || cache.version !== version) {
    if (!building) {
      building = buildAllFaces().finally(() => {
        building = null;
      });
    }
    const result = await building;
    // Something changed while it was being worked out: use it anyway if it's only new scans.
    if (cache && cache.version !== version && !userChangedSince(cache.version)) return result;
  }
  return cache;
}

type FaceMeta = Omit<FaceRow, 'embedding'>;
const META_COLUMNS = 'id, path, x, y, w, h, score, quality, person_id, confirmed, ignored, no_group';

/** Every face's details, kept in memory; refreshed from the face_changes log (see db.ts) rather
 *  than re-reading every face each time. */
const meta = new Map<number, FaceInfo & { ignored: boolean }>();
let metaUpToId = 0;
let metaLoaded = false;

function toInfo(r: FaceMeta): FaceInfo & { ignored: boolean } {
  return {
    id: r.id, path: r.path, x: r.x, y: r.y, w: r.w, h: r.h, person_id: r.person_id, confirmed: Boolean(r.confirmed),
    good: isGoodFace(r), no_group: Boolean(r.no_group), ignored: Boolean(r.ignored),
    suggested_person_id: null, similarity: null,
  };
}

function syncMeta(): void {
  const lastChange = (db.prepare('SELECT MAX(seq) AS s FROM face_changes').get() as { s: number | null }).s ?? 0;
  if (!metaLoaded) {
    for (const r of db.prepare(`SELECT ${META_COLUMNS} FROM faces`).all() as FaceMeta[]) meta.set(r.id, toInfo(r));
    metaLoaded = true;
  } else {
    const changed = (db.prepare('SELECT DISTINCT face_id FROM face_changes WHERE seq <= ?').all(lastChange) as Array<{ face_id: number }>).map((r) => r.face_id);
    const one = db.prepare(`SELECT ${META_COLUMNS} FROM faces WHERE id = ?`);
    for (const id of changed) {
      if (id > metaUpToId) continue; // a new face — read below
      const r = one.get(id) as FaceMeta | undefined;
      if (r) meta.set(id, toInfo(r));
      else meta.delete(id);
    }
    for (const r of db.prepare(`SELECT ${META_COLUMNS} FROM faces WHERE id > ?`).all(metaUpToId) as FaceMeta[]) meta.set(r.id, toInfo(r));
  }
  db.prepare('DELETE FROM face_changes WHERE seq <= ?').run(lastChange);
  for (const id of meta.keys()) if (id > metaUpToId) metaUpToId = id;
}

async function buildAllFaces(): Promise<{ faces: FaceInfo[] }> {
  const seenVersion = version;
  loadNewFaceprints();
  syncMeta();
  const rejectedFor = new Map<number, Set<string>>();
  for (const r of db.prepare('SELECT face_id, person_id FROM face_rejections').all() as Array<{ face_id: number; person_id: string }>) {
    if (!rejectedFor.has(r.face_id)) rejectedFor.set(r.face_id, new Set());
    rejectedFor.get(r.face_id)!.add(r.person_id);
  }
  const membersOf = new Map<string, number[]>();
  for (const f of meta.values()) {
    if (f.confirmed && f.person_id && !f.ignored) {
      const list = membersOf.get(f.person_id) ?? [];
      list.push(f.id);
      membersOf.set(f.person_id, list);
    }
  }
  forgetPeopleExcept(new Set(membersOf.keys()));
  const people: Array<{ id: string; best: Float32Array }> = [];
  for (const [id, members] of membersOf) people.push({ id, best: await personColumn(id, members) });

  // Suggestions, updated in place on the kept face objects.
  const faces: FaceInfo[] = [];
  for (const f of meta.values()) {
    if (f.ignored) continue;
    faces.push(f);
    f.suggested_person_id = null;
    f.similarity = null;
    const i = faceIndex(f.id);
    if (f.confirmed || i === undefined) continue;
    const rejected = rejectedFor.get(f.id);
    let firstId: string | null = null;
    let first = -2;
    let second = -2;
    for (const p of people) {
      const sim = p.best[i];
      if (sim <= -2 || rejected?.has(p.id)) continue;
      if (sim > first) {
        second = first;
        first = sim;
        firstId = p.id;
      } else if (sim > second) second = sim;
    }
    if (firstId === null) continue;
    f.similarity = first;
    const needed = f.good ? SUGGEST_THRESHOLD : SUGGEST_THRESHOLD_LOW_QUALITY;
    if (first >= needed && first - second >= SUGGEST_MARGIN) f.suggested_person_id = firstId;
  }
  cache = { version: seenVersion, faces };
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
let groupsCache: { version: number; at: number; groups: FaceInfo[][] } | null = null;

export async function unnamedGroups(limit = 30, perGroup = 24): Promise<FaceInfo[][]> {
  // Regrouped after anyone names/ignores something; while photos are being scanned, at most every
  // 10 minutes (it's the slowest thing on the page).
  const fresh = groupsCache && (groupsCache.version === version || (!userChangedSince(groupsCache.version) && Date.now() - groupsCache.at < 10 * 60_000));
  if (!fresh) groupsCache = null;
  const { faces } = await allFaces();
  if (groupsCache) {
    // Drop anyone named/suggested since.
    const current = new Map(faces.map((f) => [f.id, f]));
    return groupsCache.groups
      .map((g) => g.map((f) => current.get(f.id)).filter((f): f is FaceInfo => Boolean(f && !f.confirmed && !f.suggested_person_id)))
      .filter((g) => g.length)
      .slice(0, limit)
      .map((g) => g.slice(0, perGroup));
  }
  const seenVersion = version;
  const quality = new Map(
    (db.prepare('SELECT id, score, w, quality FROM faces WHERE ignored = 0').all() as Array<{ id: number; score: number; w: number; quality: number | null }>).map(
      (r) => [r.id, r.score * Math.min(1, r.w * 10) * (r.quality ?? 0.8)]
    )
  );
  const pool = faces
    .filter((f) => !f.confirmed && !f.suggested_person_id && f.good && !f.no_group)
    .sort((a, b) => (quality.get(b.id) ?? 0) - (quality.get(a.id) ?? 0))
    .slice(0, GROUP_POOL);
  // Each face's similarity to every other face in the pool, worked out a row at a time.
  const rowFor = similarityRows(pool.map((f) => f.id));
  const position = new Map(pool.map((f, k) => [f.id, k]));
  const groups: FaceInfo[][] = [];
  for (const [k, f] of pool.entries()) {
    const row = rowFor(k);
    const sim = (other: FaceInfo) => row[position.get(other.id)!];
    let best: { g: FaceInfo[]; avg: number } | null = null;
    for (const g of groups) {
      if (sim(g[0]) < GROUP_THRESHOLD) continue;
      const sims = g.slice(0, 12).map(sim);
      const avg = sims.reduce((a, b) => a + b, 0) / sims.length;
      if (avg >= GROUP_THRESHOLD && Math.min(...sims) >= GROUP_MIN_MEMBER && (!best || avg > best.avg)) best = { g, avg };
    }
    if (best) best.g.push(f);
    else groups.push([f]);
  }
  groups.sort((a, b) => b.length - a.length);
  groupsCache = { version: seenVersion, at: Date.now(), groups: groups.slice(0, 100) };
  return groupsCache.groups.slice(0, limit).map((g) => g.slice(0, perGroup));
}

/** Photos with faces still to name (not confirmed, not ignored), most faces first — the
 *  "photo by photo" queue. Includes the small/turned-away faces grouping leaves out. */
export async function photosToName(): Promise<Array<{ path: string; faces: number }>> {
  const counts = new Map<string, number>();
  for (const f of (await allFaces()).faces) if (!f.confirmed) counts.set(f.path, (counts.get(f.path) ?? 0) + 1);
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
