import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db, getSetting, setSetting } from '../db.js';

/**
 * 📹 Looking after the cameras' clips on the Pi. Nothing here ever removes a clip by itself.
 *  1. Compress (on unless a parent turns it off): a clip older than 24h — a folder of JPEGs, one a
 *     second — becomes one small video (MP4/H.264, or WebM if this ffmpeg can't make MP4), usually
 *     80–95% smaller (zipping JPEGs would only save a couple of percent). Its first picture is kept
 *     as the thumbnail. Every 10 minutes.
 *  2. Free space: Settings → 📹 Cameras warns when the disk has less than the minimum free (8 GB
 *     unless changed). A parent can back up, download older clips as a zip, and then remove them.
 *     Below 1 GB free, new movement simply isn't saved (so the Pi itself never fills up).
 *  3. Back up: with an SMB share set up and "automatically" on, compressed clips not yet copied
 *     go to the share hourly (smbclient); "Back up now" any time.
 */

export interface ClipRow {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string;
  frames: number;
  hidden_at: string | null;
  archive_file: string | null;
  archived_at: string | null;
  archive_error: string | null;
  bytes: number | null;
  backed_up_at: string | null;
  purged_at: string | null;
}

const GB = 1024 ** 3;
const ARCHIVE_AFTER_MS = 24 * 3600_000;
const LOOP_MS = 10 * 60_000;
const BACKUP_EVERY_MS = 60 * 60_000;
/** Below this, new movement isn't saved at all (the purge can't keep up, or there's nothing to purge). */
const HARD_FLOOR = 1 * GB;

const nowIso = () => new Date().toISOString();
export const minFreeBytes = () => Math.max(1, Number(getSetting('camera_min_free_gb')) || 8) * GB;

export function diskSpace(): { free: number; total: number } {
  fs.mkdirSync(config.camerasDir, { recursive: true });
  const s = fs.statfsSync(config.camerasDir);
  return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
}

let spaceCache = { ok: true, at: 0 };
/** Is there room to save more movement? (Checked at most once a minute; starts a purge if low.) */
export function roomToSave(): boolean {
  if (Date.now() - spaceCache.at < 60_000) return spaceCache.ok;
  let free = Infinity;
  try {
    free = diskSpace().free;
  } catch {
    /* can't tell — keep saving */
  }
  spaceCache = { ok: free > HARD_FLOOR, at: Date.now() };
  if (!spaceCache.ok) console.warn(`[cameras] Only ${(free / GB).toFixed(1)} GB free — not saving movement until there's room.`);
  return spaceCache.ok;
}

/** The folder of pictures for a clip (while it isn't compressed yet). */
export function clipFolder(c: Pick<ClipRow, 'id' | 'device_id'>): string | null {
  const base = path.join(config.camerasDir, c.device_id);
  try {
    const dir = fs.readdirSync(base).find((n) => n.endsWith(`_${c.id.slice(0, 8)}`) && fs.statSync(path.join(base, n)).isDirectory());
    return dir ? path.join(base, dir) : null;
  } catch {
    return null;
  }
}

/** The compressed video's path, and its thumbnail next to it. */
export const archivePath = (c: Pick<ClipRow, 'archive_file'>) => (c.archive_file ? path.join(config.camerasDir, c.archive_file) : null);
export const thumbPath = (c: Pick<ClipRow, 'archive_file'>) => (c.archive_file ? path.join(config.camerasDir, c.archive_file.replace(/\.(mp4|webm)$/, '.jpg')) : null);

function sizeOf(p: string): number {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((n, f) => n + sizeOf(path.join(p, f)), 0);
  } catch {
    return 0;
  }
}
export function clipBytes(c: ClipRow): number {
  if (c.archive_file) return sizeOf(archivePath(c)!) + sizeOf(thumbPath(c)!);
  const dir = clipFolder(c);
  return dir ? sizeOf(dir) : 0;
}

// ---- 1. Compress ----

