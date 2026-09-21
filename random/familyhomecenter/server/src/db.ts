import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#5b8def',
    avatar TEXT,
    is_parent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('chore', 'todo')),
    title TEXT NOT NULL,
    notes TEXT,
    assignee_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    recurrence TEXT NOT NULL DEFAULT 'once',
    due_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A task's assignee_id column (still present for legacy data) is no longer the source of
  -- truth — a task can now be assigned to any number of people. See routes/tasks.ts.
  CREATE TABLE IF NOT EXISTS task_assignees (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, family_member_id)
  );

  -- UNIQUE is (task_id, completed_on, completed_by_id) — not just (task_id, completed_on) — so a
  -- task assigned to multiple people lets each of them complete (and earn Prize Bank rewards for)
  -- their own instance independently. See the migration below for databases created before this.
  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT NOT NULL,
    completed_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, completed_on, completed_by_id)
  );

  CREATE TABLE IF NOT EXISTS local_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#5b8def',
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    for_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS external_events_cache (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('google', 'apple')),
    source_calendar_id TEXT,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#8a8a8a',
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source, external_id)
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    scope TEXT,
    token_type TEXT,
    expiry_date INTEGER
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('idle_timeout_seconds', '300');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('slideshow_interval_seconds', '12');

  -- One row per physical DAC8x zone (1-4). Wiring/ALSA device is fixed by zone id;
  -- only the friendly name is user-editable (see routes/music.ts).
  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
  INSERT OR IGNORE INTO zones (id, name) VALUES (1, 'Zone 1');
  INSERT OR IGNORE INTO zones (id, name) VALUES (2, 'Zone 2');
  INSERT OR IGNORE INTO zones (id, name) VALUES (3, 'Zone 3');
  INSERT OR IGNORE INTO zones (id, name) VALUES (4, 'Zone 4');

  -- A group makes several zones share one queue/playback state (near-synced, see docs/MUSIC_SETUP.md).
  CREATE TABLE IF NOT EXISTS zone_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    zone_ids TEXT NOT NULL, -- JSON array of zone ids, e.g. "[1,2]"
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS spotify_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
  );

  -- Settings-page login sessions (see services/auth.ts). Everyday use (chores, calendar, music,
  -- photos, intercom) never checks this — only configuration actions do.
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  -- A recipe is either typed in by hand ('local') or imported from TheMealDB's free public API
  -- ('themealdb', source_id = their idMeal) — see routes/recipes.ts.
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'themealdb')),
    source_id TEXT,
    instructions TEXT,
    thumbnail_url TEXT,
    -- Baseline serving count the ingredient quantities below are written for; the client scales
    -- them proportionally when you ask to size the recipe for a different number of people.
    servings INTEGER NOT NULL DEFAULT 4,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- One meal = one slot (breakfast/lunch/dinner) on one date, optionally for a specific person
  -- (NULL assignee = whole family). Its ingredients are the union of every linked recipe's
  -- ingredients plus its own manually-typed ones (meal_ingredients) — see routes/meals.ts.
  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
    assignee_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meal_ingredients (
    id TEXT PRIMARY KEY,
    meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meal_recipes (
    meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (meal_id, recipe_id)
  );

  -- A prize a kid can redeem: either costs a number of banked stars, or unlocks once a specific
  -- task has been completed a number of times (by that kid) — see routes/prizes.ts.
  CREATE TABLE IF NOT EXISTS prizes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cost_type TEXT NOT NULL CHECK (cost_type IN ('stars', 'task_count')),
    star_cost INTEGER,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    required_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prize_redemptions (
    id TEXT PRIMARY KEY,
    prize_id TEXT NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Simple migration for databases created before for_member_id existed — SQLite has no
// "ADD COLUMN IF NOT EXISTS", so just try it and ignore the "duplicate column" error.
try {
  db.exec('ALTER TABLE local_events ADD COLUMN for_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Which sound (see client/src/utils/sounds.ts for the preset list) plays when this person
// completes a task. NULL/empty means no sound.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN complete_sound TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Optional part of the day ('morning'/'afternoon'/'evening') a chore belongs to; NULL = no particular time.
try {
  db.exec('ALTER TABLE tasks ADD COLUMN time_of_day TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Prize Bank: what completing this task pays out. NULL reward_type = no reward (an ordinary
// chore/to-do). Setting these requires the Settings password — see routes/tasks.ts's PATCH /:id/reward.
try {
  db.exec('ALTER TABLE tasks ADD COLUMN reward_type TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}
try {
  db.exec('ALTER TABLE tasks ADD COLUMN reward_amount REAL');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Prize Bank running totals, credited on task completion (routes/tasks.ts) and spent on
// star-cost prize redemption (routes/prizes.ts).
try {
  db.exec('ALTER TABLE family_members ADD COLUMN star_balance INTEGER NOT NULL DEFAULT 0');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}
try {
  db.exec('ALTER TABLE family_members ADD COLUMN money_balance REAL NOT NULL DEFAULT 0');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Per-person login (see services/auth.ts). NULL = no password set — open, same "optional, off by
// default" pattern as everything else; that's the default for kids and is fine for parents until
// they set one too.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN password_hash TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// A session now optionally belongs to a specific family member (they entered their own
// password); NULL keeps working as the legacy single-household ADMIN_PASSWORD recovery login.
try {
  db.exec('ALTER TABLE admin_sessions ADD COLUMN family_member_id TEXT REFERENCES family_members(id) ON DELETE CASCADE');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// One-time backfill: move any existing single assignee_id into the new task_assignees table.
// assignee_id itself is left in place (harmless, just unused going forward) — SQLite can't cleanly
// drop a column referenced the way this one was without a full table rebuild, and there's nothing
// gained by doing that here.
db.exec(`
  INSERT OR IGNORE INTO task_assignees (task_id, family_member_id)
  SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
`);

// Databases created before task_completions' UNIQUE constraint included completed_by_id (i.e.
// before multi-assignee tasks) need the table rebuilt — SQLite has no ALTER TABLE for changing a
// UNIQUE constraint. Detect the old shape via sqlite_master and migrate exactly once.
const taskCompletionsSql = (
  db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'task_completions'").get() as
    | { sql: string }
    | undefined
)?.sql;
if (taskCompletionsSql && !taskCompletionsSql.includes('completed_by_id)')) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE task_completions_new (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        completed_on TEXT NOT NULL,
        completed_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(task_id, completed_on, completed_by_id)
      );
      INSERT INTO task_completions_new (id, task_id, completed_on, completed_by_id, completed_at)
        SELECT id, task_id, completed_on, completed_by_id, completed_at FROM task_completions;
      DROP TABLE task_completions;
      ALTER TABLE task_completions_new RENAME TO task_completions;
    `);
  })();
}

export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}
