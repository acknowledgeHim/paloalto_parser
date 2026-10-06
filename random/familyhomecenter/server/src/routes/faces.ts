import { Router } from 'express';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { listPhotos, photoIdFor, warmThumbnailCache } from '../services/photos.js';
import { allFaces, faceCrop, facesChanged, faceStatus, photosToName, setFacesEnabled, unnamedGroups, type FaceInfo } from '../services/faces/index.js';

// Face recognition — see services/faces/. Turning it on/off is parent-only (it's heavy work for a
// Pi); naming people and confirming/rejecting suggestions is open to the household, like albums.
export const facesRouter = Router();

/** Faces as the client sees them: the photo's id instead of its path. */
async function withPhotoIds(faces: FaceInfo[]) {
  const idFor = new Map((await listPhotos()).map((abs) => [path.relative(config.photosDir, abs), photoIdFor(abs)]));
  return faces
    .filter((f) => idFor.has(f.path))
    .map(({ path: p, ...f }) => ({ ...f, photo_id: idFor.get(p)! }));
}

facesRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(await faceStatus());
  })
);

/** PUT /enabled { enabled } — turning on downloads the models (once) and starts scanning. */
facesRouter.put(
  '/enabled',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const enabled = (req.body as { enabled?: boolean }).enabled === true;
    try {
      await setFacesEnabled(enabled);
    } catch (err) {
      return res.status(502).json({ error: (err as Error).message });
    }
    if (enabled) warmThumbnailCache().catch((e) => console.warn('[faces] scan pass failed', e));
    res.json(await faceStatus());
  })
);

// ---- People ----

facesRouter.get(
  '/people',
  asyncHandler(async (_req, res) => {
    const people = db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE').all() as Array<{ id: string; name: string }>;
    const faces = await withPhotoIds(allFaces().faces);
    res.json(
      people.map((p) => {
        const confirmed = faces.filter((f) => f.confirmed && f.person_id === p.id);
        const suggested = faces.filter((f) => !f.confirmed && f.suggested_person_id === p.id);
        return {
          ...p,
          cover_face_id: confirmed[0]?.id ?? null,
          confirmed_count: confirmed.length,
          suggested_count: suggested.length,
          photo_count: new Set([...confirmed, ...suggested].map((f) => f.photo_id)).size,
        };
      })
    );
  })
);

facesRouter.post('/people', (req, res) => {
  const name = String((req.body as { name?: string }).name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Give them a name' });
  if (name.length > 80) return res.status(400).json({ error: 'That name is too long' });
  const existing = db.prepare('SELECT * FROM people WHERE name = ? COLLATE NOCASE').get(name);
  if (existing) return res.json(existing);
  const person = { id: uuidv4(), name, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO people (id, name, created_at) VALUES (@id, @name, @created_at)').run(person);
  res.status(201).json(person);
});

facesRouter.patch('/people/:id', (req, res) => {
  const name = String((req.body as { name?: string }).name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Give them a name' });
  const result = db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

/** Deleting a person only forgets the name — their faces go back to unnamed. */
facesRouter.delete('/people/:id', (req, res) => {
  db.prepare('UPDATE faces SET person_id = NULL, confirmed = 0 WHERE person_id = ?').run(req.params.id);
  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  facesChanged();
  res.status(204).end();
});

/** GET /people/:id — their confirmed faces, and suggested ones (most likely first). */
facesRouter.get(
  '/people/:id',
  asyncHandler(async (req, res) => {
    const person = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
    if (!person) return res.status(404).json({ error: 'not found' });
    const faces = await withPhotoIds(allFaces().faces);
    res.json({
      person,
      confirmed: faces.filter((f) => f.confirmed && f.person_id === req.params.id),
      suggested: faces
        .filter((f) => !f.confirmed && f.suggested_person_id === req.params.id)
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)),
    });
  })
);

/** GET /people/:id/photos[?suggested=0] — photo ids with this person in them (confirmed, plus
 *  suggested unless turned off), for the Photos filter and "With a person" picking. */
facesRouter.get(
  '/people/:id/photos',
  asyncHandler(async (req, res) => {
    const includeSuggested = req.query.suggested !== '0';
    const faces = await withPhotoIds(allFaces().faces);
    const ids = faces
      .filter((f) => (f.confirmed && f.person_id === req.params.id) || (includeSuggested && !f.confirmed && f.suggested_person_id === req.params.id))
      .map((f) => f.photo_id);
    res.json([...new Set(ids)]);
  })
);

/** GET /groups — unnamed faces grouped by likely-same-person ("Who's this?"). */
facesRouter.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const groups = unnamedGroups();
    const flat = await withPhotoIds(groups.flat());
    const byId = new Map(flat.map((f) => [f.id, f]));
    res.json(groups.map((g) => g.map((f) => byId.get(f.id)).filter(Boolean)).filter((g) => g.length));
  })
);