/** Pipes the JPEGs into ffmpeg (works with any ffmpeg that reads JPEGs, even a minimal one). */
function encode(frames: string[], out: string, kind: 'mp4' | 'webm'): Promise<void> {
  const codec =
    kind === 'mp4'
      ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
      : ['-c:v', 'libvpx', '-b:v', '0', '-crf', '30', '-deadline', 'good', '-cpu-used', '4'];
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '2', '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', ...codec, '-an', out];
  return new Promise((resolve, reject) => {
    const proc = spawn(config.movies.ffmpegPath, args);
    let err = '';
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 && fs.existsSync(out) && fs.statSync(out).size > 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `ffmpeg exited ${code}`))));
    proc.stdin.on('error', () => {});
    (async () => {
      for (const f of frames) {
        const buf = await fs.promises.readFile(f);
        if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
      }
      proc.stdin.end();
    })().catch(() => proc.kill());
  });
}

async function compressClip(c: ClipRow): Promise<void> {
  const dir = clipFolder(c);
  if (!dir) {
    db.prepare('UPDATE camera_clips SET archive_error = ? WHERE id = ?').run('pictures not found', c.id);
    return;
  }
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(dir, f));
  if (!frames.length) {
    db.prepare('UPDATE camera_clips SET archive_error = ? WHERE id = ?').run('no pictures', c.id);
    return;
  }
  let file = '';
  let lastErr: Error | null = null;
  for (const kind of ['mp4', 'webm'] as const) {
    const out = `${dir}.${kind}`;
    try {
      await encode(frames, out, kind);
      file = out;
      break;
    } catch (err) {
      lastErr = err as Error;
      fs.rmSync(out, { force: true });
    }
  }
  if (!file) {
    db.prepare('UPDATE camera_clips SET archive_error = ? WHERE id = ?').run(String(lastErr?.message ?? 'ffmpeg failed').slice(0, 300), c.id);
    console.error(`[cameras] Could not compress clip ${c.id}: ${lastErr?.message}`);
    return;
  }
  fs.copyFileSync(frames[0], `${dir}.jpg`);
  const before = sizeOf(dir);
  const rel = path.relative(config.camerasDir, file);
  db.prepare('UPDATE camera_clips SET archive_file = ?, archived_at = ?, archive_error = NULL, bytes = ? WHERE id = ?').run(rel, nowIso(), sizeOf(file) + sizeOf(`${dir}.jpg`), c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[cameras] Compressed a clip: ${(before / 1e6).toFixed(1)} MB of pictures → ${(sizeOf(file) / 1e6).toFixed(1)} MB ${path.extname(file).slice(1)}.`);
}

export async function compressOldClips(olderThanMs = ARCHIVE_AFTER_MS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = db
    .prepare('SELECT * FROM camera_clips WHERE archive_file IS NULL AND archive_error IS NULL AND purged_at IS NULL AND ended_at < ? ORDER BY started_at LIMIT 200')
    .all(cutoff) as ClipRow[];
  for (const c of rows) await compressClip(c);
  return rows.length;
}

// ---- 2. Free space: warn, and let a parent remove what they've saved ----
// Nothing is ever removed by itself. Settings → 📹 Cameras warns when the disk has less than the
// minimum free (8 GB unless a parent changes it); a parent can back up to the SMB share or download
// older clips as a zip, then choose to remove them.

/** Is the disk below the minimum free? (For the warning.) */
export function lowOnSpace(): { low: boolean; free: number; min: number } {
  const min = minFreeBytes();
  try {
    const { free } = diskSpace();
    return { low: free < min, free, min };
  } catch {
    return { low: false, free: 0, min };
  }
}

// Filesystem ids of network shares (SMB/CIFS, NFS): files there are never removed from here.
const NETWORK_FS = new Set([0xff534d42, 0xfe534d42, 0x517b, 0x6969]);
/** Does the clips folder live on a network share (e.g. CAMERAS_DIR pointed at a mounted SMB share)? */
export function onNetworkShare(): boolean {
  try {
    fs.mkdirSync(config.camerasDir, { recursive: true });
    return NETWORK_FS.has(Number(fs.statfsSync(config.camerasDir).type));
  } catch {
    return false;
  }
}

/**
 * A parent removes clips that started before `before` — by default only ones already backed up to
 * the share or downloaded. The rows stay (purged_at) and camera_purges records it.
 */
export function removeClips(before: string, onlySaved: boolean, by: string, dryRun = false): { clips: number; bytes: number; skipped: number } {
  const all = db.prepare('SELECT * FROM camera_clips WHERE purged_at IS NULL AND started_at < ? AND ended_at < ? ORDER BY started_at').all(before, new Date(Date.now() - 60_000).toISOString()) as Array<
    ClipRow & { downloaded_at: string | null }
  >;
  if (dryRun) {
    const pick = onlySaved ? all.filter((c) => c.backed_up_at || c.downloaded_at) : all;
    return { clips: pick.length, bytes: pick.reduce((t, c) => t + clipBytes(c), 0), skipped: all.length - pick.length };
  }
  if (onNetworkShare()) throw new Error('These clips are on a network (SMB) share — files on a share are never removed from here.');
  const rows = onlySaved ? all.filter((c) => c.backed_up_at || c.downloaded_at) : all;
  const before_ = diskSpace().free;
  let bytes = 0;
  const reason = `Removed by ${by}${onlySaved ? ' (backed up or downloaded first)' : ''}`;
  for (const c of rows) {
    bytes += clipBytes(c);
    for (const p of [archivePath(c), thumbPath(c), clipFolder(c)]) if (p) fs.rmSync(p, { recursive: true, force: true });
    db.prepare('UPDATE camera_clips SET purged_at = ?, purge_reason = ? WHERE id = ?').run(nowIso(), reason, c.id);
  }
  if (rows.length) {
    const names = db.prepare('SELECT id, name FROM camera_devices').all() as Array<{ id: string; name: string }>;
    db.prepare(
      `INSERT INTO camera_purges (id, at, clips, bytes, backed_up, first_at, last_at, cameras, free_before, free_after, min_free, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      nowIso(),
      rows.length,
      bytes,
      rows.filter((c) => c.backed_up_at || c.downloaded_at).length,
      rows[0].started_at,
      rows[rows.length - 1].started_at,
      [...new Set(rows.map((r) => names.find((n) => n.id === r.device_id)?.name ?? 'Camera'))].join(', '),
      before_,
      diskSpace().free,
      minFreeBytes(),
      reason
    );
    console.log(`[cameras] ${reason}: ${rows.length} clip(s), ${(bytes / 1e9).toFixed(2)} GB.`);
  }
  spaceCache.at = 0;
  return { clips: rows.length, bytes, skipped: all.length - rows.length };
}

