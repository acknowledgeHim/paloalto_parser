export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  /** An emoji (e.g. "🦄"), the literal string "image" (a custom photo — see routes/familyMembers.ts's
   *  /:id/avatar-image), or null/empty for no avatar (falls back to a colored initial in the client). */
  avatar: string | null;
  is_parent: 0 | 1;
  /** Sound id (client/src/utils/sounds.ts preset list) to play when this person completes a task. */
  complete_sound: string | null;
  /** Prize Bank running totals — credited on completing a reward task, spent on star-cost prizes. */
  star_balance: number;
  money_balance: number;
  /** "<saltHex>:<hashHex>" (see services/auth.ts), or null for no login set. Never sent to the client. */
  password_hash: string | null;
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

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  notes: string | null;
  assignee_id: string | null;
  created_by_id: string | null;
  recurrence: Recurrence;
  due_date: string | null;
  /** Optional part of the day this chore belongs to; null means no particular time. */
  time_of_day: TimeOfDay | null;
  /** Prize Bank reward for completing this task; null reward_type means no reward. Set only via
   *  PATCH /:id/reward (requires the Settings password) — see routes/tasks.ts. */
  reward_type: 'stars' | 'money' | null;
  reward_amount: number | null;
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

export interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  sort_order: number;
}

export interface Recipe {
  id: string;
  title: string;
  source: 'local' | 'themealdb';
  source_id: string | null;
  instructions: string | null;
  thumbnail_url: string | null;
  /** Baseline serving count the ingredient quantities are written for (client scales from this). */
  servings: number;
  created_by_id: string | null;
  created_at: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface Meal {
  id: string;
  date: string;
  slot: MealSlot;
  /** Who this meal is for; null = the whole family. */
  assignee_id: string | null;
  title: string;
  notes: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface Prize {
  id: string;
  title: string;
  cost_type: 'stars' | 'task_count';
  /** Set when cost_type is 'stars': how many banked stars this prize costs. */
  star_cost: number | null;
  /** Set when cost_type is 'task_count': which task, and how many times it must be completed. */
  task_id: string | null;
  required_count: number | null;
  created_at: string;
}

export interface PrizeRedemption {
  id: string;
  prize_id: string;
  family_member_id: string;
  redeemed_at: string;
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
  /** Who this event is for (local events only — Google/Apple events aren't attributed to a family member). */
  for_member_id?: string | null;
  /** Who added this event (local events only). */
  created_by_id?: string | null;
}
