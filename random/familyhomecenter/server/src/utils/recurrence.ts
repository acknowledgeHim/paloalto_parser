import type { Recurrence, Task, TimeOfDay } from '../types.js';

/** Splits a task's time_of_day column ("morning,evening" or null) into its slots. */
export function timeOfDaySlots(raw: string | null): TimeOfDay[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean) as TimeOfDay[];
}

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

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
  // "monthly:<n>:<DAY>" — the nth occurrence of that weekday in the month (n = 1-4), or -1 for "last".
  if (recurrence.startsWith('monthly:')) {
    const [, nStr, day] = recurrence.split(':');
    const n = Number(nStr);
    if (code !== day) return false;
    if (n === -1) return date.getDate() + 7 > daysInMonth(date);
    return Math.ceil(date.getDate() / 7) === n;
  }
  // "biweekly:<anchorDate YYYY-MM-DD>:<DAY>" — that weekday, every other week counting from anchor.
  if (recurrence.startsWith('biweekly:')) {
    const [, anchorStr, day] = recurrence.split(':');
    if (code !== day) return false;
    const anchor = new Date(`${anchorStr}T00:00:00`);
    const diffDays = Math.round((date.getTime() - anchor.getTime()) / 86_400_000);
    const weeks = diffDays / 7;
    if (!Number.isInteger(weeks)) return false; // shouldn't happen — anchor and date are the same weekday
    return ((weeks % 2) + 2) % 2 === 0;
  }
  return false;
}

/** Formats a Date as YYYY-MM-DD in *local* time (per TZ in .env) — never use toISOString().slice(0, 10)
 *  for this: that gives the UTC date, which is already "tomorrow" during evening hours in any
 *  timezone behind UTC (true of every US timezone) — the cause of a real bug where a task completed
 *  in the evening showed as still-completed the *next* local day too, since both landed on the same
 *  (UTC-shifted) date string. en-CA locale formats as YYYY-MM-DD by convention. */
function toLocalDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

export function todayStr(): string {
  return toLocalDateStr(new Date());
}

/** dateStr (YYYY-MM-DD) shifted by `n` days (negative goes backward). */
export function addDays(dateStr: string, n: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + n);
  return toLocalDateStr(date);
}
