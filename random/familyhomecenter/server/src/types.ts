export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  /** An emoji (e.g. "🦄"), the literal string "image" (a custom photo — see routes/familyMembers.ts's
   *  /:id/avatar-image), or null/empty for no avatar (falls back to a colored initial in the client). */
  avatar: string | null;
  is_parent: 0 | 1;
  /** A kid a parent lets put their own chores/to-dos on the floor plan (parents always can). */
  can_place_tasks?: 0 | 1;
  /** Sound id (client/src/utils/sounds.ts preset list) to play when this person completes a task. */
  complete_sound: string | null;
  /** Prize Bank running totals — credited on completing a reward task, spent on star-cost prizes. */
  star_balance: number;
  money_balance: number;
  /** "<saltHex>:<hashHex>" (see services/auth.ts), or null for no login set. Never sent to the client. */
  password_hash: string | null;
  /** Visual style id (client/src/utils/progressStyles.ts) for this person's Chores progress bar. */
  progress_bar_style: string | null;
  /** Same, independently, for the To-dos progress bar — Chores and To-dos can look completely different. */
  todo_progress_bar_style: string | null;
  /** Where this person sorts in the profile switcher, Settings roster, and Family Board columns —
   *  lower first. Defaults to arrival order; reorderable via POST /family-members/reorder. */
  sort_order: number;
  created_at: string;
  /** Where the nightly grocery-list digest goes (services/groceryEmail.ts) — only meaningful for a
   *  parent (is_parent = 1); null/empty means this person doesn't receive it. */
  email: string | null;
  /** Start/end icons for the Chores Adventure Map — null falls back to a default (🏠/🏰)
   *  client-side. Irrelevant unless progress_bar_style is 'adventure'. */
  adventure_start_icon: string | null;
  adventure_end_icon: string | null;
  /** Same, independently, for the To-dos Adventure Map. */
  todo_adventure_start_icon: string | null;
  todo_adventure_end_icon: string | null;
  /** Animation (client/src/utils/celebrations.ts) played when this person finishes all their
   *  chores for the day / all their to-dos — each picked separately; null = the default, 'none' = off. */
  chore_celebration: string | null;
  todo_celebration: string | null;
}

export type TaskKind = 'chore' | 'todo';

/**
 * Recurrence rules, kept intentionally simple (no RRULE parser needed):
 *  - "once"                        one-off, done forever once completed
 *  - "daily"                       applies every day
 *  - "weekdays"                    Mon-Fri
 *  - "weekends"                    Sat-Sun
 *  - "weekly:MON,WED,FRI"          specific weekdays, every week, 3-letter codes
 *  - "monthly:1:FRI"               nth weekday of the month (n = 1-4, or -1 for "last")
 *  - "biweekly:2026-09-22:TUE"     that weekday, every other week counting from the anchor date
 */
export type Recurrence =
  | 'once'
  /** "When needed": not on anyone's list until someone taps 🔔 Needs doing (tasks.needed_since). */
  | 'asneeded'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | `weekly:${string}`
  | `monthly:${string}`
  | `biweekly:${string}`;

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  notes: string | null;
  created_by_id: string | null;
  recurrence: Recurrence;
  due_date: string | null;
  /** Which part(s) of the day this applies to — null (no particular time), one slot ("morning"),
   *  or several, comma-separated ("morning,evening"), each completable independently. */
  time_of_day: string | null;
  /** Prize Bank reward for completing this task; null reward_type means no reward. Set only via
   *  PATCH /:id/reward (requires the Settings password) — see routes/tasks.ts. */
  reward_type: 'stars' | 'money' | 'custom' | null;
  reward_amount: number | null;
  /** A custom reward (reward_type 'custom'): what it is ("Movie time"). And the reward's emoji, any
   *  type (null = 💲 money, ⭐ stars, 🎁 custom). */
  reward_text?: string | null;
  reward_emoji?: string | null;
  /** A kid's check-off waits for a parent's OK before it counts (1), or counts straight away (0). */
  needs_approval?: 0 | 1;
  active: 0 | 1;
  created_at: string;
  /** This task's checkpoint icon on the "Adventure Map" progress_bar_style — null falls back to a
   *  generic icon by kind client-side (client/src/utils/taskIcons.ts). Irrelevant for any other style. */
  icon: string | null;
  /** Where in the house this is (a room on a floor plan — routes/floorplans.ts); null = nowhere in particular. */
  room_id: string | null;
  /** The exact spot in that room, 0–1 across/down the plan's picture; null = the middle of the room. */
  room_x: number | null;
  room_y: number | null;
  /** Taking turns (parents only): JSON array of member ids, in order — each time this comes up it's
   *  the next one's. null = no rotation. */
  rotation: string | null;
  /** From this date on, turns count: rotation[0] first, then the next person each time it's done. */
  rotation_start: string | null;
  /** A "when needed" chore: the date someone said it needs doing (null = it doesn't right now). */
  needed_since: string | null;
  /** How much of it to do: null = just check it off; 'times' = goal_amount times (each goal_minutes
   *  long, if set); 'hours' = goal_amount hours, checked off 30 minutes or more at a time. */
  goal_type?: 'times' | 'hours' | null;
  goal_amount?: number | null;
  goal_minutes?: number | null;
}

