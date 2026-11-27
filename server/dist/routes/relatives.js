import { Router } from 'express';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db, getSetting, setSetting } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { allFaces } from '../services/faces/index.js';
import { listLibrary } from '../services/movieLibrary.js';
import { mapWithConcurrency } from '../services/movieSelection.js';
import { getPhotoDate } from '../services/photoDates.js';
import { hiddenPhotoPaths, photoIdsByPath, photoPathsById } from '../services/photos.js';
import { isParentRequest, isSelfOrParent, sessionActor } from '../services/rewards.js';
/**
 * 👪 Relatives (Family → Relatives): family, living or not — names, birthdays, memories, and the
 * photos and home movies they're in. Linking a face-recognition person makes every photo with their
 * face theirs; linking a household profile gives that person a birthday. Also: 🎂 today's birthdays
 * (Home, and a hello on each person's first visit of the day) and 📸 "photos of me from years ago"
 * for anyone who turns it on. Files are only pointed at (by path) — never copied, moved or changed.
 *
 * Parents add and edit relatives, and so does a kid a parent lets (Settings → Kids' access → 👪);
 * someone linked to their own entry can edit that one. Only parents hide one or link a household
 * profile. Anyone in the family can add memories and tag photos and movies.
 */
export const relativesRouter = Router();
const relOf = (id) => db.prepare('SELECT * FROM relatives WHERE id = ?').get(id);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/; // year 0000 = "don't know the year"
// ---- 🎂 dates ----
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseDate(s) {
    const m = s ? DATE.exec(s) : null;
    return m ? { y: Number(m[1]) || null, m: Number(m[2]), d: Number(m[3]) } : null;
}
/** Days from today to their next birthday (0 = today). Feb 29 is the 28th in other years. */
function daysToBirthday(birth, now = new Date()) {
    const b = parseDate(birth);
    if (!b)
        return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const on = (year) => {
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return new Date(year, b.m - 1, b.m === 2 && b.d === 29 && !leap ? 28 : b.d);
    };
    let next = on(today.getFullYear());
    if (next < today)
        next = on(today.getFullYear() + 1);
    return { days: Math.round((next.getTime() - today.getTime()) / 86400_000), year: next.getFullYear(), age: b.y ? next.getFullYear() - b.y : null };
}
function ageNow(r, now = new Date()) {
    const b = parseDate(r.birth_date);
    if (!b?.y)
        return null;
    const end = parseDate(r.death_date);
    const at = end?.y ? new Date(end.y, end.m - 1, end.d) : now;
    let age = at.getFullYear() - b.y;
    if (at.getMonth() + 1 < b.m || (at.getMonth() + 1 === b.m && at.getDate() < b.d))
        age--;
    return age;
}
// ---- 📷 their photos and movies ----
/** Photos (paths under the photos folder) with this face-recognition person: named faces and hand tags (not suggestions). */
async function personPaths(personId) {
    const out = new Set();
    if (!personId)
        return out;
    for (const f of (await allFaces()).faces)
        if (f.confirmed && f.person_id === personId)
            out.add(f.path);
    for (const t of db.prepare('SELECT path FROM photo_people WHERE person_id = ?').all(personId))
        out.add(t.path);
    return out;
}
function mediaRows(relativeId, kind) {
    return db.prepare('SELECT rel_path, hidden FROM relative_media WHERE relative_id = ? AND kind = ?').all(relativeId, kind);
}
/** Their photos: the linked person's faces + photos tagged here, minus ones taken off here. */
async function relativePhotoPaths(r) {
    const rows = mediaRows(r.id, 'photo');
    const off = new Set(rows.filter((x) => x.hidden).map((x) => x.rel_path));
    const all = await personPaths(r.person_id);
    for (const x of rows)
        if (!x.hidden)
            all.add(x.rel_path);
    for (const p of off)
        all.delete(p);
    return all;
}
async function photosOut(paths) {
    const idFor = await photoIdsByPath();
    const hidden = hiddenPhotoPaths();
    const list = [...paths].filter((p) => idFor.has(p) && !hidden.has(p));
    const dated = await mapWithConcurrency(list, 8, async (p) => ({ id: idFor.get(p), taken_at: (await getPhotoDate(path.join(config.photosDir, p))).toISOString() }));
    return dated.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
}
function summary(r) {
    const next = daysToBirthday(r.birth_date);
    const member = r.family_member_id ? db.prepare('SELECT id, name FROM family_members WHERE id = ?').get(r.family_member_id) : undefined;
    const person = r.person_id ? db.prepare('SELECT id, name FROM people WHERE id = ?').get(r.person_id) : undefined;
    return { ...r, hidden: r.hidden === 1, age: ageNow(r), living: !r.death_date, next_birthday: next, member: member ?? null, person: person ?? null };
}
// ---- list / view ----
/** GET /?all=1 — everyone (hidden ones too with all=1, for parents), birthdays coming up first. */
relativesRouter.get('/', asyncHandler(async (req, res) => {
    const all = req.query.all === '1';
    const rows = db.prepare(`SELECT * FROM relatives ${all ? '' : 'WHERE hidden = 0'} ORDER BY name COLLATE NOCASE`).all();
    const idFor = await photoIdsByPath();
    const out = [];
    for (const r of rows) {
        const paths = [...(await relativePhotoPaths(r))].filter((p) => idFor.has(p));
        // 📷 the picked default picture, while it's still one of theirs; else the first
        const cover = r.cover_path && paths.includes(r.cover_path) ? r.cover_path : paths[0];
        out.push({ ...summary(r), photo_count: paths.length, cover_photo_id: cover ? idFor.get(cover) : null });
    }
    res.json(out);
}));
/** GET /birthdays?member_id= — 🎂 today's birthdays, the next few weeks', and whether this person still gets today's hello. */
relativesRouter.get('/birthdays', (req, res) => {
    const memberId = typeof req.query.member_id === 'string' ? req.query.member_id : '';
    const rows = db.prepare('SELECT * FROM relatives WHERE hidden = 0 AND birth_date IS NOT NULL').all();
    const list = rows
        .map((r) => {
        const next = daysToBirthday(r.birth_date);
        return next && { id: r.id, name: r.nickname || r.name, relation: r.relation, living: !r.death_date, is_you: Boolean(memberId) && r.family_member_id === memberId, days: next.days, turns: next.age };
    })
        .filter((x) => Boolean(x) && x.days <= 30)
        .sort((a, b) => a.days - b.days);
    const today = list.filter((x) => x.days === 0);
    const seen = memberId ? db.prepare('SELECT 1 FROM birthday_greetings_seen WHERE family_member_id = ? AND day = ?').get(memberId, localDay()) : true;
    res.json({ today, soon: list.filter((x) => x.days > 0), greet: today.length > 0 && !seen });
});
/** POST /birthdays/seen { member_id } — they've had today's hello. */
relativesRouter.post('/birthdays/seen', (req, res) => {
    const memberId = String(req.body?.member_id ?? '');
    if (!db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(memberId))
        return res.status(404).json({ error: 'not found' });
    db.prepare('INSERT OR IGNORE INTO birthday_greetings_seen (family_member_id, day) VALUES (?, ?)').run(memberId, localDay());
    res.json({ ok: true });
});
const MEM_KEY = 'photo_memories';
function memorySettings() {
    try {
        return JSON.parse(getSetting(MEM_KEY, '{}'));
    }
    catch {
        return {};
    }
}
const mineOf = (memberId) => memorySettings()[memberId] ?? { on: false, years: [1, 3, 5, 10] };
/**
 * GET /my-photos?member_id= — photos with them in from about this day (± 3 days) in the years they
 * picked. Shown on their Home screen even if Photos is off for them: it's only pictures of themselves.
 */
