import type { Recurrence, Task } from '../types.js';

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/** Does this task apply on the given date (YYYY-MM-DD, local time)? */
export function taskAppliesOn(task: Pick<Task, 'recurrence' | 'due_date'>, dateStr: string): boolean {
  const recurrence = task.recurrence as Recurrence;
  const date = new Date(`${dateStr}T00:00:00`);
  const code = DAY_CODES[date.getDay()];

  if (recurrence === 'once') {
    return !task.due_date || task.due_date === dateStr;
  }
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return !['SAT', 'SUN'].includes(code);
  if (recurrence === 'weekends') return code === 'SAT' || code === 'SUN';
  if (recurrence.startsWith('weekly:')) {
    const days = recurrence.slice('weekly:'.length).split(',').map((d) => d.trim().toUpperCase());
    return days.includes(code);
  }
  return false;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