/** A chunk of a "times"/"hours" job: 1 per time, or minutes. */
export interface TaskProgress {
  id: string;
  task_id: string;
  family_member_id: string | null;
  logged_on: string;
  amount: number;
  created_at: string;
}

/** A floor plan's room: its outline as points 0–1 across/down the plan's picture. */
export interface FloorplanRoom {
  id: string;
  floorplan_id: string;
  name: string;
  points: Array<[number, number]>;
  color: string;
  created_at: string;
}

/** A picture of one floor (or the yard) with its rooms marked — Chores & Tasks → 🏠 By room. */
export interface Floorplan {
  id: string;
  name: string;
  width: number;
  height: number;
  sort_order: number;
  /** Room label size on this plan: 1 = the default, 0.5–3. */
  label_scale: number;
  /** How zoomed in it starts (1–2, 1 = fits the screen); null = fit. */
  default_zoom: number | null;
  /** Avatar size and job-emoji size on this plan: 1 = the default, 0.1–3. */
  avatar_scale: number;
  job_scale: number;
  /** Changes when the picture is replaced (the client adds it to the image URL). */
  updated_at: string;
  created_at: string;
  rooms: FloorplanRoom[];
}

/** Task as returned by the API — assignee_ids/completions are computed from the join tables, not columns. */
export interface TaskWithAssignment extends Task {
  /** Who this is assigned to; empty = anyone can claim it. Each person completes their own copy independently. */
  assignee_ids: string[];
  completions: TaskCompletion[];
  /** Taking turns: everyone in the rotation, in order (assignee_ids is then just that day's turn). */
  rotation_ids?: string[];
  /** …and whose turn it is the next time it comes up. */
  rotation_next_id?: string | null;
  /** Where this sits in each person's routine (member id → 1, 2, …), for those who've ordered it. */
  positions?: Record<string, number>;
  /** A one-time job that's been done (only from GET /tasks?all=true). */
  finished?: boolean;
  /** A "times"/"hours" job: how much each person has done so far (times, or minutes) — member id
   *  ('' for nobody in particular) → amount. One-time jobs count every day; repeating ones just that day. */
  progress?: Record<string, number>;
  /** Check-offs waiting for a parent's OK (a job that needs one). */
  pending?: Array<{ family_member_id: string | null; time_of_day: string | null }>;
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
  /** Course category (see client/src/utils/recipeCategories.ts) — null groups into "Other" in the meal planner. */
  category: string | null;
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
  /** What you get: money / stars (reward_amount, paid in when claimed) or custom (the title);
   *  null = an older prize, treated as custom. */
  reward_kind?: 'money' | 'stars' | 'custom' | null;
  reward_amount?: number | null;
  /** Its emoji; null = 💲 / ⭐ / 🎁 by reward_kind. */
  emoji?: string | null;
  /** A kid's claim waits for a parent's OK (1). */
  needs_approval?: 0 | 1;
}

/** One job toward a prize, and how much of it (times; hours for an "hours" job). */
export interface PrizeRequirement {
  prize_id: string;
  task_id: string;
  amount: number;
  sort_order: number;
}

export interface PrizeRedemption {
  id: string;
  prize_id: string;
  family_member_id: string;
  redeemed_at: string;
}

