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

  -- UNIQUE is (task_id, completed_on, completed_by_id, time_of_day) — not just (task_id,
  -- completed_on) — so a task assigned to multiple people lets each of them complete (and earn
  -- Prize Bank rewards for) their own instance independently, and a task with more than one
  -- time-of-day slot (e.g. "morning,evening") lets each slot be completed independently too.
  -- time_of_day is NULL for a task with zero or one slot (unchanged single-checkbox behavior).
  -- See the migrations below for databases created before each of these.
  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT NOT NULL,
    completed_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    time_of_day TEXT,
    UNIQUE(task_id, completed_on, completed_by_id, time_of_day)
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

  -- Bank: multiple named accounts per family member (checking, college savings, ...), each with
  -- its own running-balance ledger. Entirely separate from the Prize Bank star_balance/money_balance
  -- counters above — see routes/bank.ts's "transfer from Prize Bank earnings" endpoint for the one
  -- deliberate bridge between the two (a parent/kid moves already-earned money_balance into a named
  -- account, with a required comment + timestamp).
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- amount is positive for a deposit, negative for a withdrawal/spend; an account's balance is the
  -- sum of its transactions (no separate stored balance column, so it can never drift out of sync).
  -- category (see client/src/utils/spendingCategories.ts for the preset list) is what the spending-
  -- by-category graphs group by — only really meaningful for a spend, but not enforced either way.
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    comment TEXT NOT NULL,
    category TEXT,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A savings goal ("save for a Lego set", $60), tracked against one specific account's running
  -- balance (no separate contribution tracking needed — the account balance IS the progress).
  -- achieved_at is set when marked purchased, which also records a real withdrawal transaction
  -- (see routes/bank.ts's /goals/:id/achieve) so the spend shows up in the category graphs too.
  CREATE TABLE IF NOT EXISTS bank_goals (
    id TEXT PRIMARY KEY,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_amount REAL NOT NULL,
    category TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    achieved_at TEXT
  );

  -- Important phone numbers/addresses everyone in the family might need — grandparents, doctors,
  -- neighbors, etc. distance_miles is a cached, best-effort straight-line distance from home
  -- (see services/geocodeAddress.ts), re-geocoded whenever the address changes; null means it's
  -- never been successfully looked up (no address, or geocoding failed/hasn't run yet).
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    relationship TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    distance_miles REAL,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Household how-to guides ("shut off the main water valve", "reset a tripped breaker") —
  -- parent-authored reference material, not an everyday list (see routes/knowledgeBase.ts).
  CREATE TABLE IF NOT EXISTS kb_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    body TEXT,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- An article's attached pictures/videos, in display order. 'image'/'video' store an uploaded
  -- file (file_name, under config.kbMediaDir — see services/kbMedia.ts); 'video_link' is an
  -- external URL (e.g. a YouTube link) embedded instead of hosted, so a long video doesn't need
  -- to live on the Pi's SD card.
  CREATE TABLE IF NOT EXISTS kb_media (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'video_link')),
    file_name TEXT,
    external_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A running "need to buy" list, separate from a meal's own ingredients — anyone can ask for
  -- something without it being tied to a specific meal, and meal_id is just an optional link
  -- for when it is (e.g. "we're short a can of tomatoes for Tuesday's chili"). Getting checked
  -- off (routes/grocery.ts's DELETE) just removes it — there's no need to keep a purchased-item
  -- A rendered photo-slideshow-with-music video (see services/movieRender.ts) — only ever READS
  -- from PHOTOS_DIR/MUSIC_LIBRARY_DIR to build file_name under config.moviesDir; the originals are
  -- never touched. file_name/error are set once rendering finishes (success/failure respectively).
  CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('rendering', 'ready', 'failed')),
    file_name TEXT,
    error TEXT,
    photo_count INTEGER NOT NULL,
    seconds_per_photo REAL NOT NULL,
    music_track TEXT,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- history the way task completions or bank transactions do. See services/groceryEmail.ts for
  -- the nightly digest this feeds.
  CREATE TABLE IF NOT EXISTS grocery_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity TEXT,
    requested_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    meal_id TEXT REFERENCES meals(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

// Databases created before spending categories existed (bank_transactions predates bank_goals by
// one release) need this added on — NULL/empty groups into "Other" in the spending graphs.
try {
  db.exec('ALTER TABLE bank_transactions ADD COLUMN category TEXT');
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
// before multi-assignee tasks), and/or before it included time_of_day (i.e. before multiple
// times-a-day slots), need the table rebuilt — SQLite has no ALTER TABLE for changing a UNIQUE
// constraint. Detect the *actual columns present* via PRAGMA table_info — not by string-matching
// the raw CREATE TABLE sql, which broke the first time a second migration changed that text (the
// first migration's check no longer matched once the constraint grew a 4th column, so it kept
// "detecting" itself as not-yet-run on every single boot and rebuilding back to the 3-column
// shape — which throws if anyone has two completions for the same task/date/person differing only
// by time_of_day, i.e. exactly what multi-slot tasks produce. Fixed here; PRAGMA table_info checks
// actual schema state, so it can't drift out of sync with what any later migration's DDL says.
function taskCompletionsColumns(): Set<string> {
  const rows = db.prepare('PRAGMA table_info(task_completions)').all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

if (!taskCompletionsColumns().has('completed_by_id')) {
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

if (!taskCompletionsColumns().has('time_of_day')) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE task_completions_new2 (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        completed_on TEXT NOT NULL,
        completed_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        time_of_day TEXT,
        UNIQUE(task_id, completed_on, completed_by_id, time_of_day)
      );
      INSERT INTO task_completions_new2 (id, task_id, completed_on, completed_by_id, completed_at)
        SELECT id, task_id, completed_on, completed_by_id, completed_at FROM task_completions;
      DROP TABLE task_completions;
      ALTER TABLE task_completions_new2 RENAME TO task_completions;
    `);
  })();
}

// Which visual style (see client/src/utils/progressStyles.ts) this person's Family Board
// progress bars use. NULL = the default plain style.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN progress_bar_style TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Course category (see client/src/utils/recipeCategories.ts for the preset list) — lets the meal
// planner group recipes by course when picking one for a meal. NULL/empty groups into "Other".
try {
  db.exec('ALTER TABLE recipes ADD COLUMN category TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Lets a parent reorder the profile switcher / Settings roster / Family Board columns (see
// routes/familyMembers.ts's POST /reorder) instead of being stuck with arrival order. Backfilled
// from the existing created_at order so nothing visibly reshuffles the first time this runs.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE family_members SET sort_order = (
      SELECT COUNT(*) FROM family_members AS earlier
      WHERE earlier.created_at < family_members.created_at
         OR (earlier.created_at = family_members.created_at AND earlier.id < family_members.id)
    )
  `);
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Where the nightly grocery-list digest goes (services/groceryEmail.ts) — every parent with one
// set gets it. NULL/empty = doesn't receive it; nothing else in the app currently uses this.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN email TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// The "Adventure Map" progress_bar_style (client/src/utils/progressStyles.ts) needs a start/end
// icon per person — NULL falls back to a default (🏠/🏰) client-side, so this never needs backfilling.
// These three columns are the Chores bar's settings specifically (progress_bar_style/
// adventure_start_icon/adventure_end_icon predate the chore-vs-to-do split below, so they kept
// their original names rather than being renamed and re-migrated — nothing here touches their
// existing values, just narrows what they're understood to mean).
try {
  db.exec('ALTER TABLE family_members ADD COLUMN adventure_start_icon TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}
try {
  db.exec('ALTER TABLE family_members ADD COLUMN adventure_end_icon TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// The To-dos bar's own independent style/icons — Chores and To-dos can now look completely
// different (e.g. Adventure Map with a castle for Chores, plain Rainbow for To-dos). Backfilled
// from the existing chore-scoped columns (one-time, only on the actual first run of this
// migration — see the sort_order migration above for the same pattern) so a family that already
// picked a style/icons keeps seeing exactly that on both bars, instead of To-dos silently
// reverting to the plain default the moment these columns exist.
try {
  db.exec('ALTER TABLE family_members ADD COLUMN todo_progress_bar_style TEXT');
  db.exec('ALTER TABLE family_members ADD COLUMN todo_adventure_start_icon TEXT');
  db.exec('ALTER TABLE family_members ADD COLUMN todo_adventure_end_icon TEXT');
  db.exec(`
    UPDATE family_members SET
      todo_progress_bar_style = progress_bar_style,
      todo_adventure_start_icon = adventure_start_icon,
      todo_adventure_end_icon = adventure_end_icon
  `);
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// A chore/to-do's own icon — the Adventure Map progress bar's per-task checkpoint marker (falls
// back to a generic icon by kind client-side, see client/src/utils/taskIcons.ts, if unset).
try {
  db.exec('ALTER TABLE tasks ADD COLUMN icon TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// A contact's email-to-SMS gateway domain (e.g. "vtext.com" for Verizon) — lets the Contacts page
// text them from a desktop/kiosk browser, where a plain sms: link has nothing to hand off to. See
// services/contactText.ts. NULL = that option just doesn't show for this contact.
try {
  db.exec('ALTER TABLE contacts ADD COLUMN carrier TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Live render progress (0-100), parsed from ffmpeg's own -progress output — see
// services/movieRender.ts. NULL before rendering starts writing any progress, or once a movie is
// no longer 'rendering' (the client only ever reads this while it is).
try {
  db.exec('ALTER TABLE movies ADD COLUMN progress_percent REAL');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Every music track a movie plays, in order, as a JSON array of library-relative paths — a movie
// can now string several tracks together. music_track stays as the first of them, so movies made
// before this column existed (one track at most) still read correctly.
try {
  db.exec('ALTER TABLE movies ADD COLUMN music_tracks TEXT');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// What a movie was made from, so it can be edited and re-rendered later: photo_paths is a JSON
// array of photo paths relative to PHOTOS_DIR (in play order), music_track_details a JSON array of
// the tracks' {file, title, artist, duration} as picked. NULL for movies made before this existed.
// options: the movie's style (services/movieRender.ts's MovieStyle, as stored by routes/movies.ts);
// photo_captions: { relative photo path: caption }. NULL on older movies = plain cuts, no captions.
for (const column of ['photo_paths TEXT', 'music_track_details TEXT', 'options TEXT', 'photo_captions TEXT']) {
  try {
    db.exec(`ALTER TABLE movies ADD COLUMN ${column}`);
  } catch (err) {
    if (!(err as Error).message.includes('duplicate column')) throw err;
  }
}

// Auto-saved, not-yet-rendered movie maker forms (routes/movies.ts's /drafts), so a half-built movie
// survives the screensaver, a closed browser, or switching screens. movie_id set = unsaved edits to
// that existing movie (at most one per movie); NULL = a new movie in progress. state is the form,
// as JSON, exactly as the client saved it.
db.exec(`
  CREATE TABLE IF NOT EXISTS movie_drafts (
    id TEXT PRIMARY KEY,
    movie_id TEXT REFERENCES movies(id) ON DELETE CASCADE,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Photo documents (routes/photoDocuments.ts): a title plus sections of text and pictures, turned
// into a .docx on download. content is JSON — see services/photoDocument.ts's DocumentContent.
db.exec(`
  CREATE TABLE IF NOT EXISTS photo_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Photo albums (routes/albums.ts) — named collections of photos kept purely in this database: an
// album item is just a path relative to PHOTOS_DIR, so the files on the share are never moved,
// copied, or touched. The built-in Favorites album (is_favorites = 1, id 'favorites') always exists
// and can't be renamed or deleted.
db.exec(`
  CREATE TABLE IF NOT EXISTS photo_albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_favorites INTEGER NOT NULL DEFAULT 0,
    created_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS photo_album_items (
    album_id TEXT NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (album_id, path)
  );
  INSERT OR IGNORE INTO photo_albums (id, name, is_favorites, created_at) VALUES ('favorites', 'Favorites', 1, datetime('now'));

  -- Per-photo fingerprint (64-bit difference hash, hex) and sharpness score, for spotting
  -- near-duplicates and blurry shots (services/photoAnalysis.ts). mtime_ms re-analyzes a photo
  -- that's been replaced in place.
  CREATE TABLE IF NOT EXISTS photo_analysis (
    path TEXT PRIMARY KEY,
    mtime_ms REAL NOT NULL,
    dhash TEXT NOT NULL,
    sharpness REAL NOT NULL,
    pixels INTEGER NOT NULL DEFAULT 0
  );
`);

// Hidden photos (routes/photos.ts): photos someone's marked to keep out of sight — out of the
// Photos grid unless "Show hidden" is on, and out of the slideshow, On this day, and the movie/
// document pickers. Just a note of the path; the file itself is never touched.
db.exec(`
  CREATE TABLE IF NOT EXISTS hidden_photos (
    path TEXT PRIMARY KEY,
    hidden_at TEXT NOT NULL
  );
`);

// Face recognition (services/faces/) — opt-in (setting faces_enabled), all on this machine.
//   people:          named people (not necessarily family members — grandparents, friends…)
//   faces:           every face found in a photo: box (fractions of the upright image), the 128-number
//                    "faceprint" (embedding, float32 BLOB), and who it is — person_id with confirmed = 1
//                    once someone's said so; suggestions are worked out on the fly, never stored.
//   face_rejections: "that's not Sam" — keeps a suggestion from coming back.
//   face_scans:      which photos have been looked at (mtime_ms re-scans a replaced photo).
db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,
    score REAL NOT NULL,
    embedding BLOB NOT NULL,
    person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
    confirmed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS faces_path ON faces(path);
  CREATE INDEX IF NOT EXISTS faces_person ON faces(person_id);
  CREATE TABLE IF NOT EXISTS face_rejections (
    face_id INTEGER NOT NULL REFERENCES faces(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (face_id, person_id)
  );
  CREATE TABLE IF NOT EXISTS face_scans (
    path TEXT PRIMARY KEY,
    mtime_ms REAL NOT NULL,
    faces INTEGER NOT NULL,
    scanned_at TEXT NOT NULL
  );
`);

// Internet controls (Pi-hole) — see services/internetControl.ts and docs/PIHOLE_SETUP.md. This app
// is the source of truth for who owns which device and each person's rules; Pi-hole just gets told
// the result (which of this app's groups each device should be in) every minute.
db.exec(`
  -- A device (by MAC address, or IP if it has a fixed one) and whose it is. family_member_id NULL =
  -- known but not assigned to anyone, so no family rules apply to it.
  CREATE TABLE IF NOT EXISTS internet_devices (
    id TEXT PRIMARY KEY,
    client TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    family_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Per-person state. paused_until: a manual pause (ISO time, far future = until resumed).
  -- allowed_until: internet allowed even during a scheduled block (bonus time / "resume" during
  -- bedtime). filtered: their devices get the kids' web filter.
  CREATE TABLE IF NOT EXISTS internet_members (
    family_member_id TEXT PRIMARY KEY REFERENCES family_members(id) ON DELETE CASCADE,
    filtered INTEGER NOT NULL DEFAULT 0,
    paused_until TEXT,
    allowed_until TEXT
  );

  -- Recurring "no internet" windows, e.g. bedtime. days = comma-separated weekday numbers the
  -- window *starts* on (0 = Sunday); an end time at or before the start time runs past midnight.
  CREATE TABLE IF NOT EXISTS internet_schedules (
    id TEXT PRIMARY KEY,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT '',
    days TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  -- A kid's own approved sites, for "approved sites only" mode.
  CREATE TABLE IF NOT EXISTS internet_member_sites (
    id TEXT PRIMARY KEY,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (family_member_id, domain)
  );

  -- Sites always allowed (even while paused/filtered) or always blocked for filtered members.
  CREATE TABLE IF NOT EXISTS internet_sites (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('allow', 'block')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (domain, kind)
  );
`);

// Internet "approved sites only" mode (services/internetControl.ts) — added after internet_members
// shipped, hence a migration rather than part of its CREATE TABLE.
try {
  db.exec('ALTER TABLE internet_members ADD COLUMN approved_only INTEGER NOT NULL DEFAULT 0');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
}

// Internet: daily time allowance, earning time from chores, and requests (services/internetControl.ts,
// services/internetUsage.ts). daily_minutes/weekend_minutes NULL = no limit that day type;
// minutes_per_chore = bonus minutes per chore/to-do finished today; extra_minutes applies only on
// extra_minutes_day (a parent's "+30 min today").
for (const column of [
  'daily_minutes INTEGER',
  'weekend_minutes INTEGER',
  'minutes_per_chore INTEGER NOT NULL DEFAULT 0',
  'extra_minutes INTEGER NOT NULL DEFAULT 0',
  'extra_minutes_day TEXT',
]) {
  try {
    db.exec(`ALTER TABLE internet_members ADD COLUMN ${column}`);
  } catch (err) {
    if (!(err as Error).message.includes('duplicate column')) throw err;
  }
}
db.exec(`
  -- Minutes a member was actually online, per local day (YYYY-MM-DD).
  CREATE TABLE IF NOT EXISTS internet_usage (
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (family_member_id, day)
  );
  -- Lookups per site per member per day, for the weekly report (pruned after 60 days).
  CREATE TABLE IF NOT EXISTS internet_site_counts (
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    site TEXT NOT NULL,
    lookups INTEGER NOT NULL DEFAULT 0,
    blocked INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (family_member_id, day, site)
  );
  -- A kid asking a parent for more time or for a website.
  CREATE TABLE IF NOT EXISTS internet_requests (
    id TEXT PRIMARY KEY,
    family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('time', 'site')),
    minutes INTEGER,
    domain TEXT,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
`);

export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}
