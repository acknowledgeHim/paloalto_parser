import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { photoIdsByPath, photoPathsById, warmThumbnailCache } from '../services/photos.js';
import { allFaces, faceCrop, facesChanged, faceStatus, photosToName, retryUnreadable, setFacesEnabled, unnamedGroups, unreadablePhotos, type FaceInfo } from '../services/faces/index.js';

// Face recognition — see services/faces/. Turning it on/off is parent-only (it's heavy work for a
// Pi); naming people and confirming/rejecting suggestions is open to the household, like albums.
export const facesRouter = Router();

/** Faces as the client sees them: the photo's id instead of its path. */
async function withPhotoIds(faces: FaceInfo[]) {
  const idFor = await photoIdsByPath();
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

/** GET /unreadable — photos that couldn't be read (path + reason). */
facesRouter.get('/unreadable', (_req, res) => {
  res.json(unreadablePhotos());
});

/** POST /retry-unreadable — read those photos again (e.g. after fixing them), starting now. */
facesRouter.post('/retry-unreadable', (_req, res) => {
  const n = retryUnreadable();
  warmThumbnailCache().catch((e) => console.warn('[faces] scan pass failed', e));
  res.json({ retrying: n });
});

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
    const people = db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE').all() as Array<{ id: string; name: string; cover_face_id: number | null }>;
    const taggedOf = new Map<string, string[]>();
    for (const t of db.prepare('SELECT path, person_id FROM photo_people').all() as Array<{ path: string; person_id: string }>) {
      if (!taggedOf.has(t.person_id)) taggedOf.set(t.person_id, []);
      taggedOf.get(t.person_id)!.push(t.path);
    }
    // One pass over every face, tallying per person (only photos still in the library).
    const inLibrary = await photoIdsByPath();
    const confirmedOf = new Map<string, FaceInfo[]>();
    const suggestedOf = new Map<string, FaceInfo[]>();
    for (const f of (await allFaces()).faces) {
      if (!inLibrary.has(f.path)) continue;
      const [map, who] = f.confirmed ? [confirmedOf, f.person_id] : [suggestedOf, f.suggested_person_id];
      if (!who) continue;
      if (!map.has(who)) map.set(who, []);
      map.get(who)!.push(f);
    }
    res.json(
      people.map((p) => {
        const confirmed = confirmedOf.get(p.id) ?? [];
        const suggested = suggestedOf.get(p.id) ?? [];
        return {
          ...p,
          // Their chosen picture (if it's still one of their faces), else the clearest, biggest one.
          cover_face_id:
            confirmed.find((f) => f.id === p.cover_face_id)?.id ??
            [...confirmed].sort((a, b) => Number(b.good) - Number(a.good) || b.w - a.w)[0]?.id ??
            null,
          confirmed_count: confirmed.length,
          suggested_count: suggested.length,
          tagged_count: (taggedOf.get(p.id) ?? []).filter((path) => inLibrary.has(path)).length,
          photo_count: new Set([...[...confirmed, ...suggested].map((f) => f.path), ...(taggedOf.get(p.id) ?? []).filter((path) => inLibrary.has(path))]).size,
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

/** PATCH /people/:id { name } and/or { cover_face_id } (one of their confirmed faces, or null for automatic). */
facesRouter.patch('/people/:id', (req, res) => {
  const body = req.body as { name?: string; cover_face_id?: number | null };
  if (!db.prepare('SELECT 1 FROM people WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'not found' });
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return res.status(400).json({ error: 'Give them a name' });
    db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, req.params.id);
  }
  if (body.cover_face_id !== undefined) {
    const faceId = body.cover_face_id === null ? null : Number(body.cover_face_id);
    if (faceId !== null && !db.prepare('SELECT 1 FROM faces WHERE id = ? AND person_id = ? AND confirmed = 1').get(faceId, req.params.id)) {
      return res.status(400).json({ error: 'Pick one of their confirmed faces' });
    }
    db.prepare('UPDATE people SET cover_face_id = ? WHERE id = ?').run(faceId, req.params.id);
  }
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
    const all = (await allFaces()).faces;
    res.json({
      person,
      confirmed: await withPhotoIds(all.filter((f) => f.confirmed && f.person_id === req.params.id)),
      suggested: (await withPhotoIds(all.filter((f) => !f.confirmed && f.suggested_person_id === req.params.id))).sort(
        (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)
      ),
    });
  })
);

/** GET /people/:id/photos[?suggested=0] — photo ids with this person in them (confirmed, tagged by
 *  hand, plus suggested unless turned off), for the Photos filter and "With a person" picking. */
facesRouter.get(
  '/people/:id/photos',
  asyncHandler(async (req, res) => {
    const includeSuggested = req.query.suggested !== '0';
    const faces = await withPhotoIds(
      (await allFaces()).faces.filter(
        (f) => (f.confirmed && f.person_id === req.params.id) || (includeSuggested && !f.confirmed && f.suggested_person_id === req.params.id)
      )
    );
    const ids = faces.map((f) => f.photo_id);
    const idFor = await photoIdsByPath();
    for (const t of db.prepare('SELECT path FROM photo_people WHERE person_id = ?').all(req.params.id) as Array<{ path: string }>) {
      const id = idFor.get(t.path);
      if (id) ids.push(id);
    }
    res.json([...new Set(ids)]);
  })
);

/** GET /groups — unnamed faces grouped by likely-same-person ("Who's this?"). */
facesRouter.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const groups = await unnamedGroups();
    const flat = await withPhotoIds(groups.flat());
    const byId = new Map(flat.map((f) => [f.id, f]));
    res.json(groups.map((g) => g.map((f) => byId.get(f.id)).filter(Boolean)).filter((g) => g.length));
  })
);

/** GET /queue — photos with faces still to name, for going through them photo by photo. */
facesRouter.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const idFor = await photoIdsByPath();
    res.json(
      (await photosToName())
        .filter((p) => idFor.has(p.path))
        .map((p) => ({ photo_id: idFor.get(p.path)!, faces: p.faces }))
    );
  })
);

