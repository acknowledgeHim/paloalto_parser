import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { todayStr } from '../utils/recurrence.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import { addWeeklyReportSection } from '../services/weeklyReport.js';

/**
 * Family life: 📔 journal & 🫙 gratitude jar, 📏 height chart, 📝 sticky notes, and 🏠 who's home.
 * Nothing here is ever deleted — taking something down just hides it (hidden_at / done_at).
 */

/** A drawing or photo as a data URL, kept to a sensible size. */
function picture(raw: unknown, maxBytes: number): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('data:image/')) return null;
  if (raw.length > maxBytes) throw new Error('That picture is too big');
  return raw;
}
const str = (v: unknown, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

// ---- 📔 Journal & 🫙 gratitude jar ----

export const journalRouter = Router();

interface Entry {
  id: string;
  family_member_id: string;
  kind: 'journal' | 'gratitude';
  date: string;
  text: string | null;
  mood: string | null;
  drawing: string | null;
  created_at: string;
  hidden_at: string | null;
}

/** GET /?family_member_id=&acting_member_id= — their journal (just them and parents). */
journalRouter.get('/', (req, res) => {
  const memberId = String(req.query.family_member_id ?? '');
  if (!isSelfOrParent(req, memberId, req.query.acting_member_id)) return res.status(403).json({ error: 'A journal is just for its writer (and parents)' });
  res.json(
    db
      .prepare(`SELECT * FROM journal_entries WHERE family_member_id = ? AND kind = 'journal' AND hidden_at IS NULL ORDER BY date DESC, created_at DESC LIMIT 300`)
      .all(memberId)
  );
});

/** GET /jar — everyone's gratitude notes. */
journalRouter.get('/jar', (_req, res) => {
  res.json(
    db.prepare(`SELECT * FROM journal_entries WHERE kind = 'gratitude' AND hidden_at IS NULL ORDER BY created_at DESC LIMIT 400`).all()
  );
});

/** GET /on-this-day?family_member_id=&acting_member_id= — the same day in years before: the jar,
 *  plus their own journal when it's them (or a parent). */
journalRouter.get('/on-this-day', (req, res) => {
  const today = todayStr();
  const memberId = String(req.query.family_member_id ?? '');
  const mine = memberId && isSelfOrParent(req, memberId, req.query.acting_member_id);
  const rows = db
    .prepare(
      `SELECT * FROM journal_entries WHERE hidden_at IS NULL AND substr(date, 6) = ? AND date < ?
       AND (kind = 'gratitude' OR (kind = 'journal' AND family_member_id = ?)) ORDER BY date DESC`
    )
    .all(today.slice(5), today.slice(0, 4), mine ? memberId : '') as Entry[];
  res.json(rows);
});

/** POST / { family_member_id, kind, text, mood, drawing, acting_member_id } */
journalRouter.post('/', (req, res) => {
  const { family_member_id, kind, text, mood, drawing, acting_member_id } = req.body ?? {};
  if (!family_member_id) return res.status(400).json({ error: 'Pick who you are up top first' });
  if (!isSelfOrParent(req, family_member_id, acting_member_id)) return res.status(403).json({ error: 'Write in your own journal' });
  let pic: string | null;
  try {
    pic = picture(drawing, 1_500_000);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  const entry: Entry = {
    id: uuidv4(),
    family_member_id,
    kind: kind === 'gratitude' ? 'gratitude' : 'journal',
    date: todayStr(),
    text: str(text, 5000),
    mood: str(mood, 16),
    drawing: pic,
    created_at: new Date().toISOString(),
    hidden_at: null,
  };
  if (!entry.text && !entry.drawing) return res.status(400).json({ error: 'Write or draw something first' });
  db.prepare(
    `INSERT INTO journal_entries (id, family_member_id, kind, date, text, mood, drawing, created_at)
     VALUES (@id, @family_member_id, @kind, @date, @text, @mood, @drawing, @created_at)`
  ).run(entry);
  res.status(201).json(entry);
});

/** POST /:id/hide { acting_member_id } — the writer or a parent takes it off the page (kept). */
journalRouter.post('/:id/hide', (req, res) => {
  const e = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id) as Entry | undefined;
  if (!e) return res.status(404).json({ error: 'not found' });
  if (!isSelfOrParent(req, e.family_member_id, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only the writer or a parent can' });
  db.prepare('UPDATE journal_entries SET hidden_at = ? WHERE id = ?').run(new Date().toISOString(), e.id);
  res.json({ ok: true });
});

// ---- 📏 Height chart ----

export const heightsRouter = Router();

/** GET / — everyone's measurements, oldest first (photos fetched one at a time). */
heightsRouter.get('/', (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT id, family_member_id, date, inches, note, created_at, photo IS NOT NULL AS has_photo FROM heights
         WHERE hidden_at IS NULL ORDER BY date ASC, created_at ASC`
      )
      .all()
  );
});

heightsRouter.get('/:id/photo', (req, res) => {
  const row = db.prepare('SELECT photo FROM heights WHERE id = ?').get(req.params.id) as { photo: string | null } | undefined;
  const m = row?.photo?.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
  if (!m) return res.status(404).end();
  res.type(m[1]).set('Cache-Control', 'private, max-age=86400').send(Buffer.from(m[2], 'base64'));
});

/** POST / { family_member_id, date, inches, note, photo, acting_member_id } */
heightsRouter.post('/', (req, res) => {
  const { family_member_id, date, inches, note, photo, acting_member_id } = req.body ?? {};
  if (!family_member_id) return res.status(400).json({ error: 'Whose height?' });
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can add a measurement' });
  const n = Number(inches);
  if (!(n > 10 && n < 100)) return res.status(400).json({ error: 'How tall? (in inches, e.g. 48½)' });
  let pic: string | null;
  try {
    pic = picture(photo, 3_000_000);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  const row = {
    id: uuidv4(),
    family_member_id,
    date: typeof date === 'string' && /^\d{4}-\d\d-\d\d$/.test(date) ? date : todayStr(),
    inches: Math.round(n * 100) / 100,
    note: str(note, 300),
    photo: pic,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO heights (id, family_member_id, date, inches, note, photo, created_at) VALUES (@id, @family_member_id, @date, @inches, @note, @photo, @created_at)`
  ).run(row);
  res.status(201).json({ ...row, photo: undefined, has_photo: pic ? 1 : 0 });
});

/**
 * PUT /:id { date, inches, note, photo?, acting_member_id } — a parent fixes a measurement. Nothing is
 * overwritten: the old one is hidden and a corrected copy (keeping its photo unless a new one is given)
 * takes its place.
 */
heightsRouter.put('/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM heights WHERE id = ? AND hidden_at IS NULL').get(req.params.id) as
    | { family_member_id: string; date: string; inches: number; note: string | null; photo: string | null }
    | undefined;
  if (!old) return res.status(404).json({ error: 'not found' });
  const { date, inches, note, photo, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can change a measurement' });
  const n = inches === undefined ? old.inches : Number(inches);
  if (!(n > 10 && n < 100)) return res.status(400).json({ error: 'How tall? (in inches, e.g. 48½)' });
  let pic: string | null = old.photo;
  if (photo) {
    try {
      pic = picture(photo, 3_000_000);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  }
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    family_member_id: old.family_member_id,
    date: typeof date === 'string' && /^\d{4}-\d\d-\d\d$/.test(date) ? date : old.date,
    inches: Math.round(n * 100) / 100,
    note: note === undefined ? old.note : str(note, 300),
    photo: pic,
    created_at: now,
  };
  db.transaction(() => {
    db.prepare('UPDATE heights SET hidden_at = ? WHERE id = ?').run(now, req.params.id);
    db.prepare(
      `INSERT INTO heights (id, family_member_id, date, inches, note, photo, created_at) VALUES (@id, @family_member_id, @date, @inches, @note, @photo, @created_at)`
    ).run(row);
  })();
  res.json({ ...row, photo: undefined, has_photo: pic ? 1 : 0 });
});

heightsRouter.post('/:id/hide', (req, res) => {
  const h = db.prepare('SELECT family_member_id FROM heights WHERE id = ?').get(req.params.id) as { family_member_id: string } | undefined;
  if (!h) return res.status(404).json({ error: 'not found' });
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can take one off' });
  db.prepare('UPDATE heights SET hidden_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

// ---- 📝 Sticky notes ----

export const notesRouter = Router();

interface Note {
  id: string;
  text: string | null;
  drawing: string | null;
  color: string | null;
  author_id: string | null;
  for_member_id: string | null;
  created_at: string;
  done_at: string | null;
}

/** GET / — the notes up now, newest first. */
notesRouter.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM sticky_notes WHERE done_at IS NULL ORDER BY created_at DESC LIMIT 60').all());
});

/** POST / { text, drawing, color, author_id, for_member_id } — anyone can put one up. */
notesRouter.post('/', (req, res) => {
  const { text, drawing, color, author_id, for_member_id } = req.body ?? {};
  let pic: string | null;
  try {
    pic = picture(drawing, 800_000);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  const note: Note = {
    id: uuidv4(),
    text: str(text, 500),
    drawing: pic,
    color: str(color, 20),
    author_id: str(author_id, 64),
    for_member_id: str(for_member_id, 64),
    created_at: new Date().toISOString(),
    done_at: null,
  };
  if (!note.text && !note.drawing) return res.status(400).json({ error: 'Write or draw something' });
  db.prepare(
    `INSERT INTO sticky_notes (id, text, drawing, color, author_id, for_member_id, created_at) VALUES (@id, @text, @drawing, @color, @author_id, @for_member_id, @created_at)`
  ).run(note);
  res.status(201).json(note);
});

/** POST /:id/done { acting_member_id } — whoever wrote it, who it's for, or a parent takes it down. */
notesRouter.post('/:id/done', (req, res) => {
  const n = db.prepare('SELECT * FROM sticky_notes WHERE id = ?').get(req.params.id) as Note | undefined;
  if (!n) return res.status(404).json({ error: 'not found' });
  const acting = req.body?.acting_member_id;
  const ok = isParentRequest(req, acting) || !n.author_id || [n.author_id, n.for_member_id].some((id) => id && isSelfOrParent(req, id, acting));
  if (!ok) return res.status(403).json({ error: 'Whoever wrote it (or a parent) can take it down' });
  db.prepare('UPDATE sticky_notes SET done_at = ? WHERE id = ?').run(new Date().toISOString(), n.id);
  res.json({ ok: true });
});

// ---- 🏠 Who's home ----

export const PRESENCE = ['home', 'school', 'work', 'practice', 'friend', 'out', 'away', 'sleeping'] as const;
export const presenceRouter = Router();

/** PUT /:id { presence, note, acting_member_id } — yourself, or a parent for anyone. */
presenceRouter.put('/:id', (req, res) => {
  const { presence, note, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, req.params.id, acting_member_id)) return res.status(403).json({ error: 'Set your own (a parent can set anyone’s)' });
  if (presence !== null && !PRESENCE.includes(presence)) return res.status(400).json({ error: 'Where are they?' });
  const { changes } = db
    .prepare('UPDATE family_members SET presence = ?, presence_note = ?, presence_at = ? WHERE id = ?')
    .run(presence, str(note, 80), new Date().toISOString(), req.params.id);
  if (!changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ---- In the 📬 weekly report ----

addWeeklyReportSection((member, start, end) => {
  const rows = db
    .prepare(`SELECT kind, text, mood FROM journal_entries WHERE family_member_id = ? AND date >= ? AND date <= ? AND hidden_at IS NULL`)
    .all(member.id, start, end) as Array<{ kind: string; text: string | null; mood: string | null }>;
  const journalDays = rows.filter((r) => r.kind === 'journal');
  const lines = [
    ...(journalDays.length ? [`Wrote in their journal ${journalDays.length}× ${journalDays.map((r) => r.mood ?? '').join('')}`.trim()] : []),
    ...rows.filter((r) => r.kind === 'gratitude' && r.text).map((r) => `🫙 Grateful for: ${r.text}`),
  ];
  return { heading: '📔 Journal & gratitude', lines };
});

const feetInches = (n: number) => `${Math.floor(n / 12)} ft ${Math.round((n % 12) * 2) / 2} in`;
addWeeklyReportSection((member, start, end) => {
  const rows = db
    .prepare('SELECT date, inches FROM heights WHERE family_member_id = ? AND hidden_at IS NULL ORDER BY date ASC')
    .all(member.id) as Array<{ date: string; inches: number }>;
  const now = rows.filter((r) => r.date >= start && r.date <= end).pop();
  if (!now) return null;
  const before = rows.filter((r) => r.date < start).pop();
  const grew = before ? now.inches - before.inches : 0;
  return { heading: '📏 Height', lines: [`${feetInches(now.inches)}${grew > 0 ? ` — grew ${Math.round(grew * 4) / 4} in since ${before!.date}` : ''}`] };
});
