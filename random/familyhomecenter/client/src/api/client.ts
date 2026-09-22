const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  /** An emoji, the literal string "image" (custom uploaded photo), or null for no avatar. */
  avatar: string | null;
  /** Sound id (see utils/sounds.ts) to play when this person completes a task; null = no sound. */
  complete_sound: string | null;
  /** Visual style id (see utils/progressStyles.ts) for this person's Family Board progress bars. */
  progress_bar_style: string | null;
  /** Where this person sorts in the profile switcher, Settings roster, and Family Board columns. */
  sort_order: number;
  is_parent: 0 | 1;
  /** Prize Bank running totals. */
  star_balance: number;
  money_balance: number;
  /** Whether this person has their own password set — never the password/hash itself. */
  has_password: boolean;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_on: string;
  completed_by_id: string | null;
  completed_at: string;
  /** Which slot this completes, for a task with more than one time-of-day slot; null otherwise. */
  time_of_day: string | null;
}

export interface Task {
  id: string;
  kind: 'chore' | 'todo';
  title: string;
  notes: string | null;
  /** Who this is assigned to; empty = anyone can claim it. Each person completes their own copy independently. */
  assignee_ids: string[];
  created_by_id: string | null;
  recurrence: string;
  due_date: string | null;
  /** null (no particular time), one slot ("morning"), or several comma-separated ("morning,evening"),
   *  each completable independently — see utils/timeOfDay.ts. */
  time_of_day: string | null;
  /** Prize Bank reward for completing this task; null reward_type means no reward. Only settable
   *  via a Settings-password-gated endpoint — see Settings page's Prize Bank section. */
  reward_type: 'stars' | 'money' | null;
  reward_amount: number | null;
  active: 0 | 1;
  /** Every completion for the fetched date (or, for a "once" task, ever) — one per person who's done their copy. */
  completions: TaskCompletion[];
}

// ---- Person detail page ----

export interface StrugglingTask {
  task_id: string;
  title: string;
  kind: 'chore' | 'todo';
  expected: number;
  completed: number;
  missed: number;
}

export interface PersonDetail {
  member: FamilyMember;
  today: string;
  agenda: Array<{ date: string; tasks: Task[] }>;
  stats: {
    statsDays: number;
    completionsByDay: Array<{ date: string; count: number }>;
    /** Completions after a slot's window closed (morning: noon, afternoon: 4pm), or a one-off task
     *  finished after its due date. */
    lateByDay: Array<{ date: string; count: number }>;
    strugglingTasks: StrugglingTask[];
  };
}

// ---- Bank (private per-kid accounts, separate from Prize Bank stars/money) ----

export interface BankTransaction {
  id: string;
  account_id: string;
  /** Positive = deposit, negative = withdrawal/spend. */
  amount: number;
  /** Always set — why the money moved. */
  comment: string;
  /** Spending category (see utils/spendingCategories.ts); null groups into "Other" in the graphs. */
  category: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface BankAccount {
  id: string;
  family_member_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  balance: number;
  transactions: BankTransaction[];
}

/** A savings goal ("Lego set", $60) tracked against one account's running balance. */
export interface BankGoal {
  id: string;
  family_member_id: string;
  account_id: string;
  title: string;
  target_amount: number;
  category: string | null;
  created_at: string;
  achieved_at: string | null;
  /** The linked account's current balance — the goal's progress. */
  saved: number;
}

export interface BankSummary {
  accounts: BankAccount[];
  goals: BankGoal[];
  /** Unallocated Prize Bank money reward earnings, still available to transfer into an account. */
  prizeBankMoneyAvailable: number;
}

export interface SpendingSummary {
  period: 'week' | 'month' | 'year';
  days: number;
  byCategory: Array<{ category: string; total: number }>;
  total: number;
}

// ---- Prize Bank ----

export interface PrizeProgress {
  current: number;
  needed: number;
  available: number;
}

export interface Prize {
  id: string;
  title: string;
  cost_type: 'stars' | 'task_count';
  star_cost: number | null;
  task_id: string | null;
  required_count: number | null;
  created_at: string;
  /** Present only when fetched with ?family_member_id=. */
  progress?: PrizeProgress;
  eligible?: boolean;
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
  created_by_id?: string | null;
}

export interface WeatherData {
  location: string;
  current: { temperature: number; humidity: number; windSpeed: number; code: number; description: string };
  daily: Array<{ date: string; code: number; description: string; high: number; low: number; precipChance: number | null }>;
}

// ---- Music ----

export interface Zone {
  id: number;
  name: string;
  groupId: string | null;
}

export interface ZoneGroup {
  id: string;
  name: string;
  zoneIds: number[];
}

export interface ZoneStatus {
  zoneId: number;
  source: 'local' | 'spotify' | 'none';
  state: 'play' | 'pause' | 'stop';
  volume: number;
  track: { title: string | null; artist: string | null; album: string | null } | null;
  elapsedSeconds: number | null;
  durationSeconds: number | null;
}

export interface Track {
  file: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  is_active: boolean;
  volume_percent: number | null;
}

// ---- Meals & recipes ----

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
  servings: number;
  /** Course category (see utils/recipeCategories.ts) — null groups into "Other" in the meal planner. */
  category: string | null;
  created_by_id: string | null;
  created_at: string;
  ingredients: Ingredient[];
}

/** A search-online result — not yet saved to the local recipe library. */
export interface RecipeSearchResult {
  source: 'themealdb';
  source_id: string;
  title: string;
  instructions: string | null;
  thumbnail_url: string | null;
  category: string | null;
  ingredients: Array<{ name: string; quantity: string | null }>;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface Meal {
  id: string;
  date: string;
  slot: MealSlot;
  assignee_id: string | null;
  title: string;
  notes: string | null;
  created_by_id: string | null;
  created_at: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
}

// ---- Photos ----

export interface Photo {
  id: string;
}
