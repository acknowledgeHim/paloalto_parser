import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { isParentRequest } from '../services/rewards.js';
import { todayStr } from '../utils/recurrence.js';

/**
 * 👩‍🍳 Who's cooking — a kid (or anyone) assigned to plan and make a meal, once ("Ben, dinner on
 * Fri Oct 24") or on a repeating schedule ("Ben, dinner every Tuesday & Thursday"). Anyone can see
 * it; only a parent sets or stops it. Nothing is deleted: stopping a schedule ends it (end_date),
 * stopping a one-off marks it stopped, so the history stays.
 */
export const mealCooksRouter = Router();

type Slot = 'breakfast' | 'lunch' | 'dinner';
const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

export interface CookRow {
  id: string;
  member_id: string | null;
  slot: Slot;
  date: string | null;
  weekdays: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  stopped_at: string | null;
  created_by_id: string | null;
  created_at: string;
}

const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s: string) => new Date(`${s}T12:00:00`);
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function liveRows(): CookRow[] {
  return db.prepare('SELECT * FROM meal_cooks WHERE stopped_at IS NULL ORDER BY created_at ASC').all() as CookRow[];
}

/** Who's cooking each meal from start to end (inclusive): one-offs for that day win over schedules. */
export function cooksBetween(start: string, end: string) {
  const rows = liveRows();
  const out: Array<{ date: string; slot: Slot; member_ids: string[]; rule_ids: string[]; once: boolean }> = [];
  for (let d = parseDay(start); dayStr(d) <= end; d.setDate(d.getDate() + 1)) {
    const date = dayStr(d);
    for (const slot of SLOTS) {
      const once = rows.filter((r) => r.date === date && r.slot === slot);
      const every = rows.filter(
        (r) =>
          !r.date &&
          r.slot === slot &&
          (r.weekdays ?? '').split(',').includes(String(d.getDay())) &&
          (!r.start_date || r.start_date <= date) &&
          (!r.end_date || date <= r.end_date)
      );
      const used = once.length ? once : every;
      const ids = [...new Set(used.map((r) => r.member_id).filter((x): x is string => Boolean(x)))];
      if (used.length) out.push({ date, slot, member_ids: ids, rule_ids: used.map((r) => r.id), once: once.length > 0 });
    }
  }
  return out;
}

/** GET /?start&end — who's cooking which meal each day (default: the next 14 days). */
mealCooksRouter.get('/', (req, res) => {
  const start = isDay(req.query.start) ? req.query.start : todayStr();
  const endDefault = parseDay(start);
  endDefault.setDate(endDefault.getDate() + 13);
  let end = isDay(req.query.end) ? req.query.end : dayStr(endDefault);
  // At most ~3 months at a time.
  const max = parseDay(start);
  max.setDate(max.getDate() + 92);
  if (end > dayStr(max)) end = dayStr(max);
  res.json(cooksBetween(start, end));
});

/** GET /rules — the schedules still running and the one-offs still to come. */
mealCooksRouter.get('/rules', (_req, res) => {
  const today = todayStr();
  res.json(liveRows().filter((r) => (r.date ? r.date >= today : !r.end_date || r.end_date >= today)));
});

/** POST /rules { member_id, slot, date } (once) or { member_id, slot, weekdays: [2,4], start_date?, end_date? }
 *  (repeating), + acting_member_id. member_id null with a date = nobody cooks that day (skips the schedule). */
mealCooksRouter.post('/rules', (req, res) => {
  const b = req.body as {
    member_id?: string | null;
    slot?: string;
    date?: string;
    weekdays?: number[];
    start_date?: string;
    end_date?: string;
    note?: string;
    acting_member_id?: string;
  };
  if (!isParentRequest(req, b.acting_member_id)) return res.status(403).json({ error: 'Only a parent can set who cooks' });
  if (!SLOTS.includes(b.slot as Slot)) return res.status(400).json({ error: 'slot must be breakfast, lunch, or dinner' });
  const member = b.member_id ? (db.prepare('SELECT id FROM family_members WHERE id = ?').get(b.member_id) as { id: string } | undefined) : null;
  if (b.member_id && !member) return res.status(400).json({ error: 'Unknown family member' });
  const days = Array.isArray(b.weekdays) ? [...new Set(b.weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [];
  if (b.date) {
    if (!isDay(b.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  } else {
    if (!member) return res.status(400).json({ error: 'Pick who is cooking' });
    if (days.length === 0) return res.status(400).json({ error: 'Pick at least one day of the week' });
    if (b.start_date && !isDay(b.start_date)) return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' });
    if (b.end_date && !isDay(b.end_date)) return res.status(400).json({ error: 'end_date must be YYYY-MM-DD' });
  }
  const row: CookRow = {
    id: uuidv4(),
    member_id: member?.id ?? null,
    slot: b.slot as Slot,
    date: b.date ?? null,
    weekdays: b.date ? null : days.join(','),
    start_date: b.date ? null : b.start_date || todayStr(),
    end_date: b.date ? null : b.end_date || null,
    note: b.note?.trim() || null,
    stopped_at: null,
    created_by_id: typeof b.acting_member_id === 'string' && b.acting_member_id ? b.acting_member_id : null,
    created_at: new Date().toISOString(),
  };
  db.transaction(() => {
    // A new one-off for the same meal replaces the earlier one (kept, marked stopped).
    if (row.date) db.prepare('UPDATE meal_cooks SET stopped_at = ? WHERE date = ? AND slot = ? AND stopped_at IS NULL').run(row.created_at, row.date, row.slot);
    db.prepare(
      `INSERT INTO meal_cooks (id, member_id, slot, date, weekdays, start_date, end_date, note, stopped_at, created_by_id, created_at)
       VALUES (@id, @member_id, @slot, @date, @weekdays, @start_date, @end_date, @note, @stopped_at, @created_by_id, @created_at)`
    ).run(row);
  })();
  res.status(201).json(row);
});

/** POST /rules/:id/stop { acting_member_id } — a schedule ends today (past days keep their cook);
 *  a one-off is called off. Kept either way. */
mealCooksRouter.post('/rules/:id/stop', (req, res) => {
  const b = req.body as { acting_member_id?: string };
  if (!isParentRequest(req, b.acting_member_id)) return res.status(403).json({ error: 'Only a parent can change who cooks' });
  const row = db.prepare('SELECT * FROM meal_cooks WHERE id = ?').get(req.params.id) as CookRow | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.date) {
    db.prepare('UPDATE meal_cooks SET stopped_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  } else {
    const y = parseDay(todayStr());
    y.setDate(y.getDate() - 1);
    // Never ends before it started — a schedule that hadn't begun yet is simply called off.
    if (row.start_date && row.start_date > dayStr(y)) db.prepare('UPDATE meal_cooks SET stopped_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    else db.prepare('UPDATE meal_cooks SET end_date = ? WHERE id = ?').run(dayStr(y), row.id);
  }
  res.json({ ok: true });
});
