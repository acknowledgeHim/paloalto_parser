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

  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT NOT NULL,
    completed_by_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, completed_on)
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
`);

// Simple migration for databases created before for_member_id existed — SQLite has no
// "ADD COLUMN IF NOT EXISTS", so just try it and ignore the "duplicate column" error.
try {
  db.exec('ALTER TABLE local_events ADD COLUMN for_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL');
} catch (err) {
  if (!(err as Error).message.includes('duplicate column')) throw err;
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
