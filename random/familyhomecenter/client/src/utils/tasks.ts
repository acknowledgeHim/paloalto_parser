import type { FamilyMember, Task } from '../api/client.js';

const TIME_OF_DAY_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Chores read before to-dos, and within that, by time of day (morning/afternoon/evening, then
 *  unscheduled) — otherwise keep whatever order the API returned them in. */
export function sortForColumn(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'chore' ? -1 : 1;
    const aOrder = a.time_of_day ? TIME_OF_DAY_ORDER[a.time_of_day] : 3;
    const bOrder = b.time_of_day ? TIME_OF_DAY_ORDER[b.time_of_day] : 3;
    return aOrder - bOrder;
  });
}

/**
 * Household-trust-level rule, not a security boundary (matches how the rest of this app treats
 * identity — see requireAdmin's comments for the one place that IS server-enforced, Prize Bank
 * amounts): a parent can edit/delete any task; a kid can only edit/delete one they created
 * themselves. Enforced client-side only — most kids have no password, so the server has no way to
 * verify who's actually asking.
 */
export function canEditTask(task: Task, activeProfile: FamilyMember | null): boolean {
  if (!activeProfile) return false;
  if (activeProfile.is_parent === 1) return true;
  return activeProfile.id === task.created_by_id;
}
