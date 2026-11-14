import { db, getSetting } from '../db.js';
import { GAMES } from './games.js';
export function activities() {
    return [
        { id: 'spelling', name: '🔤 Spelling', unit: 'round' },
        { id: 'spellcheck', name: '🔍 Spot the misspellings', unit: 'round' },
        { id: 'grammar', name: '📝 Grammar', unit: 'round' },
        { id: 'math', name: '➗ Math', unit: 'round' },
        { id: 'lessons-grammar', name: '📖 Grammar lessons', unit: 'lesson' },
        { id: 'lessons-math', name: '📖 Math lessons', unit: 'lesson' },
        { id: 'lessons-history', name: '🇺🇸 US History', unit: 'lesson' },
        { id: 'lessons-science', name: '🔬 Science', unit: 'lesson' },
        { id: 'lessons-handson', name: '🔧 Hands-on', unit: 'lesson' },
        { id: 'typing', name: '⌨️ Typing', unit: 'round' },
        ...GAMES.map((g) => ({ id: `game:${g.id}`, name: `${g.emoji} ${g.name}`, unit: 'game', ...(g.minutesOnly ? { minutes_only: true } : {}) })),
    ];
}
export const activityOf = (id) => activities().find((a) => a.id === id);
const SETTING = 'daily_limits';
export function readLimits() {
    try {
        const v = JSON.parse(getSetting(SETTING) ?? '{}');
        return v && typeof v === 'object' ? v : {};
    }
    catch {
        return {};
    }
}
const num = (v, max) => {
    if (v === null || v === undefined || v === '')
        return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : null;
};
/** A kid's limits from a parent's form: only known activities, whole numbers, blanks dropped. */
export function cleanLimits(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object')
        return out;
    for (const a of activities()) {
        const x = raw[a.id];
        if (!x)
            continue;
        const l = { times: a.minutes_only ? null : num(x.times, 100), minutes: num(x.minutes, 24 * 60) };
        if (l.times !== null || l.minutes !== null)
            out[a.id] = l;
    }
    return out;
}
export function localDay(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const isParent = (memberId) => Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ? AND is_parent = 1').get(memberId));
export function usage(memberId, activity, day = localDay()) {
    const r = db.prepare('SELECT times, seconds FROM activity_usage WHERE family_member_id = ? AND activity = ? AND day = ?').get(memberId, activity, day);
    return r ?? { times: 0, seconds: 0 };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function status(memberId, activity) {
    const a = activityOf(activity);
    if (!a)
        return null;
    const saved = isParent(memberId) ? undefined : readLimits()[memberId]?.[activity];
    // Minutes-only activities never count times (whatever might be saved).
    const l = saved && a.minutes_only ? { ...saved, times: null } : saved;
    const u = usage(memberId, activity);
    const usedMin = Math.floor(u.seconds / 60);
    let over = null;
    if (l?.times !== null && l?.times !== undefined && u.times >= l.times)
        over = l.times === 0 ? `⏰ ${a.name} is off today — ask a parent` : `⏰ That's ${plural(l.times, a.unit)} of ${a.name} today — the limit. Come back tomorrow!`;
    else if (l?.minutes !== null && l?.minutes !== undefined && usedMin >= l.minutes)
        over = l.minutes === 0 ? `⏰ ${a.name} is off today — ask a parent` : `⏰ That's ${plural(l.minutes, 'minute')} of ${a.name} today — the limit. Come back tomorrow!`;
    return { id: a.id, name: a.name, unit: a.unit, times: l?.times ?? null, minutes: l?.minutes ?? null, used_times: u.times, used_minutes: usedMin, over };
}
/** Why they can't start one now (null = they can). */
export const limitHit = (memberId, activity) => status(memberId, activity)?.over ?? null;
/** Count one more time today. */
export function countTime(memberId, activity) {
    db.prepare(`INSERT INTO activity_usage (family_member_id, activity, day, times, seconds) VALUES (?, ?, ?, 1, 0)
     ON CONFLICT(family_member_id, activity, day) DO UPDATE SET times = times + 1`).run(memberId, activity, localDay());
}
/** Starting one: the limit message if they're at it, otherwise counted and null. */
export function tryStart(memberId, activity) {
    const why = limitHit(memberId, activity);
    if (why)
        return why;
    countTime(memberId, activity);
    return null;
}
/** Time being used: at most one tick's worth (30 s) per ~25 s, however often the screen sends. */
export function addTime(memberId, activity, seconds) {
    const day = localDay();
    const now = Date.now();
    const r = db.prepare('SELECT last_beat_at FROM activity_usage WHERE family_member_id = ? AND activity = ? AND day = ?').get(memberId, activity, day);
    if (r?.last_beat_at && now - Date.parse(r.last_beat_at) < 25_000)
        return;
    const s = Math.max(0, Math.min(30, Math.round(seconds)));
    db.prepare(`INSERT INTO activity_usage (family_member_id, activity, day, times, seconds, last_beat_at) VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(family_member_id, activity, day) DO UPDATE SET seconds = seconds + excluded.seconds, last_beat_at = excluded.last_beat_at`).run(memberId, activity, day, s, new Date(now).toISOString());
}
