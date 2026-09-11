export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  is_parent: 0 | 1;
  created_at: string;
}

export type TaskKind = 'chore' | 'todo';

/**
 * Recurrence rules, kept intentionally simple (no RRULE parser needed):
 *  - "once"                      one-off, done forever once completed
 *  - "daily"                     applies every day
 *  - "weekdays"                  Mon-Fri
 *  - "weekends"                  Sat-Sun
 *  - "weekly:MON,WED,FRI"        specific weekdays, 3-letter codes
 */
export type Recurrence = 'once' | 'daily' | 'weekdays' | 'weekends' | `weekly:${string}`;

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  notes: string | null;
  assignee_id: string | null;
  created_by_id: string | null;
  recurrence: Recurrence;
  due_date: string | null;
  active: 0 | 1;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_on: string;
  completed_by_id: string | null;
  completed_at: string;
}

export interface CalendarEvent {
  id: string;
  source: 'local' | 'google' | 'apple';
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
}