/** GET /queue — photos with faces still to name, for going through them photo by photo. */
facesRouter.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const idFor = new Map((await listPhotos()).map((abs) => [path.relative(config.photosDir, abs), photoIdFor(abs)]));
    res.json(
      photosToName()
        .filter((p) => idFor.has(p.path))
        .map((p) => ({ photo_id: idFor.get(p.path)!, faces: p.faces }))
    );
  })
);

/** GET /in-photo/:photoId — the faces in one photo, with names/suggestions (for the photo viewer). */
facesRouter.get(
  '/in-photo/:photoId',
  asyncHandler(async (req, res) => {
    const faces = await withPhotoIds(allFaces().faces);
    res.json(faces.filter((f) => f.photo_id === req.params.photoId).sort((a, b) => a.x - b.x));
  })
);

// ---- Naming / confirming / rejecting ----

function faceIds(body: unknown): number[] {
  const ids = (body as { face_ids?: unknown }).face_ids;
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n)) : [];
}

/** POST /assign { face_ids, person_id } or { face_ids, name } — "these are Sam" (creates the person
 *  by name if needed). Confirmed from then on. */
facesRouter.post('/assign', (req, res) => {
  const ids = faceIds(req.body);
  if (!ids.length) return res.status(400).json({ error: 'No faces given' });
  let personId = (req.body as { person_id?: string }).person_id;
  const name = String((req.body as { name?: string }).name ?? '').trim();
  if (!personId && name) {
    const existing = db.prepare('SELECT id FROM people WHERE name = ? COLLATE NOCASE').get(name) as { id: string } | undefined;
    personId = existing?.id;
    if (!personId) {
      personId = uuidv4();
      db.prepare('INSERT INTO people (id, name, created_at) VALUES (?, ?, ?)').run(personId, name, new Date().toISOString());
    }
  }
  if (!personId || !db.prepare('SELECT 1 FROM people WHERE id = ?').get(personId)) return res.status(400).json({ error: 'Pick or type a name' });
  const assign = db.prepare('UPDATE faces SET person_id = ?, confirmed = 1 WHERE id = ?');
  const unreject = db.prepare('DELETE FROM face_rejections WHERE face_id = ? AND person_id = ?');
  db.transaction(() => {
    for (const id of ids) {
      assign.run(personId, id);
      unreject.run(id, personId);
    }
  })();
  facesChanged();
  res.json({ person_id: personId });
});

/** POST /reject { face_ids, person_id } — "that's not Sam": stops suggesting it (and un-tags it if
 *  it had been confirmed as them). */
facesRouter.post('/reject', (req, res) => {
  const ids = faceIds(req.body);
  const personId = String((req.body as { person_id?: string }).person_id ?? '');
  if (!ids.length || !personId) return res.status(400).json({ error: 'face_ids and person_id are required' });
  const reject = db.prepare('INSERT OR IGNORE INTO face_rejections (face_id, person_id) VALUES (?, ?)');
  const untag = db.prepare('UPDATE faces SET person_id = NULL, confirmed = 0 WHERE id = ? AND person_id = ?');
  db.transaction(() => {
    for (const id of ids) {
      reject.run(id, personId);
      untag.run(id, personId);
    }
  })();
  facesChanged();
  res.json({ ok: true });
});

/** POST /unassign { face_ids } — forget who these are (back to unnamed). */
facesRouter.post('/unassign', (req, res) => {
  const ids = faceIds(req.body);
  const stmt = db.prepare('UPDATE faces SET person_id = NULL, confirmed = 0 WHERE id = ?');
  db.transaction(() => ids.forEach((id) => stmt.run(id)))();
  facesChanged();
  res.json({ ok: true });
});

/** POST /ignore { face_ids } — "not a face / someone we don't need to name" (a stranger in the
 *  background, a poster, a false detection): left out of groups, suggestions, and the queue. */
facesRouter.post('/ignore', (req, res) => {
  const ids = faceIds(req.body);
  const stmt = db.prepare('UPDATE faces SET ignored = 1, person_id = NULL, confirmed = 0 WHERE id = ?');
  db.transaction(() => ids.forEach((id) => stmt.run(id)))();
  facesChanged();
  res.json({ ok: true });
});

/** POST /unignore-all — bring every ignored face back. */
facesRouter.post('/unignore-all', (_req, res) => {
  db.prepare('UPDATE faces SET ignored = 0').run();
  facesChanged();
  res.json({ ok: true });
});

/** POST /separate { face_ids } — "these are different people": never group them; they're named one
 *  at a time (photo by photo), and still get suggestions once those people are named. */
facesRouter.post('/separate', (req, res) => {
  const ids = faceIds(req.body);
  const stmt = db.prepare('UPDATE faces SET no_group = 1 WHERE id = ?');
  db.transaction(() => ids.forEach((id) => stmt.run(id)))();
  facesChanged();
  res.json({ ok: true });
});

facesRouter.get(
  '/:faceId/image',
  asyncHandler(async (req, res) => {
    const file = await faceCrop(Number(req.params.faceId));
    if (!file) return res.status(404).end();
    res.sendFile(file);
  })
);
