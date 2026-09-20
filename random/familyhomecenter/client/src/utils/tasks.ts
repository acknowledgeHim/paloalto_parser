import type { Task } from '../api/client.js';

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