relativesRouter.get('/my-photos', asyncHandler(async (req, res) => {
    const memberId = String(req.query.member_id ?? '');
    const mine = mineOf(memberId);
    const me = db.prepare('SELECT * FROM relatives WHERE family_member_id = ? LIMIT 1').get(memberId);
    const base = { ...mine, linked: Boolean(me), has_face: Boolean(me?.person_id) };
    if (!mine.on || !me)
        return res.json({ ...base, photos: [] });
    const now = new Date();
    const want = new Set(mine.years);
    const photos = (await photosOut(await relativePhotoPaths(me)))
        .map((p) => {
        const t = new Date(p.taken_at);
        const ago = now.getFullYear() - t.getFullYear();
        const that = new Date(t.getFullYear(), now.getMonth(), now.getDate());
        const off = Math.abs((t.getTime() - that.getTime()) / 86400_000);
        return { ...p, years_ago: ago, close: off <= 3.5 };
    })
        .filter((p) => p.close && p.years_ago >= 1 && (want.size === 0 || want.has(p.years_ago)))
        .sort((a, b) => a.years_ago - b.years_ago || a.taken_at.localeCompare(b.taken_at))
        .slice(0, 30)
        .map(({ close: _c, ...p }) => p);
    res.json({ ...base, photos });
}));
/** PUT /my-photos/settings { member_id, on, years, acting_member_id } — them or a parent. */
relativesRouter.put('/my-photos/settings', (req, res) => {
    const { member_id, on, years, acting_member_id } = req.body ?? {};
    const memberId = String(member_id ?? '');
    if (!db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(memberId))
        return res.status(404).json({ error: 'not found' });
    if (!isSelfOrParent(req, memberId, acting_member_id))
        return res.status(403).json({ error: 'Only they or a parent can change this' });
    const ys = Array.isArray(years) ? [...new Set(years.map((y) => Math.round(Number(y))).filter((y) => y >= 1 && y <= 100))].sort((a, b) => a - b) : mineOf(memberId).years;
    const all = memorySettings();
    all[memberId] = { on: Boolean(on), years: ys };
    setSetting(MEM_KEY, JSON.stringify(all));
    res.json(all[memberId]);
});
/** GET /:id — one relative: details, memories, photos and movies. */
relativesRouter.get('/:id', asyncHandler(async (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    const memories = db
        .prepare(`SELECT m.*, f.name AS author_name FROM relative_memories m LEFT JOIN family_members f ON f.id = m.author_member_id
         WHERE m.relative_id = ? ${req.query.all === '1' ? '' : 'AND m.hidden = 0'} ORDER BY m.created_at`)
        .all(r.id);
    const tagged = new Set(mediaRows(r.id, 'photo').filter((x) => !x.hidden).map((x) => x.rel_path));
    const fromFaces = await personPaths(r.person_id);
    const photos = await photosOut(await relativePhotoPaths(r));
    const pathOf = await photoPathsById();
    const lib = await listLibrary().catch(() => ({ movies: [] }));
    const movieRows = mediaRows(r.id, 'movie').filter((x) => !x.hidden);
    const movies = movieRows
        .map((x) => lib.movies.find((m) => m.rel_path === x.rel_path))
        .filter(Boolean)
        .map((m) => ({ id: m.id, title: m.title, year: m.year, recorded_at: m.recorded_at }));
    const coverId = r.cover_path ? photos.find((p) => pathOf.get(p.id) === r.cover_path)?.id ?? null : null;
    res.json({
        ...summary(r),
        // 📷 the picked default picture (null: none picked, or it isn't one of theirs any more)
        cover_photo_id: coverId,
        memories,
        photos: photos.map((p) => {
            const rel = pathOf.get(p.id) ?? '';
            return { ...p, from_face: fromFaces.has(rel), tagged: tagged.has(rel) };
        }),
        movies,
    });
}));
// ---- add / edit (parents, a kid a parent lets, or someone on their own entry) ----
/** Who may change relatives: 'parent' (everything), 'helper' (a kid with can_edit_relatives: add
 *  and edit anyone), 'self' (their own linked entry), or null. */
