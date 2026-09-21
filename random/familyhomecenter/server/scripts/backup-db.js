#!/usr/bin/env node
// Backs up the family data: the SQLite database (via better-sqlite3's online backup API, safe to
// run while the server is up — no need to stop it, and it's consistent even with WAL/concurrent
// writes) plus the avatars/sounds folders (uploaded photos and completion-sound MP3s, which live
// outside the database). Run with `npm run backup` from server/, or straight:
//   node scripts/backup-db.js [--keep N]
//
// Restoring: stop the server, replace server/data/familyhomecenter.db (and the avatars/sounds
// folders, if you want those back too) with the ones from a backup folder, then start it again.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'familyhomecenter.db');
const backupsRoot = path.join(dataDir, 'backups');

const keepArgIndex = process.argv.indexOf('--keep');
const keepCount = keepArgIndex !== -1 ? Number(process.argv[keepArgIndex + 1]) || 14 : 14;

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`No database found at ${dbPath} — nothing to back up yet.`);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(backupsRoot, timestamp);
  await fsp.mkdir(destDir, { recursive: true });

  console.log(`Backing up database to ${destDir}/familyhomecenter.db ...`);
  const db = new Database(dbPath, { readonly: true });
  await db.backup(path.join(destDir, 'familyhomecenter.db'));
  db.close();

  for (const dir of ['avatars', 'sounds']) {
    const src = path.join(dataDir, dir);
    if (fs.existsSync(src)) {
      console.log(`Copying ${dir}/ ...`);
      await fsp.cp(src, path.join(destDir, dir), { recursive: true });
    }
  }

  console.log(`Done: ${destDir}`);

  // Keep only the most recent `keepCount` backups so this doesn't grow the SD card forever.
  const entries = (await fsp.readdir(backupsRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // ISO timestamps sort chronologically as strings
  const toRemove = entries.slice(0, Math.max(0, entries.length - keepCount));
  for (const name of toRemove) {
    await fsp.rm(path.join(backupsRoot, name), { recursive: true, force: true });
    console.log(`Pruned old backup: ${name}`);
  }
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
