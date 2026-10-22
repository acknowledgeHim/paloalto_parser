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
  /** 👕 Dress up: what the avatar has on, as JSON {slot: item id} — see utils/outfits.ts. */
  avatar_outfit?: string | null;
  /** 🏠 Who's home — see components/WhosHome.tsx. */
  presence?: string | null;
  presence_note?: string | null;
  presence_at?: string | null;
  /** Sound id (see utils/sounds.ts) to play when this person completes a task; null = no sound. */
  complete_sound: string | null;
  /** Visual style id (see utils/progressStyles.ts) for this person's Chores progress bar. */
  progress_bar_style: string | null;
  /** Same, independently, for the To-dos progress bar — Chores and To-dos can look completely different. */
  todo_progress_bar_style: string | null;
  /** Where this person sorts in the profile switcher, Settings roster, and Family Board columns. */
  sort_order: number;
  is_parent: 0 | 1;
  /** A kid a parent lets put their own chores/to-dos on the floor plan (parents always can). */
  can_place_tasks?: 0 | 1;
  /** Prize Bank running totals. */
  star_balance: number;
  money_balance: number;
  /** Whether this person has their own password set — never the password/hash itself. */
  has_password: boolean;
  /** Where the nightly grocery-list digest goes — only meaningful for a parent; null = doesn't receive it. */
  email: string | null;
  /** Start/end icons for the Chores Adventure Map — null falls back to a default (🏠/🏰).
   *  Irrelevant unless progress_bar_style is 'adventure'. */
  adventure_start_icon: string | null;
  adventure_end_icon: string | null;
  /** Same, independently, for the To-dos Adventure Map. */
  todo_adventure_start_icon: string | null;
  todo_adventure_end_icon: string | null;
  /** All-done animation id (see utils/celebrations.ts) for finishing every chore today / every
   *  to-do — picked separately; null = the default, 'none' = off. */
  chore_celebration: string | null;
  todo_celebration: string | null;
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
  reward_type: 'stars' | 'money' | 'custom' | null;
  reward_amount: number | null;
  /** A custom reward (reward_type 'custom'): what they earn ("Movie time"). */
  reward_text?: string | null;
  /** The reward's emoji; null = 💲 money, ⭐ stars, 🎁 custom. */
  reward_emoji?: string | null;
  /** A kid's check-off waits for a parent's OK before it counts (1). */
  needs_approval?: 0 | 1;
  /** Check-offs waiting for that OK (who, and which slot). */
  pending?: Array<{ family_member_id: string | null; time_of_day: string | null }>;
  active: 0 | 1;
  /** Every completion for the fetched date (or, for a "once" task, ever) — one per person who's done their copy. */
  completions: TaskCompletion[];
  /** This task's checkpoint icon on the "Adventure Map" progress bar style (see utils/taskIcons.ts
   *  for the preset picker and the fallback-by-kind used when this is null). */
  icon: string | null;
  /** Which room it's in, on a floor plan (Chores & Tasks → 🏠 By room); null = nowhere in particular. */
  room_id: string | null;
  /** The exact spot in that room (dragged there), 0–1 across/down the plan; null = the middle of the room. */
  room_x: number | null;
  room_y: number | null;
  /** Taking turns: everyone in the rotation, in order — assignee_ids is then just that day's turn. */
  rotation_ids?: string[] | null;
  /** …and whose turn it is the next time it comes up. */
  rotation_next_id?: string | null;
  /** A "when needed" chore (recurrence 'asneeded'): since when it needs doing; null = it doesn't now. */
  needed_since?: string | null;
  /** Where this sits in each person's routine (member id → 1, 2, …), for those who've ordered it. */
  positions?: Record<string, number>;
  /** A one-time job that's been done (only from GET /tasks?all=true) — nothing left to put in order. */
  finished?: boolean;
  /** How much of it to do: null = just check it off; 'times' = goal_amount times (each goal_minutes
   *  long, if set); 'hours' = goal_amount hours, checked off 30 minutes or more at a time. */
  goal_type?: 'times' | 'hours' | null;
  goal_amount?: number | null;
  goal_minutes?: number | null;
  /** How much each person has done toward it (times, or minutes): member id ('' = nobody in particular) → amount. */
  progress?: Record<string, number>;
  /** Same, for chunks a kid logged that are still waiting for a parent's OK. */
  progress_waiting?: Record<string, number>;
}