// ---- 3. Back up to an SMB share ----

export interface SmbSettings {
  share: string;
  folder: string;
  user: string;
  domain: string;
  pass: string;
  auto: boolean;
}
export function smbSettings(): SmbSettings {
  return {
    share: getSetting('camera_smb_share'),
    folder: getSetting('camera_smb_folder'),
    user: getSetting('camera_smb_user'),
    domain: getSetting('camera_smb_domain'),
    pass: getSetting('camera_smb_pass'),
    auto: getSetting('camera_smb_auto') === '1',
  };
}

/** "\\server\share" or "smb://server/share" → "//server/share". */
export function normalShare(s: string): string {
  const rest = s.trim().replace(/^smb:/i, '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return rest ? `//${rest}` : '';
}

const AUTH_FILE = () => path.join(config.dataDir, '.camera-smb-auth');
function writeAuth(s: SmbSettings) {
  const lines = [`username = ${s.user || 'guest'}`, `password = ${s.pass}`];
  if (s.domain) lines.push(`domain = ${s.domain}`);
  fs.writeFileSync(AUTH_FILE(), lines.join('\n') + '\n', { mode: 0o600 });
}

const SMBCLIENT = process.env.SMBCLIENT_PATH ?? 'smbclient';
/** Runs one smbclient command against the share; fails on an NT_STATUS error even if it exits 0. */
function smb(s: SmbSettings, command: string, timeoutMs = 120_000): Promise<string> {
  writeAuth(s);
  return new Promise((resolve, reject) => {
    execFile(SMBCLIENT, [normalShare(s.share), '-A', AUTH_FILE(), '-c', command], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = `${stdout}\n${stderr}`;
      const status = out.match(/NT_STATUS_[A-Z_]+/)?.[0];
      if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') return reject(new Error('smbclient is not installed on the Pi — run: sudo apt install smbclient'));
      if (err || status) return reject(new Error(status ? friendlyStatus(status) : (stderr || err!.message).trim().split('\n').pop()!));
      resolve(out);
    });
  });
}
function friendlyStatus(s: string): string {
  const m: Record<string, string> = {
    NT_STATUS_LOGON_FAILURE: 'The username or password was not accepted (NT_STATUS_LOGON_FAILURE)',
    NT_STATUS_BAD_NETWORK_NAME: 'That share name was not found on the server (NT_STATUS_BAD_NETWORK_NAME)',
    NT_STATUS_ACCESS_DENIED: 'Access denied — check the account can write to the share (NT_STATUS_ACCESS_DENIED)',
    NT_STATUS_HOST_UNREACHABLE: 'Could not reach the server (NT_STATUS_HOST_UNREACHABLE)',
    NT_STATUS_IO_TIMEOUT: 'The server did not answer (NT_STATUS_IO_TIMEOUT)',
    NT_STATUS_CONNECTION_REFUSED: 'The server refused the connection (NT_STATUS_CONNECTION_REFUSED)',
    NT_STATUS_OBJECT_PATH_NOT_FOUND: 'That folder was not found on the share (NT_STATUS_OBJECT_PATH_NOT_FOUND)',
  };
  return m[s] ?? s;
}
const q = (s: string) => `"${s.replace(/"/g, '')}"`;
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Camera';

