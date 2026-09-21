export type TimeOfDaySlot = 'morning' | 'afternoon' | 'evening';

/** cutoffHour is when a slot's window closes for the day (24 = midnight, i.e. never "passed"
 *  within the same day — a new day's date naturally gives it a fresh, unchecked instance). */
export const TIME_OF_DAY_OPTIONS: Array<{ value: TimeOfDaySlot; label: string; icon: string; cutoffHour: number }> = [
  { value: 'morning', label: 'Morning', icon: '🌅', cutoffHour: 12 },
  { value: 'afternoon', label: 'Afternoon', icon: '☀️', cutoffHour: 16 },
  { value: 'evening', label: 'Evening', icon: '🌙', cutoffHour: 24 },
];

const BY_VALUE = Object.fromEntries(TIME_OF_DAY_OPTIONS.map((o) => [o.value, o]));

export function timeOfDayIcon(slot: string): string {
  return BY_VALUE[slot]?.icon ?? '';
}

export function timeOfDayLabel(slot: string): string {
  return BY_VALUE[slot]?.label ?? slot;
}

/** Splits a task's time_of_day column ("morning,evening" or null) into its slots. */
export function parseTimeOfDaySlots(raw: string | null | undefined): TimeOfDaySlot[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean) as TimeOfDaySlot[];
}

/** Has this slot's window closed for today, based on the viewer's local clock? Informational only —
 *  doesn't block completing it late, just flags it. */
export function isSlotWindowPassed(slot: string): boolean {
  const cutoff = BY_VALUE[slot]?.cutoffHour;
  if (cutoff === undefined) return false;
  return new Date().getHours() >= cutoff;
}
