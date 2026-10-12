import type { FamilyMember, Task } from '../api/client.js';
import { parseTimeOfDaySlots } from './timeOfDay.js';

const TIME_OF_DAY_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Chores read before to-dos, and within that, by (earliest) time of day, then unscheduled —
 *  otherwise keep whatever order the API returned them in. With `memberId`, that person's own
 *  routine order (🔢 Order on Chores & Tasks) comes first; jobs they haven't ordered follow. */
export function sortForColumn(tasks: Task[], memberId?: string): Task[] {
  return [...tasks].sort((a, b) => {
    if (memberId) {
      const pa = a.positions?.[memberId];
      const pb = b.positions?.[memberId];
      if (pa != null || pb != null) {
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa !== pb) return pa - pb;
      }
    }
    if (a.kind !== b.kind) return a.kind === 'chore' ? -1 : 1;
    const aSlots = parseTimeOfDaySlots(a.time_of_day);
    const bSlots = parseTimeOfDaySlots(b.time_of_day);
    const aOrder = aSlots.length ? Math.min(...aSlots.map((s) => TIME_OF_DAY_ORDER[s])) : 3;
    const bOrder = bSlots.length ? Math.min(...bSlots.map((s) => TIME_OF_DAY_ORDER[s])) : 3;
    return aOrder - bOrder;
  });
}

/**
 * Household-trust-level rule, not a security boundary (matches how the rest of this app treats
 * identity — see requireAdmin's comments for the one place that IS server-enforced, Prize Bank
 * amounts): a parent can edit/delete any task; a kid can edit/delete one they created themselves,
 * or one assigned to them (even if a parent created it). Enforced client-side only — most kids
 * have no password, so the server has no way to verify who's actually asking.
 */
export function canEditTask(task: Task, activeProfile: FamilyMember | null): boolean {
  if (!activeProfile) return false;
  if (activeProfile.is_parent === 1) return true;
  return activeProfile.id === task.created_by_id || task.assignee_ids.includes(activeProfile.id);
}

/**
 * Editing permission for a historical entry surfaced from the Trends/Late-completions day
 * drill-down (PersonPage's DayDetailModal) — deliberately stricter than canEditTask's general
 * "assigned to you or created by you" rule: fixing a chore's own recurrence/timing record needs a
 * parent's say-so, but a kid can still correct their own to-do (e.g. picked the wrong
 * time-of-day) without one. pageOwnerId is whose person page this drill-down is on, not
 * necessarily every assignee of a shared task.
 */
export function canEditHistoricalTask(task: Task, pageOwnerId: string, activeProfile: FamilyMember | null): boolean {
  if (!activeProfile) return false;
  if (activeProfile.is_parent === 1) return true;
  if (task.kind === 'chore') return false;
  return activeProfile.id === pageOwnerId;
}

/** Its number in this person's routine as they'll see it today (1, 2, … among `list`), or null if
 *  they haven't put it in order. `list` = their jobs, already sorted with sortForColumn(…, memberId). */
export function routineNumber(task: Task, list: Task[], memberId: string): number | null {
  if (task.positions?.[memberId] == null) return null;
  return list.filter((t) => t.positions?.[memberId] != null).indexOf(task) + 1 || null;
}

/** Fully done for this person — every slot completed if it has more than one, else the one checkbox. */
export function isTaskDoneFor(task: Task, memberId: string): boolean {
  const slots = parseTimeOfDaySlots(task.time_of_day);
  if (slots.length > 1) {
    return slots.every((slot) => task.completions.some((c) => c.completed_by_id === memberId && c.time_of_day === slot));
  }
  return task.completions.some((c) => c.completed_by_id === memberId);
}

/** Done for today by everyone it's on — each assignee's copy, or (unassigned) anyone's. */
export function isTaskDoneByAll(task: Task): boolean {
  if (task.assignee_ids.length > 0) return task.assignee_ids.every((id) => isTaskDoneFor(task, id));
  const slots = parseTimeOfDaySlots(task.time_of_day);
  if (slots.length > 1) return slots.every((slot) => task.completions.some((c) => c.time_of_day === slot));
  return task.completions.length > 0;
}