/** A room marked on a floor plan: its outline as points 0–1 across/down the plan's picture. */
export interface FloorplanRoom {
  id: string;
  floorplan_id: string;
  name: string;
  points: Array<[number, number]>;
  color: string;
  created_at: string;
}

/** A picture of one floor (or the yard) with its rooms marked. */
export interface Floorplan {
  id: string;
  name: string;
  width: number;
  height: number;
  sort_order: number;
  /** Room label size on this plan: 1 = the default, 0.5–3. */
  label_scale?: number;
  /** How zoomed in it starts (1–2, 1 = fits the screen); null = fit. */
  default_zoom?: number | null;
  /** Avatar size and job-emoji size on this plan: 1 = the default, 0.1–3. */
  avatar_scale?: number;
  job_scale?: number;
  updated_at: string;
  created_at: string;
  rooms: FloorplanRoom[];
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
    /** count = tasks completed that day, notCompleted = tasks assigned that day but not done —
     *  same "was it assigned that day" source as the day drill-down, so the two stay consistent. */
    completionsByDay: Array<{ date: string; count: number; notCompleted: number }>;
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

/** One account across ANY family member — GET /bank/accounts (parent-only), for the cross-member
 *  transfer picker. A single member's own bank page uses BankAccount instead. */
export interface AnyBankAccount {
  id: string;
  family_member_id: string;
  member_name: string;
  member_color: string;
  name: string;
  balance: number;
}

export interface SpendingSummary {
  period: 'week' | 'month' | 'year';
  days: number;
  byCategory: Array<{ category: string; total: number }>;
  total: number;
}

// ---- Prize Bank ----

/** One job toward a prize: how much of it (hours for an "hours" job, else times) since the last claim. */
export interface PrizePart {
  task_id: string;
  title: string;
  icon: string | null;
  kind: 'chore' | 'todo';
  unit: 'hours' | 'times';
  current: number;
  needed: number;
}

export interface PrizeProgress {
  current: number;
  needed: number;
  available: number;
  /** For a prize earned by doing jobs (one or several): each job's progress. current/needed is then a percent. */
  parts?: PrizePart[];
}

/** One redeemed prize, for the past-prizes page. */
export interface PastPrize {
  id: string;
  prize_id: string;
  redeemed_at: string;
  paid_money: number | null;
  paid_stars: number | null;
  bank_transaction_id: string | null;
  title: string;
  emoji: string | null;
  reward_kind: Prize['reward_kind'];
  reward_amount: number | null;
  once: 0 | 1 | null;
}

export interface PrizeRequirement {
  task_id: string;
  amount: number;
}

export interface Prize {
  id: string;
  title: string;
  cost_type: 'stars' | 'task_count';
  star_cost: number | null;
  task_id: string | null;
  required_count: number | null;
  created_at: string;
  /** What you get: money / stars (reward_amount, paid in when claimed) or something custom (the title). null = older prize (custom). */
  reward_kind?: 'money' | 'stars' | 'custom' | null;
  reward_amount?: number | null;
  /** Its emoji; null = 💲 / ⭐ / 🎁 by reward_kind. */
  emoji?: string | null;
  /** The jobs it's earned by (with how much of each); empty = stars, or an older single-job prize. */
  requirements?: PrizeRequirement[];
  /** A kid's claim waits for a parent's OK (1). */
  needs_approval?: 0 | 1;
  /** Who it's for; empty = everyone. */
  member_ids?: string[];
  /** Earned once (1): after it's redeemed it's in their past prizes. null = again and again. */
  once?: 0 | 1 | null;
  /** With ?family_member_id=: how many times they've redeemed it, and when last. */
  redeemed_count?: number;
  last_redeemed_at?: string | null;
  /** With ?family_member_id=: an earned-once prize they've redeemed (shown under past prizes). */
  done?: boolean;
  /** With ?family_member_id=: how many of their claims are waiting for that OK. */
  waiting?: number;
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
  daily: Array<{ date: string; code: number; description: string; high: number; low: number; precipChance: number | null; sunrise?: string | null; sunset?: string | null }>;
}

// ---- 👕 Dress up ----

export type OutfitSlot = 'hat' | 'eyes' | 'hand' | 'pet' | 'magic';
export interface OutfitItem {
  id: string;
  slot: OutfitSlot;
  emoji: string;
  name: string;
  stars: number;
}
export interface OutfitCatalog {
  slots: Array<{ id: OutfitSlot; label: string }>;
  items: OutfitItem[];
}
export interface Closet {
  owned: string[];
  outfit: Partial<Record<OutfitSlot, string>>;
  star_balance: number;
}

// ---- 📔 Journal, 📏 heights, 📝 notes ----

export interface JournalEntry {
  id: string;
  family_member_id: string;
  kind: 'journal' | 'gratitude';
  date: string;
  text: string | null;
  mood: string | null;
  drawing: string | null;
  created_at: string;
}
export interface HeightRow {
  id: string;
  family_member_id: string;
  date: string;
  inches: number;
  note: string | null;
  has_photo: 0 | 1;
  created_at: string;
}
export interface StickyNote {
  id: string;
  text: string | null;
  drawing: string | null;
  color: string | null;
  author_id: string | null;
  for_member_id: string | null;
  created_at: string;
}

// ---- 🗳️ Meal votes ----

export interface MealPollOption {
  id: string;
  title: string;
  recipe_id: string | null;
  emoji: string | null;
  thumbnail_url: string | null;
  votes: number;
}
export interface MealPoll {
  id: string;
  date: string;
  slot: MealSlot;
  question: string | null;
  created_at: string;
  closed_at: string | null;
  winner_option_id: string | null;
  meal_id: string | null;
  options: MealPollOption[];
  votes: Array<{ family_member_id: string; option_id: string }>;
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

/** GET /music/library/status — whether the index MPD instance (used for search/browse) is
 *  actually reachable. Search/browse both quietly return an empty list on a connection problem
 *  (so a hiccup doesn't take the page down), which looks identical to "no matches" — this lets
 *  the UI tell the two apart. */
export interface LibraryStatus {
  connected: boolean;
  error: string | null;
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
  /** Who it's from — "Aunt Mary", "Grandma Huber". */
  author?: string | null;
  /** Where it came from — "Huber Family Cookbook, p. 6", "TheMealDB", a website. */
  origin?: string | null;
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

// ---- Knowledge base ----

export interface KbMedia {
  id: string;
  article_id: string;
  kind: 'image' | 'video' | 'video_link';
  /** Set for 'image'/'video' — fetch from /api/kb-media/<file_name>. */
  file_name: string | null;
  /** Set for 'video_link' (e.g. a YouTube URL) — embedded instead of hosted. */
  external_url: string | null;
  sort_order: number;
  created_at: string;
}

/** A household how-to guide ("shut off the main water valve", "reset a tripped breaker"). */
export interface KbArticle {
  id: string;
  title: string;
  category: string | null;
  body: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  media: KbMedia[];
}

// ---- Contacts ----

/** An important phone number/address for the family. */
export interface Contact {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Straight-line ("as the crow flies") miles from home — null if there's no address, or
   *  geocoding hasn't succeeded (yet). */
  distance_miles: number | null;
  /** Email-to-SMS gateway domain (e.g. "vtext.com") — see utils/smsGateways.ts. Null hides the
   *  "Text (email)" option for this contact. */
  carrier: string | null;
  created_by_id: string | null;
  created_at: string;
}

// ---- Grocery list ----

/** A grocery-list entry. It stays on the list until a parent marks it purchased or ignored
 *  (then it's kept under "Marked off", never deleted). */
export interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  requested_by_id: string | null;
  /** Optional link to an upcoming meal this item is for. */
  meal_id: string | null;
  created_at: string;
  /** null = still on the list. */
  status: 'purchased' | 'ignored' | null;
  done_at: string | null;
  done_by_id: string | null;
}

// ---- Photos ----

export interface Photo {
  id: string;
  /** From the background duplicate/blur analysis — null until it's run on this photo. */
  blurry: boolean | null;
  /** Marked hidden — out of sight unless "Show hidden photos" is on. */
  hidden: boolean;
}

/** A photo album (GET /albums) — kept only in the app's database; photos are never moved. */
export interface PhotoAlbum {
  id: string;
  name: string;
  is_favorites: boolean;
  created_by_id: string | null;
  count: number;
  cover_id: string | null;
}

/** GET /photos/details — for sorting/filtering the movie maker's photo grid. */
export interface PhotoDetail {
  id: string;
  /** Folder + filename relative to PHOTOS_DIR. */
  path: string;
  /** Best-effort date taken (EXIF, else file modified time), ISO 8601. */
  taken_at: string;
  /** Possibly blurry (null = not analyzed yet). */
  blurry: boolean | null;
  /** Shared by near-duplicates of the same shot; null if it has none. */
  dup_group: string | null;
  /** The one of its duplicate group to keep (highest resolution of the sharpest). */
  dup_best: boolean;
  /** Marked hidden on the Photos page — left out of pickers. */
  hidden: boolean;
  /** 📍 Where it was taken — see PhotoPlace. */
  lat?: number | null;
  lon?: number | null;
  gps_read?: boolean;
  country?: string | null;
  country_code?: string | null;
  state?: string | null;
  place_source?: 'gps' | 'set' | null;
  year_fixed?: number | null;
  month_fixed?: number | null;
}

/** 📍 Where and when one photo was taken (GET /photos/:id/place). */
export interface PhotoPlace {
  lat: number | null;
  lon: number | null;
  gps_read: boolean;
  country: string | null;
  country_code: string | null;
  state: string | null;
  /** 'gps' from the photo itself; 'set' by someone in the family; null = unknown. */
  place_source: 'gps' | 'set' | null;
  year_fixed: number | null;
  month_fixed: number | null;
  /** The date used everywhere (with any year set by hand). */
  taken_at: string;
  /** What the photo itself says. */
  photo_taken_at: string;
  /** Where that came from: 'exif' (inside the photo), 'folder' (its YEAR/Month folder), 'file' (the file's own date). */
  date_from?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}
export interface PlaceLists {
  countries: Array<{ name: string; code: string }>;
  states: Array<{ name: string; code: string }>;
}

/** A rendered photo-slideshow-with-music video. Read-only against the source photos/music that
 *  made it — this is always a brand new file, nothing about the originals is ever touched. */
/** GET /movies/screensaver — the movie playing as the idle screensaver, if any. */
export interface ScreensaverMovie {
  movie_id: string;
  title: string;
  file_name: string;
  /** null = until a parent turns it off */
  until: string | null;
  sound: boolean;
}

export interface Movie {
  id: string;
  title: string;
  status: 'rendering' | 'ready' | 'failed';
  /** Set once status is 'ready' — fetch from /api/movies-media/<file_name>. */
  file_name: string | null;
  /** Set once status is 'failed' — a best-effort human-readable reason. */
  error: string | null;
  photo_count: number;
  seconds_per_photo: number;
  music_track: string | null;
  /** Every track played, in order — empty for a silent slideshow. */
  music_tracks: string[];
  /** Whether the photos/songs it was made from are saved, so it can be edited and re-rendered. */
  has_source: boolean;
  /** Optional style — plain cuts / still photos / no title card unless chosen. */
  style: { transition: 'cut' | 'crossfade'; motion: 'none' | 'kenburns'; title_card: boolean; subtitle: string };
  /** Live render progress (0-100) — only meaningful while status is 'rendering'. */
  progress_percent: number | null;
  /** A "living photo" (one photo, animated — Photos → ✨ Animate) rather than a slideshow. */
  living: LivingOptions | null;
  created_by_id: string | null;
  created_at: string;
}

export type LivingEffect = 'zoom' | 'drift' | 'depth' | 'still';
export type LivingOverlay = 'none' | 'sparkles' | 'snow' | 'rain' | 'hearts' | 'bubbles' | 'petals';
export interface LivingOptions {
  photo_id: string;
  effect: LivingEffect;
  overlay: LivingOverlay;
  seconds: number;
  /** Painted areas that move, and what each does. */
  regions?: Array<{ effect: string; direction: string }>;
}

/** Face recognition (server/src/routes/faces.ts) — opt-in, entirely on the Pi. */
export interface FaceStatus {
  enabled: boolean;
  models_present: boolean;
  preparing: boolean;
  scanned: number;
  total: number;
  faces: number;
  /** Faces marked "not a face / don't name". */
  ignored: number;
  people: number;
  /** Filling in the "facing the camera" score for faces found before it existed. */
  rescoring: { done: number; total: number } | null;
  upgrading: { done: number; total: number; added: number } | null;
  night: boolean;
  /** Photos that couldn't be read (counted as looked at). */
  unreadable: number;
  working: boolean;
  last_progress_at: string | null;
  error: string | null;
}

export interface Person {
  id: string;
  name: string;
  cover_face_id: number | null;
  confirmed_count: number;
  suggested_count: number;
  /** Photos they're tagged in by hand (no face to name — back of the head, side view…). */
  tagged_count: number;
  photo_count: number;
}

export interface Face {
  id: number;
  photo_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  person_id: string | null;
  confirmed: boolean;
  suggested_person_id: string | null;
  similarity: number | null;
  /** Clear enough to be grouped/suggested automatically. */
  good: boolean;
  no_group: boolean;
}

/** Something earned that isn't money or stars — from a chore/to-do's custom reward, or a claimed prize. */
export interface EarnedReward {
  id: string;
  family_member_id: string;
  task_id: string | null;
  prize_id: string | null;
  text: string;
  emoji: string | null;
  earned_at: string;
  /** When a parent marked it used; null = still to enjoy. */
  used_at: string | null;
}

/** ✅ To approve: a kid's check-off of a job that needs a parent's OK. */
export interface PendingJob {
  id: string;
  task_id: string;
  family_member_id: string | null;
  completed_on: string;
  time_of_day: string | null;
  created_at: string;
  title: string;
  kind: 'chore' | 'todo';
  icon: string | null;
  goal_type: 'times' | 'hours' | null;
  goal_amount: number | null;
  goal_minutes?: number | null;
  reward_type: 'stars' | 'money' | 'custom' | null;
  reward_amount: number | null;
  reward_text: string | null;
  reward_emoji: string | null;
  /** A chunk of a times/hours job (minutes for hours, else times) rather than the whole job. */
  chunk?: number | null;
}

/** ✅ To approve: a kid's prize claim that needs a parent's OK. */
export interface PendingPrizeClaim {
  id: string;
  prize_id: string;
  family_member_id: string;
  redeemed_at: string;
  title: string;
  emoji: string | null;
  reward_kind: 'money' | 'stars' | 'custom' | null;
  reward_amount: number | null;
  cost_type: 'stars' | 'task_count';
  star_cost: number | null;
}

// ---- 📹 Cameras ----

export interface CameraInfo {
  id: string;
  name: string;
  user_agent: string | null;
  /** What the tablet last said: ok, off, starting, needs-https, denied, no-camera, error. */
  status: string | null;
  enabled: 0 | 1;
  facing: 'user' | 'environment';
  motion: 0 | 1;
  sensitivity: number;
  show_badge: 0 | 1;
  created_at: string;
  last_seen_at: string | null;
  online: boolean;
  watching: number;
  has_frame: boolean;
  clip_count: number;
  last_clip_at: string | null;
}
export interface CameraClip {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string;
  frames: number;
  /** Set once it's over a day old and squeezed into one video (then only frame 1, the thumbnail, is kept). */
  archive_file: string | null;
  backed_up_at: string | null;
  downloaded_at: string | null;
}
export interface CameraStorage {
  free_bytes: number;
  total_bytes: number;
  min_free_gb: number;
  low: boolean;
  on_network_share: boolean;
  compress: boolean;
  clips: { count: number; bytes: number; compressed: number; waiting: number; failed: number; last_error: string | null; backed_up: number; to_back_up: number };
  downloaded: number;
  oldest_at: string | null;
  purged_total: number;
  purges: Array<{ id: string; at: string; clips: number; bytes: number; backed_up: number; first_at: string | null; last_at: string | null; cameras: string | null; free_before: number; free_after: number; note: string | null }>;
  smb: {
    share: string;
    folder: string;
    user: string;
    domain: string;
    has_password: boolean;
    auto: boolean;
    status: { at: string; sent: number; failed: number; error: string | null } | null;
    smbclient: boolean;
  };
}
