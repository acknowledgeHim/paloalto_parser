import type { FamilyMember, Task } from '../api/client.js';
import { parseTimeOfDaySlots } from './timeOfDay.js';

const TIME_OF_DAY_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Chores read before to-dos, and within that, by (earliest) time of day, then unscheduled —
 *  otherwise keep whatever order the API returned them in. */
export function sortForColumn(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
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

/** Fully done for this person — every slot completed if it has more than one, else the one checkbox. */
export function isTaskDoneFor(task: Task, memberId: string): boolean {
  const slots = parseTimeOfDaySlots(task.time_of_day);
  if (slots.length > 1) {
    return slots.every((slot) => task.completions.some((c) => c.completed_by_id === memberId && c.time_of_day === slot));
  }
  return task.completions.some((c) => c.completed_by_id === memberId);
}
