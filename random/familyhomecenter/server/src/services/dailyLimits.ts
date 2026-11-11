import { db, getSetting } from '../db.js';
import { GAMES } from './games.js';

/**
 * ⏰ Daily limits: a parent sets, per kid and per activity, how many times a day (rounds, lessons,
 * runs) and/or how many minutes a day. Something already started always gets finished — only
 * starting the next one is stopped. Parents have no limits.
 *
 * Times are counted when something starts (picking a saved round back up doesn't count again;
 * typing counts finished rounds). Minutes come from the screen ticking while it's being used
 * (POST /api/limits/beat), so a tab left open in the background doesn't use them up.
 */
export interface Activity {
  id: string;
  name: string;
  /** what one "time" is called: round, lesson, run */
  unit: string;
  /** only a minutes-a-day limit makes sense (no rounds to count) */
  minutes_only?: boolean;
}

export function activities(): Activity[] {
  return [
    { id: 'spelling', name: '🔤 Spelling', unit: 'round' },
    { id: 'spellcheck', name: '🔍 Spot the misspellings', unit: 'round' },
    { id: 'grammar', name: '📝 Grammar', unit: 'round' },
    { id: 'math', name: '➗ Math', unit: 'round' },
    { id: 'lessons-grammar', name: '📖 Grammar lessons', unit: 'lesson' },
    { id: 'lessons-math', name: '📖 Math lessons', unit: 'lesson' },
    { id: 'lessons-history', name: '🇺🇸 US History', unit: 'lesson' },
    { id: 'lessons-science', name: '🔬 Science', unit: 'lesson' },
    { id: 'typing', name: '⌨️ Typing', unit: 'round' },
    ...GAMES.map((g) => ({ id: `game:${g.id}`, name: `${g.emoji} ${g.name}`, unit: 'game', ...(g.minutesOnly ? { minutes_only: true } : {}) })),
  ];
}
export const activityOf = (id: string) => activities().find((a) => a.id === id);

export interface Limit {
  /** times a day (null = no limit) */
  times: number | null;
  /** minutes a day (null = no limit) */
  minutes: number | null;
}
type AllLimits = Record<string, Record<string, Limit>>;

const SETTING = 'daily_limits';

export function readLimits(): AllLimits {
  try {
    const v = JSON.parse(getSetting(SETTING) ?? '{}');
    return v && typeof v === 'object' ? (v as AllLimits) : {};
  } catch {
    return {};
  }
}

const num = (v: unknown, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : null;
};

/** A kid's limits from a parent's form: only known activities, whole numbers, blanks dropped. */
export function cleanLimits(raw: unknown): Record<string, Limit> {
  const out: Record<string, Limit> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const a of activities()) {
    const x = (raw as Record<string, Partial<Limit>>)[a.id];
    if (!x) continue;
    const l = { times: a.minutes_only ? null : num(x.times, 100), minutes: num(x.minutes, 24 * 60) };
    if (l.times !== null || l.minutes !== null) out[a.id] = l;
  }
  return out;
}

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const isParent = (memberId: string) => Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ? AND is_parent = 1').get(memberId));

export function usage(memberId: string, activity: string, day = localDay()): { times: number; seconds: number } {
  const r = db.prepare('SELECT times, seconds FROM activity_usage WHERE family_member_id = ? AND activity = ? AND day = ?').get(memberId, activity, day) as
    | { times: number; seconds: number }
    | undefined;
  return r ?? { times: 0, seconds: 0 };
}

export interface Status {
  id: string;
  name: string;
  unit: string;
  times: number | null;
  minutes: number | null;
  used_times: number;
  used_minutes: number;
  /** why the next one can't start today (null = it can) */
  over: string | null;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function status(memberId: string, activity: string): Status | null {
  const a = activityOf(activity);
  if (!a) return null;
  const saved = isParent(memberId) ? undefined : readLimits()[memberId]?.[activity];
  // Minutes-only activities never count times (whatever might be saved).
  const l = saved && a.minutes_only ? { ...saved, times: null } : saved;
  const u = usage(memberId, activity);
  const usedMin = Math.floor(u.seconds / 60);
  let over: string | null = null;
  if (l?.times !== null && l?.times !== undefined && u.times >= l.times)
    over = l.times === 0 ? `⏰ ${a.name} is off today — ask a parent` : `⏰ That's ${plural(l.times, a.unit)} of ${a.name} today — the limit. Come back tomorrow!`;
  else if (l?.minutes !== null && l?.minutes !== undefined && usedMin >= l.minutes)
    over = l.minutes === 0 ? `⏰ ${a.name} is off today — ask a parent` : `⏰ That's ${plural(l.minutes, 'minute')} of ${a.name} today — the limit. Come back tomorrow!`;
  return { id: a.id, name: a.name, unit: a.unit, times: l?.times ?? null, minutes: l?.minutes ?? null, used_times: u.times, used_minutes: usedMin, over };
}

/** Why they can't start one now (null = they can). */
export const limitHit = (memberId: string, activity: string): string | null => status(memberId, activity)?.over ?? null;

/** Count one more time today. */
export function countTime(memberId: string, activity: string) {
  db.prepare(
    `INSERT INTO activity_usage (family_member_id, activity, day, times, seconds) VALUES (?, ?, ?, 1, 0)
     ON CONFLICT(family_member_id, activity, day) DO UPDATE SET times = times + 1`
  ).run(memberId, activity, localDay());
}

/** Starting one: the limit message if they're at it, otherwise counted and null. */
export function tryStart(memberId: string, activity: string): string | null {
  const why = limitHit(memberId, activity);
  if (why) return why;
  countTime(memberId, activity);
  return null;
}

/** Time being used: at most one tick's worth (30 s) per ~25 s, however often the screen sends. */
export function addTime(memberId: string, activity: string, seconds: number) {
  const day = localDay();
  const now = Date.now();
  const r = db.prepare('SELECT last_beat_at FROM activity_usage WHERE family_member_id = ? AND activity = ? AND day = ?').get(memberId, activity, day) as
    | { last_beat_at: string | null }
    | undefined;
  if (r?.last_beat_at && now - Date.parse(r.last_beat_at) < 25_000) return;
  const s = Math.max(0, Math.min(30, Math.round(seconds)));
  db.prepare(
    `INSERT INTO activity_usage (family_member_id, activity, day, times, seconds, last_beat_at) VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(family_member_id, activity, day) DO UPDATE SET seconds = seconds + excluded.seconds, last_beat_at = excluded.last_beat_at`
  ).run(memberId, activity, day, s, new Date(now).toISOString());
}