/** GET /in-photo/:photoId — the faces in one photo, with names/suggestions (for the photo viewer). */
facesRouter.get(
  '/in-photo/:photoId',
  asyncHandler(async (req, res) => {
    const rel = (await photoPathsById()).get(req.params.photoId);
    if (!rel) return res.json([]);
    res.json((await withPhotoIds((await allFaces()).faces.filter((f) => f.path === rel))).sort((a, b) => a.x - b.x));
  })
);

// ---- Naming / confirming / rejecting ----

function faceIds(body: unknown): number[] {
  const ids = (body as { face_ids?: unknown }).face_ids;
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n)) : [];
}

/** The person a request means: { person_id }, or { name } (creating them if new). Null if neither. */
function personFrom(body: unknown): string | null {
  let personId = (body as { person_id?: string }).person_id;
  const name = String((body as { name?: string }).name ?? '').trim().slice(0, 80);
  if (!personId && name) {
    const existing = db.prepare('SELECT id FROM people WHERE name = ? COLLATE NOCASE').get(name) as { id: string } | undefined;
    personId = existing?.id;
    if (!personId) {
      personId = uuidv4();
      db.prepare('INSERT INTO people (id, name, created_at) VALUES (?, ?, ?)').run(personId, name, new Date().toISOString());
    }
  }
  return personId && db.prepare('SELECT 1 FROM people WHERE id = ?').get(personId) ? personId : null;
}

/** POST /assign { face_ids, person_id } or { face_ids, name } — "these are Sam" (creates the person
 *  by name if needed). Confirmed from then on. */
facesRouter.post('/assign', (req, res) => {
  const ids = faceIds(req.body);
  if (!ids.length) return res.status(400).json({ error: 'No faces given' });
  const personId = personFrom(req.body);
  if (!personId) return res.status(400).json({ error: 'Pick or type a name' });
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
// ---- People tagged by hand (no face to name: back of the head, side view…) ----

/** GET /tagged/:photoId — person ids tagged by hand in this photo. */
facesRouter.get(
  '/tagged/:photoId',
  asyncHandler(async (req, res) => {
    const rel = (await photoPathsById()).get(req.params.photoId);
    if (!rel) return res.json([]);
    res.json((db.prepare('SELECT person_id FROM photo_people WHERE path = ? ORDER BY created_at').all(rel) as Array<{ person_id: string }>).map((r) => r.person_id));
  })
);

/** POST /tag { photo_id, person_id } or { photo_id, name } — "Sam's in this photo too". */
facesRouter.post(
  '/tag',
  asyncHandler(async (req, res) => {
    const rel = (await photoPathsById()).get(String((req.body as { photo_id?: string }).photo_id ?? ''));
    if (!rel) return res.status(404).json({ error: 'Photo not found' });
    const personId = personFrom(req.body);
    if (!personId) return res.status(400).json({ error: 'Pick or type a name' });
    db.prepare('INSERT OR IGNORE INTO photo_people (path, person_id, created_at) VALUES (?, ?, ?)').run(rel, personId, new Date().toISOString());
    res.json({ person_id: personId });
  })
);

/** POST /untag { photo_id, person_id } */
facesRouter.post(
  '/untag',
  asyncHandler(async (req, res) => {
    const body = req.body as { photo_id?: string; person_id?: string };
    const rel = (await photoPathsById()).get(String(body.photo_id ?? ''));
    if (rel) db.prepare('DELETE FROM photo_people WHERE path = ? AND person_id = ?').run(rel, String(body.person_id ?? ''));
    res.json({ ok: true });
  })
);

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