/** Can we write to the share? Makes the folder if needed and lists it. */
export async function testSmb(s = smbSettings()): Promise<string> {
  if (!s.share) throw new Error('Enter the share first, e.g. //192.168.1.20/backups');
  await ensureDirs(s, s.folder ? [s.folder] : [], new Set());
  const out = await smb(s, `${s.folder ? `cd ${q(s.folder)}; ` : ''}ls`, 30_000);
  const blocks = out.match(/(\d+) blocks of size (\d+)\. (\d+) blocks available/);
  return blocks ? `Connected ✓ — ${((Number(blocks[3]) * Number(blocks[2])) / GB).toFixed(0)} GB free on the share` : 'Connected ✓';
}

async function ensureDirs(s: SmbSettings, parts: string[], made: Set<string>) {
  let p = '';
  for (const part of parts.flatMap((x) => x.split('/')).filter(Boolean)) {
    p = p ? `${p}/${part}` : part;
    if (made.has(p)) continue;
    // Already there is fine.
    await smb(s, `mkdir ${q(p)}`, 30_000).catch((err: Error) => {
      if (!/COLLISION|already exists/i.test(err.message)) throw err;
    });
    made.add(p);
  }
}

let backingUp = false;
/** Copies every compressed clip not yet on the share. */
export async function backupClips(): Promise<{ sent: number; failed: number; error: string | null }> {
  if (backingUp) return { sent: 0, failed: 0, error: 'A backup is already running' };
  backingUp = true;
  const s = smbSettings();
  let sent = 0;
  let failed = 0;
  let error: string | null = null;
  try {
    if (!s.share) throw new Error('No SMB share set up');
    const rows = db
      .prepare('SELECT * FROM camera_clips WHERE archive_file IS NOT NULL AND backed_up_at IS NULL AND purged_at IS NULL ORDER BY started_at LIMIT 500')
      .all() as ClipRow[];
    const names = db.prepare('SELECT id, name FROM camera_devices').all() as Array<{ id: string; name: string }>;
    const made = new Set<string>();
    for (const c of rows) {
      const local = archivePath(c)!;
      if (!fs.existsSync(local)) continue;
      const day = c.started_at.slice(0, 10);
      const remoteDir = [s.folder, safeName(names.find((n) => n.id === c.device_id)?.name ?? 'Camera'), day].filter(Boolean).join('/');
      const remoteName = `${c.started_at.slice(11, 19).replace(/:/g, '-')}_${c.id.slice(0, 8)}${path.extname(local)}`;
      try {
        await ensureDirs(s, [remoteDir], made);
        await smb(s, `cd ${q(remoteDir)}; put ${q(local)} ${q(remoteName)}`, 10 * 60_000);
        db.prepare('UPDATE camera_clips SET backed_up_at = ? WHERE id = ?').run(nowIso(), c.id);
        sent++;
      } catch (err) {
        failed++;
        error = (err as Error).message;
        // The share is down or the login is wrong — no point trying the rest now.
        if (/LOGON|UNREACHABLE|TIMEOUT|REFUSED|BAD_NETWORK|not installed/i.test(error)) break;
      }
    }
  } catch (err) {
    error = (err as Error).message;
  } finally {
    backingUp = false;
  }
  setSetting('camera_backup_status', JSON.stringify({ at: nowIso(), sent, failed, error }));
  if (sent || error) console.log(`[cameras] Backup to SMB: ${sent} sent${failed ? `, ${failed} failed` : ''}${error ? ` — ${error}` : ''}.`);
  return { sent, failed, error };
}