function editorOf(req, r) {
    const acting = req.body?.acting_member_id;
    if (isParentRequest(req, acting))
        return 'parent';
    const actor = sessionActor(req, acting);
    if (!actor)
        return null;
    if (db.prepare('SELECT 1 FROM family_members WHERE id = ? AND can_edit_relatives = 1').get(actor))
        return 'helper';
    return r && r.family_member_id === actor ? 'self' : null;
}
function clean(b, id) {
    const out = {};
    const text = (k, max) => {
        if (b[k] === undefined)
            return;
        const v = b[k] === null ? '' : String(b[k]).trim().slice(0, max);
        out[k] = v || null;
    };
    if (b.name !== undefined) {
        const n = String(b.name ?? '').trim().slice(0, 100);
        if (!n)
            return 'Their name, please';
        out.name = n;
    }
    text('nickname', 60);
    text('relation', 100);
    text('birth_place', 120);
    text('death_place', 120);
    text('about', 20000);
    for (const k of ['birth_date', 'death_date']) {
        if (b[k] === undefined)
            continue;
        const v = b[k] ? String(b[k]).trim() : '';
        if (v && !DATE.test(v))
            return 'Dates look like 1950-04-21 (0000-04-21 if you don’t know the year)';
        out[k] = v || null;
    }
    if (b.person_id !== undefined) {
        const v = b.person_id || null;
        if (v && !db.prepare('SELECT 1 FROM people WHERE id = ?').get(v))
            return 'That face-recognition person wasn’t found';
        out.person_id = v;
    }
    if (b.family_member_id !== undefined) {
        const v = b.family_member_id || null;
        if (v && !db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(v))
            return 'That family member wasn’t found';
        const taken = v ? db.prepare('SELECT name FROM relatives WHERE family_member_id = ? AND id != ?').get(v, id ?? '') : undefined;
        if (taken)
            return `That profile is already linked to ${taken.name}`;
        out.family_member_id = v;
    }
    if (b.hidden !== undefined)
        out.hidden = b.hidden ? 1 : 0;
    return out;
}
/** POST / { name, … } (parents, or a kid a parent lets) */
relativesRouter.post('/', (req, res) => {
    const who = editorOf(req, null);
    if (!who)
        return res.status(403).json({ error: 'Only a parent (or a kid a parent lets) can add relatives' });
    // linking a household profile and hiding are for parents
    const body = who === 'parent' ? req.body : { ...req.body, family_member_id: undefined, hidden: undefined };
    const v = clean({ name: '', ...body }, null);
    if (typeof v === 'string')
        return res.status(400).json({ error: v });
    const id = uuidv4();
    const now = new Date().toISOString();
    const cols = Object.keys(v);
    db.prepare(`INSERT INTO relatives (id, ${cols.join(', ')}, created_at, updated_at, updated_by) VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?, ?)`).run(id, ...cols.map((c) => v[c]), now, now, sessionActor(req, req.body?.acting_member_id));
    res.status(201).json(summary(relOf(id)));
});
/** PUT /:id { …fields, hidden } — nothing is deleted; hidden (parents only) takes them off the list. */
relativesRouter.put('/:id', (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    const who = editorOf(req, r);
    if (!who)
        return res.status(403).json({ error: 'Only a parent can change this' });
    if (who !== 'parent' && req.body?.hidden !== undefined)
        return res.status(403).json({ error: 'Only a parent can hide or show a relative' });
    // linking a household profile is for parents (the form sends it along; it's just left as it is)
    const v = clean(who === 'parent' ? req.body ?? {} : { ...req.body, family_member_id: undefined }, r.id);
    if (typeof v === 'string')
        return res.status(400).json({ error: v });
    const cols = Object.keys(v);
    if (cols.length)
        db.prepare(`UPDATE relatives SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, updated_by = ? WHERE id = ?`).run(...cols.map((c) => v[c]), new Date().toISOString(), sessionActor(req, req.body?.acting_member_id), r.id);
    res.json(summary(relOf(r.id)));
});
// ---- 💬 memories (anyone) ----
relativesRouter.post('/:id/memories', (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    const text = String(req.body?.text ?? '').trim().slice(0, 10000);
    if (!text)
        return res.status(400).json({ error: 'Write the memory first' });
    const now = new Date().toISOString();
    const id = uuidv4();
    db.prepare('INSERT INTO relative_memories (id, relative_id, text, author_member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, r.id, text, sessionActor(req, req.body?.acting_member_id), now, now);
    res.status(201).json(db.prepare('SELECT * FROM relative_memories WHERE id = ?').get(id));
});
/** PUT /memories/:mid { text?, hidden? } — whoever wrote it, or a parent. */
relativesRouter.put('/memories/:mid', (req, res) => {
    const m = db.prepare('SELECT * FROM relative_memories WHERE id = ?').get(req.params.mid);
    if (!m)
        return res.status(404).json({ error: 'not found' });
    const actor = sessionActor(req, req.body?.acting_member_id);
    if (!isParentRequest(req, req.body?.acting_member_id) && (!actor || actor !== m.author_member_id))
        return res.status(403).json({ error: 'Only whoever wrote it, or a parent' });
    const now = new Date().toISOString();
    if (req.body?.text !== undefined) {
        const text = String(req.body.text).trim().slice(0, 10000);
        if (!text)
            return res.status(400).json({ error: 'It can’t be empty (hide it instead)' });
        db.prepare('UPDATE relative_memories SET text = ?, updated_at = ? WHERE id = ?').run(text, now, m.id);
    }
    if (req.body?.hidden !== undefined)
        db.prepare('UPDATE relative_memories SET hidden = ?, updated_at = ? WHERE id = ?').run(req.body.hidden ? 1 : 0, now, m.id);
    res.json(db.prepare('SELECT * FROM relative_memories WHERE id = ?').get(m.id));
});
// ---- 🏷️ tagging photos and movies (anyone) ----
function setMedia(relativeId, kind, paths, hidden, by) {
    const now = new Date().toISOString();
    const up = db.prepare(`INSERT INTO relative_media (relative_id, kind, rel_path, added_by, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(relative_id, kind, rel_path) DO UPDATE SET hidden = excluded.hidden`);
    db.transaction(() => paths.forEach((p) => up.run(relativeId, kind, p, by, hidden, now)))();
}
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 2000) : []);
/** POST /:id/photos { add?: photo ids, remove?: photo ids } — remove also takes off a face-recognition photo, for this relative only. */
relativesRouter.post('/:id/photos', asyncHandler(async (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    const pathOf = await photoPathsById();
    const toPaths = (v) => ids(v).map((i) => pathOf.get(i)).filter((p) => Boolean(p));
    const by = sessionActor(req, req.body?.acting_member_id);
    setMedia(r.id, 'photo', toPaths(req.body?.add), 0, by);
    setMedia(r.id, 'photo', toPaths(req.body?.remove), 1, by);
    res.json({ ok: true });
}));
/** PUT /:id/cover { photo_id | null, acting_member_id } (whoever may edit them) — their default picture, one of
 *  the photos on their page; null goes back to the usual one. The photo itself isn't touched. */
