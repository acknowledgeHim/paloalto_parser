#!/usr/bin/env node
// Backs up the family data:
//   - the SQLite database (via better-sqlite3's online backup API, safe to run while the server is
//     up — no need to stop it, and it's consistent even with WAL/concurrent writes). Everything the
//     app tracks lives in here: family, chores, meals, Prize Bank, calendar, photo albums, photo
//     documents, movie details/drafts, Internet settings and history.
//   - the upload folders that live outside the database: avatars/, sounds/, kb-media/ (Knowledge
//     Base pictures/videos)
//   - the .env file (passwords and setup — kept readable only by this user)
//   - with --with-movies, the rendered movie videos (movies/). Optional because videos are big;
//     each movie file is hard-linked to the previous backup's copy when it's already there (a
//     rendered movie never changes — re-rendering makes a new file), so nightly backups don't
//     multiply the space they take.
//
// Run with `npm run backup` from server/ (`npm run backup:all` adds movies), or straight:
//   node scripts/backup-db.js [--keep N] [--with-movies]
//
// Restoring: see docs/BACKUP.md.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'familyhomecenter.db');
const envPath = path.join(__dirname, '..', '..', '.env');
const backupsRoot = path.join(dataDir, 'backups');

const keepArgIndex = process.argv.indexOf('--keep');
const keepCount = keepArgIndex !== -1 ? Number(process.argv[keepArgIndex + 1]) || 14 : 14;
const withMovies = process.argv.includes('--with-movies');

/** The newest earlier backup that has a movies/ folder, to hard-link unchanged videos from. */
async function previousMoviesDir(currentName) {
  if (!fs.existsSync(backupsRoot)) return null;
  const names = (await fsp.readdir(backupsRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name < currentName)
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const name of names) {
    const dir = path.join(backupsRoot, name, 'movies');
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

async function backupMovies(destDir) {
  const src = path.join(dataDir, 'movies');
  if (!fs.existsSync(src)) {
    console.log('No movies/ folder yet — nothing to copy.');
    return;
  }
  const dest = path.join(destDir, 'movies');
  await fsp.mkdir(dest, { recursive: true });
  const previous = await previousMoviesDir(path.basename(destDir));
  let linked = 0;
  let copied = 0;
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    const earlier = previous && path.join(previous, entry.name);
    if (earlier && fs.existsSync(earlier) && (await fsp.stat(earlier)).size === (await fsp.stat(from)).size) {
      try {
        await fsp.link(earlier, to); // same file, no extra space
        linked++;
        continue;
      } catch {
        // e.g. a filesystem without hard links — fall back to a real copy
      }
    }
    await fsp.copyFile(from, to);
    copied++;
  }
  console.log(`Movies: ${copied} copied, ${linked} already in the previous backup (linked, no extra space).`);
}

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

  for (const dir of ['avatars', 'sounds', 'kb-media']) {
    const src = path.join(dataDir, dir);
    if (fs.existsSync(src)) {
      console.log(`Copying ${dir}/ ...`);
      await fsp.cp(src, path.join(destDir, dir), { recursive: true });
    }
  }

  if (fs.existsSync(envPath)) {
    console.log('Copying .env (readable only by you — it holds passwords) ...');
    await fsp.copyFile(envPath, path.join(destDir, '.env'));
    await fsp.chmod(path.join(destDir, '.env'), 0o600);
  }

  if (withMovies) await backupMovies(destDir);
  else console.log('Skipping movie videos (add --with-movies, or use `npm run backup:all`, to include them).');

  console.log(`Done: ${destDir}`);

  // Keep only the most recent `keepCount` backups so this doesn't grow the SD card forever. (Movie
  // files linked into several backups only free their space once the last backup holding them goes.)
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