export interface BankAccount {
  id: string;
  family_member_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

/** amount is positive for a deposit, negative for a withdrawal/spend; comment is always required
 *  (why the money moved), created_by_id records who made the entry (parent or the kid themselves).
 *  category (client/src/utils/spendingCategories.ts preset list) drives the spending-by-category
 *  graphs; null groups into "Other" there. */
export interface BankTransaction {
  id: string;
  account_id: string;
  amount: number;
  comment: string;
  category: string | null;
  created_by_id: string | null;
  created_at: string;
}

/** A savings goal tracked against one account's running balance — see routes/bank.ts. */
export interface BankGoal {
  id: string;
  family_member_id: string;
  account_id: string;
  title: string;
  target_amount: number;
  /** Category to tag the withdrawal transaction with once achieved. */
  category: string | null;
  created_at: string;
  achieved_at: string | null;
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

/** A household how-to guide — see routes/knowledgeBase.ts. */
export interface KbArticle {
  id: string;
  title: string;
  category: string | null;
  body: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One attached picture/video on a KB article. file_name is set for 'image'/'video' (an uploaded
 *  file under config.kbMediaDir); external_url is set for 'video_link' (e.g. a YouTube URL). */
export interface KbMedia {
  id: string;
  article_id: string;
  kind: 'image' | 'video' | 'video_link';
  file_name: string | null;
  external_url: string | null;
  sort_order: number;
  created_at: string;
}

/** An important phone number/address for the family — see routes/contacts.ts. */
export interface Contact {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Straight-line ("as the crow flies") miles from home — see services/geocodeAddress.ts. Null
   *  if there's no address, or geocoding hasn't succeeded (yet). */
  distance_miles: number | null;
  /** Email-to-SMS gateway domain (e.g. "vtext.com") — see services/contactText.ts. Null = the
   *  "Text (email)" option doesn't show for this contact. */
  carrier: string | null;
  created_by_id: string | null;
  created_at: string;
}

/** A rendered photo-slideshow-with-music video — see routes/movies.ts and services/movieRender.ts.
 *  Only ever reads the source photos/music; never deletes or modifies them. */
/** A movie's optional style, as stored and sent to the client. */
export interface MovieStyleOptions {
  transition: 'cut' | 'crossfade';
  motion: 'none' | 'kenburns';
  title_card: boolean;
  subtitle: string;
}

export interface Movie {
  id: string;
  title: string;
  status: 'rendering' | 'ready' | 'failed';
  /** Set once status is 'ready' — filename under config.moviesDir, served via /api/movies-media. */
  file_name: string | null;
  /** Set once status is 'failed' — ffmpeg's own error output, best-effort human-readable. */
  error: string | null;
  photo_count: number;
  seconds_per_photo: number;
  /** The music library track's relative path (Track.file from GET /music/library/search), or null
   *  for a silent slideshow. */
  music_track: string | null;
  /** Every track played, in order (music_track is the first of these) — empty for a silent
   *  slideshow. Stored as a JSON array in the music_tracks column. */
  music_tracks: string[];
  /** Whether the photos/songs it was made from are saved (movies made before that was tracked
   *  can't be edited, only deleted). */
  has_source: boolean;
  /** Style choices (all optional — defaults are plain cuts, no title card). */
  style: MovieStyleOptions;
  /** Live render progress (0-100), parsed from ffmpeg's own -progress output — only meaningful
   *  while status is 'rendering'; null before the first update or once no longer rendering. */
  progress_percent: number | null;
  /** A "living photo" clip (one photo, animated) rather than a slideshow — see services/livingPhoto.ts. */
  living: LivingOptions | null;
  created_by_id: string | null;
  created_at: string;
}

export interface LivingOptions {
  photo_id: string;
  effect: 'zoom' | 'drift' | 'depth' | 'still';
  overlay: 'none' | 'sparkles' | 'snow' | 'rain' | 'hearts' | 'bubbles' | 'petals';
  seconds: number;
  /** Painted areas that move (their masks aren't kept — only what each one does, for the label). */
  regions?: Array<{ effect: 'water' | 'flames' | 'sway' | 'shimmer' | 'clouds' | 'twinkle'; direction: 'down' | 'up' | 'left' | 'right' }>;
}

/** A grocery-list entry — see routes/grocery.ts. Getting checked off deletes it (no purchased
 *  history kept); requested_by_id/meal_id are both optional. */
export interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  requested_by_id: string | null;
  meal_id: string | null;
  created_at: string;
}

/** Something earned that isn't money or stars (a custom chore/to-do reward, or a claimed prize). */
export interface EarnedReward {
  id: string;
  family_member_id: string;
  task_id: string | null;
  prize_id: string | null;
  text: string;
  emoji: string | null;
  earned_at: string;
  /** When a parent marked it used (the movie was watched); null = still to enjoy. */
  used_at: string | null;
}

export interface PendingCompletion {
  id: string;
  task_id: string;
  family_member_id: string | null;
  completed_on: string;
  time_of_day: string | null;
  created_at: string;
}