// ---- The loop ----

let lastBackupTry = 0;
export async function cameraStorageTick(): Promise<void> {
  try {
    if (getSetting('camera_compress_off') !== '1') await compressOldClips();
  } catch (err) {
    console.error('[cameras] Compressing clips failed:', err);
  }
  const s = smbSettings();
  if (s.auto && s.share && Date.now() - lastBackupTry >= BACKUP_EVERY_MS) {
    lastBackupTry = Date.now();
    await backupClips();
  }
}

export function startCameraStorage(): void {
  setTimeout(() => void cameraStorageTick(), 30_000);
  setInterval(() => void cameraStorageTick(), LOOP_MS);
}

let smbclientCheck: Promise<boolean> | null = null;
export const smbclientInstalled = () =>
  (smbclientCheck ??= new Promise((resolve) => execFile(SMBCLIENT, ['--version'], (err) => resolve(!err || (err as NodeJS.ErrnoException).code !== 'ENOENT'))));

// ---- Download older clips as zips ----

/** The files of a clip, named for a zip: <camera>/<day>/<time>_<id>.mp4 (+ .jpg), or its pictures. */
export function clipFiles(c: ClipRow, camera: string): Array<{ name: string; path: string; size: number; mtime: Date }> {
  const base = `${safeName(camera)}/${c.started_at.slice(0, 10)}/${c.started_at.slice(11, 19).replace(/:/g, '-')}_${c.id.slice(0, 8)}`;
  const at = new Date(c.started_at);
  const one = (p: string | null, name: string) => {
    try {
      return p ? [{ name, path: p, size: fs.statSync(p).size, mtime: at }] : [];
    } catch {
      return [];
    }
  };
  if (c.archive_file) return [...one(archivePath(c), base + path.extname(c.archive_file)), ...one(thumbPath(c), `${base}.jpg`)];
  const dir = clipFolder(c);
  if (!dir) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .flatMap((f) => one(path.join(dir, f), `${base}/${f}`));
}

export interface ZipPart {
  part: number;
  clips: string[];
  first: string;
  last: string;
  bytes: number;
  files: number;
}

/** Clips that started before `before`, oldest first, split into zips that stay under 3.5 GB. */
export function downloadParts(before: string, maxBytes: number, maxFiles: number): ZipPart[] {
  const rows = db.prepare('SELECT * FROM camera_clips WHERE purged_at IS NULL AND started_at < ? ORDER BY started_at').all(before) as ClipRow[];
  const names = db.prepare('SELECT id, name FROM camera_devices').all() as Array<{ id: string; name: string }>;
  const parts: ZipPart[] = [];
  let cur: ZipPart | null = null;
  for (const c of rows) {
    const files = clipFiles(c, names.find((n) => n.id === c.device_id)?.name ?? 'Camera');
    if (!files.length) continue;
    const bytes = files.reduce((t, f) => t + f.size + f.name.length * 2 + 100, 0);
    if (!cur || cur.bytes + bytes > maxBytes || cur.files + files.length > maxFiles) {
      cur = { part: parts.length + 1, clips: [], first: c.started_at, last: c.started_at, bytes: 0, files: 0 };
      parts.push(cur);
    }
    cur.clips.push(c.id);
    cur.last = c.started_at;
    cur.bytes += bytes;
    cur.files += files.length;
  }
  return parts;
}
