import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { isAdminGateActive, isRequestAdmin, sessionMemberId, SESSION_COOKIE_NAME } from './auth.js';
import type { Task } from '../types.js';

/** Does completing this pay anything? (money/stars need an amount; a custom reward needs its text) */
export function hasReward(task: Task | undefined): task is Task {
  if (!task?.reward_type) return false;
  return task.reward_type === 'custom' ? Boolean(task.reward_text) : Boolean(task.reward_amount);
}

/** Pays (sign 1) or takes back (sign -1) a task's reward: money or stars into the balance, or a
 *  custom reward ("Movie time") onto their earned list — taking back removes one not yet used. */
export function creditReward(memberId: string, task: Task, sign: 1 | -1) {
  if (task.reward_type === 'custom') {
    if (sign > 0) {
      db.prepare('INSERT INTO earned_rewards (id, family_member_id, task_id, text, emoji, earned_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(),
        memberId,
        task.id,
        task.reward_text,
        task.reward_emoji ?? null,
        new Date().toISOString()
      );
    } else {
      db.prepare(
        `DELETE FROM earned_rewards WHERE id = (SELECT id FROM earned_rewards WHERE family_member_id = ? AND task_id = ? AND used_at IS NULL
         ORDER BY earned_at DESC LIMIT 1)`
      ).run(memberId, task.id);
    }
    return;
  }
  const amount = (task.reward_amount ?? 0) * sign;
  if (task.reward_type === 'stars') {
    db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(Math.round(amount), memberId);
  } else if (task.reward_type === 'money') {
    db.prepare('UPDATE family_members SET money_balance = money_balance + ? WHERE id = ?').run(amount, memberId);
  }
}

/**
 * Is a parent doing this? Logged in as a parent (once passwords are set up) — or, before then, the
 * person picked up top (acting_member_id) is a parent, or nobody in the family is one yet.
 */
export function isParentRequest(req: Request, actingMemberId: unknown): boolean {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (isRequestAdmin(token)) return true;
  if (isAdminGateActive()) return false;
  const actor = sessionMemberId(token) ?? (typeof actingMemberId === 'string' ? actingMemberId : null);
  if (actor) return Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ? AND is_parent = 1').get(actor));
  return !db.prepare('SELECT 1 FROM family_members WHERE is_parent = 1 LIMIT 1').get();
}

/** Is this request from that person themselves (their login, or picked up top when there are no
 *  logins) or from a parent? For a kid spending their own stars. */
export function isSelfOrParent(req: Request, memberId: string, actingMemberId: unknown): boolean {
  if (isParentRequest(req, actingMemberId)) return true;
  const self = sessionMemberId(req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
  if (self) return self === memberId;
  return actingMemberId === memberId;
}

/** The completion rows a finished "times"/"hours" job gets: one per time-of-day slot (or one). */
export function goalSlots(task: Task): Array<string | null> {
  const slots = (task.time_of_day ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return slots.length > 1 ? slots : [null];
}

/**
 * Checks a job off for real for this person on `date` — the given slots (each once), clearing a
 * "when needed" chore, and paying its reward the first time. Used when a "times"/"hours" job reaches
 * its goal, and when a parent OKs a kid's check-off.
 */
export function recordCompletion(task: Task, memberId: string | null, date: string, slots: Array<string | null>): void {
  let added = false;
  for (const slot of slots) {
    const by = memberId === null ? 'completed_by_id IS NULL' : 'completed_by_id = ?';
    const at = slot === null ? 'time_of_day IS NULL' : 'time_of_day = ?';
    const exists = db
      .prepare(`SELECT 1 FROM task_completions WHERE task_id = ? AND completed_on = ? AND ${by} AND ${at}`)
      .get(task.id, date, ...(memberId === null ? [] : [memberId]), ...(slot === null ? [] : [slot]));
    if (exists) continue;
    db.prepare(
      'INSERT INTO task_completions (id, task_id, completed_on, completed_by_id, completed_at, time_of_day) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), task.id, date, memberId, new Date().toISOString(), slot);
    added = true;
  }
  if (task.recurrence === 'asneeded') db.prepare('UPDATE tasks SET needed_since = NULL WHERE id = ?').run(task.id);
  if (added && hasReward(task) && memberId) creditReward(memberId, task, 1);
}

/** A kid's check-off waiting for a parent's OK (once per person, day and slot). */
export function addPending(task: Task, memberId: string | null, date: string, slot: string | null): void {
  const by = memberId === null ? 'family_member_id IS NULL' : 'family_member_id = ?';
  const at = slot === null ? 'time_of_day IS NULL' : 'time_of_day = ?';
  const exists = db
    .prepare(`SELECT 1 FROM pending_completions WHERE task_id = ? AND completed_on = ? AND ${by} AND ${at}`)
    .get(task.id, date, ...(memberId === null ? [] : [memberId]), ...(slot === null ? [] : [slot]));
  if (exists) return;
  db.prepare('INSERT INTO pending_completions (id, task_id, family_member_id, completed_on, time_of_day, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(),
    task.id,
    memberId,
    date,
    slot,
    new Date().toISOString()
  );
}

/** Drops this person's waiting check-off(s) — on `date` (or, for a one-time job, any day up to it); one slot or all. */
export function removePending(task: Task, memberId: string | null, date: string, slot?: string | null): number {
  const by = memberId === null ? 'family_member_id IS NULL' : 'family_member_id = ?';
  const on = task.recurrence === 'once' ? 'completed_on <= ?' : 'completed_on = ?';
  const at = slot === undefined ? '1 = 1' : slot === null ? 'time_of_day IS NULL' : 'time_of_day = ?';
  return db
    .prepare(`DELETE FROM pending_completions WHERE task_id = ? AND ${by} AND ${on} AND ${at}`)
    .run(task.id, ...(memberId === null ? [] : [memberId]), date, ...(slot === undefined || slot === null ? [] : [slot])).changes;
}