relativesRouter.put('/:id/cover', asyncHandler(async (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    if (!editorOf(req, r))
        return res.status(403).json({ error: 'Only a parent can change this' });
    let cover = null;
    if (req.body?.photo_id) {
        const p = (await photoPathsById()).get(String(req.body.photo_id));
        if (!p || !(await relativePhotoPaths(r)).has(p))
            return res.status(400).json({ error: 'Pick one of the photos on their page' });
        cover = p;
    }
    db.prepare('UPDATE relatives SET cover_path = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(cover, new Date().toISOString(), sessionActor(req, req.body?.acting_member_id), r.id);
    res.json({ ok: true, cover_path: cover });
}));
/** POST /:id/movies { add?: movie ids, remove?: movie ids } — home movies from 🎬 Movies. */
relativesRouter.post('/:id/movies', asyncHandler(async (req, res) => {
    const r = relOf(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'not found' });
    const { movies } = await listLibrary();
    const toPaths = (v) => ids(v).map((i) => movies.find((m) => m.id === i)?.rel_path).filter((p) => Boolean(p));
    const by = sessionActor(req, req.body?.acting_member_id);
    setMedia(r.id, 'movie', toPaths(req.body?.add), 0, by);
    setMedia(r.id, 'movie', toPaths(req.body?.remove), 1, by);
    res.json({ ok: true });
}));
