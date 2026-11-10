import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * 💾 What the backups are doing, for the Settings card. Read-only: it only reads files.
 * - The Pi's nightly backup to the backup drive (docs/STORAGE_DRIVES.md) writes status.json and
 *   check.json into BACKUP_STATUS_DIR (default /var/lib/fhc-backup).
 * - The app's own backup (docs/BACKUP.md) makes timestamped folders in server/data/backups/.
 * - The share drive's free space, when SHARE_DIR (default /share) is a mounted drive.
 */
const STATUS_DIR = process.env.BACKUP_STATUS_DIR ?? '/var/lib/fhc-backup';
const SHARE_DIR = process.env.SHARE_DIR ?? '/share';

export interface RunStatus {
  result: 'ok' | 'warning' | 'failed' | string;
  message: string;
  finished_at: string | null;
  backup_drive_used_pct?: number | null;
}

async function readStatus(file: string): Promise<RunStatus | null> {
  try {
    const raw = await fsp.readFile(path.join(STATUS_DIR, file), 'utf8');
    if (raw.length > 20_000) return null;
    const j = JSON.parse(raw) as Partial<RunStatus>;
    return {
      result: String(j.result ?? 'unknown'),
      message: String(j.message ?? '').slice(0, 1000),
      finished_at: typeof j.finished_at === 'string' ? j.finished_at : null,
      backup_drive_used_pct: typeof j.backup_drive_used_pct === 'number' ? j.backup_drive_used_pct : null,
    };
  } catch {
    return null;
  }
}

/** The newest folder the app's own backup made (names are ISO timestamps with : and . as -). */
async function latestAppBackup(): Promise<{ name: string; at: string } | null> {
  const root = path.join(config.dataDir, 'backups');
  try {
    const names = (await fsp.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const name = names[names.length - 1];
    if (!name) return null;
    const st = await fsp.stat(path.join(root, name));
    return { name, at: st.mtime.toISOString() };
  } catch {
    return null;
  }
}

/** Is `dir` a mount point of its own (from /proc/mounts)? */
function isMount(dir: string): boolean {
  try {
    const unesc = (s: string) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
    return fsSync
      .readFileSync('/proc/mounts', 'utf8')
      .split('\n')
      .some((l) => unesc(l.split(' ')[1] ?? '') === dir);
  } catch {
    return false;
  }
}

async function shareSpace(): Promise<{ dir: string; size_bytes: number; free_bytes: number } | null> {
  if (!isMount(SHARE_DIR)) return null;
  const statfs = (fsp as unknown as { statfs?: (p: string) => Promise<{ bsize: number; blocks: number; bavail: number }> }).statfs;
  if (!statfs) return null;
  try {
    const s = await statfs(SHARE_DIR);
    return { dir: SHARE_DIR, size_bytes: s.blocks * s.bsize, free_bytes: s.bavail * s.bsize };
  } catch {
    return null;
  }
}

export async function backupStatus() {
  const [nightly, check, app, share] = await Promise.all([readStatus('status.json'), readStatus('check.json'), latestAppBackup(), shareSpace()]);
  return { status_dir: STATUS_DIR, configured: nightly !== null || check !== null, nightly, check, app_backup: app, share };
}
