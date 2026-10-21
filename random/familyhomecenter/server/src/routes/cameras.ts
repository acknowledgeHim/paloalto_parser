import express, { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db, getSetting, setSetting } from '../db.js';
import { isParentRequest } from '../services/rewards.js';
import { isEmailConfigured, sendEmail } from '../services/email.js';
import type { FamilyMember } from '../types.js';
import { writeZip, ZIP_PART_MAX_BYTES, ZIP_PART_MAX_FILES } from '../utils/zipStream.js';
import {
  archivePath,
  backupClips,
  cameraStorageTick,
  clipBytes,
  clipFolder,
  diskSpace,
  clipFiles,
  downloadParts,
  lowOnSpace,
  minFreeBytes,
  normalShare,
  onNetworkShare,
  removeClips,
  roomToSave,
  smbclientInstalled,
  smbSettings,
  testSmb,
  thumbPath,
  type ClipRow,
} from '../services/cameraStorage.js';

/**
 * 📹 Cameras: a tablet on the wall doubles as a security camera. A parent turns a tablet into a
 * camera once (Settings → 📹 Cameras → "Use this device as a camera"); from then on the page on that
 * tablet checks in every few seconds and, while a parent has its camera on:
 *  - sends a frame a second whenever a parent is watching it live (📹 Cameras page), and
 *  - if "save movement" is on, watches for movement itself and sends frames while something moves —
 *    saved here as a clip, and the parents get an email with the first picture (at most every 10 min).
 * Everything a parent sees or changes goes through isParentRequest; a tablet only proves it's itself
 * with the token it was given when it was added. Nothing is ever deleted — taking a clip or a
 * camera away only hides it.
 */
export const camerasRouter = Router();

interface CameraDevice {
  id: string;
  token: string;
  name: string;
  user_agent: string | null;
  status: string | null;
  enabled: 0 | 1;
  facing: 'user' | 'environment';
  motion: 0 | 1;
  sensitivity: number;
  show_badge: 0 | 1;
  created_at: string;
  last_seen_at: string | null;
  hidden_at: string | null;
}

const ONLINE_MS = 20_000;
/** A parent watching keeps the tablet sending for this long after the last look. */
const WATCH_MS = 8_000;
/** Movement this long after the last movement frame starts a new clip. */
const CLIP_GAP_MS = 30_000;
const CLIP_MAX_FRAMES = 300;
const EMAIL_EVERY_MS = 10 * 60_000;
const STATUSES = ['ok', 'off', 'starting', 'needs-https', 'denied', 'no-camera', 'error'];

const latest = new Map<string, { jpeg: Buffer; at: number }>();
const viewers = new Map<string, Set<Response>>();
const lastLook = new Map<string, number>();
const openClip = new Map<string, { id: string; dir: string; frames: number; lastAt: number }>();
const lastEmail = new Map<string, number>();

const nowIso = () => new Date().toISOString();
const deviceById = (id: string) => db.prepare('SELECT * FROM camera_devices WHERE id = ?').get(id) as CameraDevice | undefined;
const acting = (req: Request) => (req.body?.acting_member_id ?? req.query.acting_member_id) as unknown;
const isWatched = (id: string) => (viewers.get(id)?.size ?? 0) > 0 || Date.now() - (lastLook.get(id) ?? 0) < WATCH_MS;

function sameToken(a: string, b: unknown): boolean {
  if (typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** What a tablet needs to know to do its job, sent back on every check-in and frame. */
function orders(d: CameraDevice) {
  return {
    id: d.id,
    name: d.name,
    enabled: d.enabled === 1 && !d.hidden_at,
    facing: d.facing,
    motion: d.motion === 1,
    sensitivity: d.sensitivity,
    show_badge: d.show_badge === 1,
    live: isWatched(d.id),
  };
}

/** For the parents' list: everything but the token, plus whether it's online and its clips. */
function publicView(d: CameraDevice) {
  const clips = db.prepare('SELECT COUNT(*) AS n, MAX(started_at) AS last FROM camera_clips WHERE device_id = ? AND hidden_at IS NULL AND purged_at IS NULL').get(d.id) as {
    n: number;
    last: string | null;
  };
  const { token: _token, ...rest } = d;
  return {
    ...rest,
    online: Boolean(d.last_seen_at && Date.now() - Date.parse(d.last_seen_at) < ONLINE_MS),
    watching: viewers.get(d.id)?.size ?? 0,
    has_frame: latest.has(d.id),
    clip_count: clips.n,
    last_clip_at: clips.last,
  };
}

function requireParent(req: Request, res: Response): boolean {
  if (isParentRequest(req, acting(req))) return true;
  res.status(403).json({ error: 'Cameras are for parents only' });
  return false;
}

function deviceFromToken(req: Request, res: Response): CameraDevice | null {
  const d = deviceById(req.params.id);
  if (!d || !sameToken(d.token, req.get('x-camera-token'))) {
    res.status(401).json({ error: 'Not this camera' });
    return null;
  }
  return d;
}

let storage = { bytes: 0, at: 0 };
function storageBytes(): number {
  if (Date.now() - storage.at < 60_000) return storage.bytes;
  let bytes = 0;
  const walk = (dir: string) => {
    let items: fs.Dirent[] = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) walk(p);
      else {
        try {
          bytes += fs.statSync(p).size;
        } catch {
          /* gone */
        }
      }
    }
  };
  walk(config.camerasDir);
  storage = { bytes, at: Date.now() };
  return bytes;
}

// ---- The tablet's side ----

/**
 * POST /hello { id?, token?, name?, status?, add? } — a tablet checking in. With `add` (a parent,
 * from Settings on that tablet) a new camera is made and its id/token handed back; otherwise the
 * id/token must match. Answers with what the tablet should be doing.
 */
camerasRouter.post('/hello', (req, res) => {
  const { id, token, name, status, add } = req.body ?? {};
  let d = typeof id === 'string' ? deviceById(id) : undefined;
  if (d && !sameToken(d.token, token)) d = undefined;
  if (!d) {
    if (!add) return res.status(404).json({ error: 'Not a camera (yet)' });
    if (!requireParent(req, res)) return;
    const row: CameraDevice = {
      id: uuidv4(),
      token: crypto.randomBytes(24).toString('hex'),
      name: String(name || 'Tablet').slice(0, 60),
      user_agent: String(req.get('user-agent') ?? '').slice(0, 300),
      status: 'off',
      enabled: 0,
      facing: 'user',
      motion: 0,
      sensitivity: 50,
      show_badge: 1,
      created_at: nowIso(),
      last_seen_at: nowIso(),
      hidden_at: null,
    };
    db.prepare(
      `INSERT INTO camera_devices (id, token, name, user_agent, status, enabled, facing, motion, sensitivity, show_badge, created_at, last_seen_at)
       VALUES (@id, @token, @name, @user_agent, @status, @enabled, @facing, @motion, @sensitivity, @show_badge, @created_at, @last_seen_at)`
    ).run(row);
    return res.status(201).json({ ...orders(row), token: row.token });
  }
  if (d.hidden_at && add) {
    if (!requireParent(req, res)) return;
    db.prepare('UPDATE camera_devices SET hidden_at = NULL WHERE id = ?').run(d.id);
    d = deviceById(d.id)!;
  }
  if (d.hidden_at) return res.status(410).json({ error: 'This camera was taken off' });
  db.prepare('UPDATE camera_devices SET last_seen_at = ?, status = ?, user_agent = ? WHERE id = ?').run(
    nowIso(),
    STATUSES.includes(status) ? status : d.status,
    String(req.get('user-agent') ?? '').slice(0, 300),
    d.id
  );
  res.json(orders(d));
});

/** POST /:id/frame?motion=1 (image/jpeg body, x-camera-token header) — one picture from the tablet. */
camerasRouter.post('/:id/frame', express.raw({ type: 'image/jpeg', limit: '3mb' }), (req, res) => {
  const d = deviceFromToken(req, res);
  if (!d) return;
  if (d.enabled !== 1 || d.hidden_at) return res.json(orders(d));
  const jpeg = req.body as Buffer;
  if (!Buffer.isBuffer(jpeg) || jpeg.length < 100 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return res.status(400).json({ error: 'Not a JPEG' });
  const now = Date.now();
  latest.set(d.id, { jpeg, at: now });
  db.prepare('UPDATE camera_devices SET last_seen_at = ?, status = ? WHERE id = ?').run(nowIso(), 'ok', d.id);
  for (const v of viewers.get(d.id) ?? []) writePart(v, jpeg);
  if (req.query.motion === '1' && d.motion === 1 && roomToSave()) saveMotionFrame(d, jpeg, now);
  res.json(orders(d));
});

function saveMotionFrame(d: CameraDevice, jpeg: Buffer, now: number) {
  let clip = openClip.get(d.id);
  if (!clip || now - clip.lastAt > CLIP_GAP_MS || clip.frames >= CLIP_MAX_FRAMES) {
    const id = uuidv4();
    const started = new Date(now).toISOString();
    clip = { id, dir: path.join(config.camerasDir, d.id, `${started.slice(0, 19).replace(/[:T]/g, '-')}_${id.slice(0, 8)}`), frames: 0, lastAt: now };
    fs.mkdirSync(clip.dir, { recursive: true });
    db.prepare('INSERT INTO camera_clips (id, device_id, started_at, ended_at, frames) VALUES (?, ?, ?, ?, 0)').run(id, d.id, started, started);
    openClip.set(d.id, clip);
    void motionEmail(d, jpeg, started);
  }
  clip.frames += 1;
  clip.lastAt = now;
  fs.writeFile(path.join(clip.dir, `${String(clip.frames).padStart(5, '0')}.jpg`), jpeg, (err) => err && console.error('[cameras] Could not save a frame:', err.message));
  db.prepare('UPDATE camera_clips SET ended_at = ?, frames = ? WHERE id = ?').run(new Date(now).toISOString(), clip.frames, clip.id);
}

async function motionEmail(d: CameraDevice, jpeg: Buffer, at: string) {
  if (getSetting('camera_motion_email_off') === '1' || !isEmailConfigured()) return;
  if (Date.now() - (lastEmail.get(d.id) ?? 0) < EMAIL_EVERY_MS) return;
  lastEmail.set(d.id, Date.now());
  const parents = (db.prepare("SELECT * FROM family_members WHERE is_parent = 1 AND email IS NOT NULL AND email != ''").all() as FamilyMember[]).map(
    (p) => p.email!
  );
  if (!parents.length) return;
  const when = new Date(at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  try {
    await sendEmail({
      to: parents.join(', '),
      subject: `📹 Movement: ${d.name} (${when})`,
      text: `The ${d.name} camera saw movement at ${when}. Open 📹 Cameras on the Family Home Center to watch the clip or look live.`,
      html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1d2939">
        <h2 style="margin:0 0 8px">📹 Movement: ${d.name.replace(/[<>&]/g, '')}</h2>
        <p>${when}</p><img src="cid:snap" style="max-width:100%;border-radius:8px" alt="">
        <p>Open <strong>📹 Cameras</strong> on the Family Home Center to watch the clip or look live.</p>
        <p style="color:#98a2b3;font-size:12px">At most one email every 10 minutes per camera. Turn these off in Settings → 📹 Cameras.</p></div>`,
      attachments: [{ filename: 'movement.jpg', content: jpeg, cid: 'snap', contentType: 'image/jpeg' }],
    });
    console.log(`[cameras] Emailed parents: movement on ${d.name}.`);
  } catch (err) {
    console.error('[cameras] Could not send the movement email:', err);
  }
}

// ---- The parents' side ----

/** GET / — the cameras, the movement-email switch and how much space clips take. */
camerasRouter.get('/', (req, res) => {
  if (!requireParent(req, res)) return;
  const rows = db.prepare('SELECT * FROM camera_devices WHERE hidden_at IS NULL ORDER BY created_at').all() as CameraDevice[];
  res.json({ cameras: rows.map(publicView), motion_email: getSetting('camera_motion_email_off') !== '1', storage_bytes: storageBytes() });
});

/** PATCH /settings { motion_email } */
camerasRouter.patch('/settings', (req, res) => {
  if (!requireParent(req, res)) return;
  if (req.body?.motion_email !== undefined) setSetting('camera_motion_email_off', req.body.motion_email ? '' : '1');
  res.json({ motion_email: getSetting('camera_motion_email_off') !== '1' });
});

/** PATCH /:id { name, enabled, facing, motion, sensitivity, show_badge } */
camerasRouter.patch('/:id', (req, res, nextRoute) => {
  if (req.params.id === 'storage') return nextRoute(); // PATCH /storage, below
  if (!requireParent(req, res)) return;
  const d = deviceById(req.params.id);
  if (!d || d.hidden_at) return res.status(404).json({ error: 'not found' });
  const b = req.body ?? {};
  const next = {
    name: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : d.name,
    enabled: b.enabled === undefined ? d.enabled : b.enabled ? 1 : 0,
    facing: b.facing === 'environment' || b.facing === 'user' ? b.facing : d.facing,
    motion: b.motion === undefined ? d.motion : b.motion ? 1 : 0,
    sensitivity: b.sensitivity === undefined ? d.sensitivity : Math.max(1, Math.min(100, Math.round(Number(b.sensitivity) || 50))),
    show_badge: b.show_badge === undefined ? d.show_badge : b.show_badge ? 1 : 0,
  };
  db.prepare('UPDATE camera_devices SET name = @name, enabled = @enabled, facing = @facing, motion = @motion, sensitivity = @sensitivity, show_badge = @show_badge WHERE id = @id').run({
    ...next,
    id: d.id,
  });
  if (!next.enabled) latest.delete(d.id);
  console.log(`[cameras] ${d.name}: ${next.enabled ? 'on' : 'off'}${next.motion ? ', saving movement' : ''}.`);
  res.json(publicView(deviceById(d.id)!));
});

/** POST /:id/hide — take a camera off the list (the tablet stops; its clips are kept). */
camerasRouter.post('/:id/hide', (req, res) => {
  if (!requireParent(req, res)) return;
  db.prepare('UPDATE camera_devices SET hidden_at = ?, enabled = 0 WHERE id = ?').run(nowIso(), req.params.id);
  latest.delete(req.params.id);
  for (const v of viewers.get(req.params.id) ?? []) v.end();
  res.json({ ok: true });
});

function writePart(res: Response, jpeg: Buffer) {
  res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
  res.write(jpeg);
  res.write('\r\n');
}

/** GET /:id/live — a live picture (MJPEG, for an <img>), for as long as it's open. */
camerasRouter.get('/:id/live', (req, res) => {
  if (!requireParent(req, res)) return;
  const d = deviceById(req.params.id);
  if (!d || d.hidden_at) return res.status(404).end();
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const set = viewers.get(d.id) ?? new Set<Response>();
  viewers.set(d.id, set);
  set.add(res);
  const last = latest.get(d.id);
  if (last) writePart(res, last.jpeg);
  req.on('close', () => {
    set.delete(res);
    lastLook.set(d.id, Date.now());
  });
});

/** GET /:id/snapshot.jpg — the newest picture (and keeps the tablet sending for a few seconds). */
camerasRouter.get('/:id/snapshot.jpg', (req, res) => {
  if (!requireParent(req, res)) return;
  lastLook.set(req.params.id, Date.now());
  const last = latest.get(req.params.id);
  if (!last) return res.status(404).end();
  res.type('image/jpeg').set('Cache-Control', 'no-store').send(last.jpeg);
});

/** GET /clips?device=&limit= — saved movement, newest first. */
camerasRouter.get('/clips', (req, res) => {
  if (!requireParent(req, res)) return;
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const rows =
    typeof req.query.device === 'string' && req.query.device
      ? db.prepare('SELECT * FROM camera_clips WHERE hidden_at IS NULL AND purged_at IS NULL AND device_id = ? ORDER BY started_at DESC LIMIT ?').all(req.query.device, limit)
      : db.prepare('SELECT * FROM camera_clips WHERE hidden_at IS NULL AND purged_at IS NULL ORDER BY started_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

const clipById = (id: string) => db.prepare('SELECT * FROM camera_clips WHERE id = ? AND purged_at IS NULL').get(id) as ClipRow | undefined;

/** GET /clips/:id/frames/:n.jpg — one picture of a clip (1-based). Once it's compressed only the first (its thumbnail) is kept. */
camerasRouter.get('/clips/:id/frames/:n.jpg', (req, res) => {
  if (!requireParent(req, res)) return;
  const c = clipById(req.params.id);
  const n = Math.max(1, Math.floor(Number(req.params.n) || 1));
  if (!c) return res.status(404).end();
  const file = c.archive_file ? (n === 1 ? thumbPath(c) : null) : (() => {
    const dir = clipFolder(c);
    return dir ? path.join(dir, `${String(n).padStart(5, '0')}.jpg`) : null;
  })();
  if (!file) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400').sendFile(file, (err) => err && !res.headersSent && res.status(404).end());
});

/** GET /clips/:id/video — the compressed clip (MP4 or WebM), once it's over a day old. */
camerasRouter.get('/clips/:id/video', (req, res) => {
  if (!requireParent(req, res)) return;
  const c = clipById(req.params.id);
  const file = c && archivePath(c);
  if (!file) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400').sendFile(file, (err) => err && !res.headersSent && res.status(404).end());
});

/** POST /clips/:id/hide — take a clip off the list (the pictures stay on the Pi). */
camerasRouter.post('/clips/:id/hide', (req, res) => {
  if (!requireParent(req, res)) return;
  db.prepare('UPDATE camera_clips SET hidden_at = ? WHERE id = ?').run(nowIso(), req.params.id);
  res.json({ ok: true });
});

// ---- 💾 Storage: compressing, keeping free space, and backing up to an SMB share ----

/** GET /storage — free space, the clips, what was cleared and why, and the backup setup (never the password). */
camerasRouter.get('/storage', async (req, res) => {
  if (!requireParent(req, res)) return;
  let disk = { free: 0, total: 0 };
  try {
    disk = diskSpace();
  } catch {
    /* unknown */
  }
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const live = 'purged_at IS NULL';
  const rows = db.prepare(`SELECT * FROM camera_clips WHERE ${live}`).all() as ClipRow[];
  const s = smbSettings();
  let status: unknown = null;
  try {
    status = JSON.parse(getSetting('camera_backup_status') || 'null');
  } catch {
    /* none yet */
  }
  res.json({
    free_bytes: disk.free,
    total_bytes: disk.total,
    min_free_gb: minFreeBytes() / 1024 ** 3,
    clips: {
      count: rows.length,
      bytes: rows.reduce((t, c) => t + (c.bytes ?? clipBytes(c)), 0),
      compressed: rows.filter((c) => c.archive_file).length,
      waiting: rows.filter((c) => !c.archive_file && !c.archive_error).length,
      failed: rows.filter((c) => c.archive_error).length,
      last_error: rows.find((c) => c.archive_error)?.archive_error ?? null,
      backed_up: rows.filter((c) => c.backed_up_at).length,
      to_back_up: rows.filter((c) => c.archive_file && !c.backed_up_at).length,
    },
    low: lowOnSpace().low,
    on_network_share: onNetworkShare(),
    compress: getSetting('camera_compress_off') !== '1',
    downloaded: rows.filter((c) => (c as ClipRow & { downloaded_at: string | null }).downloaded_at).length,
    oldest_at: rows.reduce<string | null>((o, c) => (!o || c.started_at < o ? c.started_at : o), null),
    purged_total: n(`SELECT COUNT(*) AS n FROM camera_clips WHERE purged_at IS NOT NULL`),
    purges: db.prepare('SELECT * FROM camera_purges ORDER BY at DESC LIMIT 10').all(),
    smb: { share: s.share, folder: s.folder, user: s.user, domain: s.domain, has_password: Boolean(s.pass), auto: s.auto, status, smbclient: await smbclientInstalled() },
  });
});

/** PATCH /storage { min_free_gb, compress, smb_share, smb_folder, smb_user, smb_domain, smb_pass, smb_auto } */
camerasRouter.patch('/storage', (req, res) => {
  if (!requireParent(req, res)) return;
  const b = req.body ?? {};
  if (b.min_free_gb !== undefined) {
    const gb = Number(b.min_free_gb);
    if (!(gb >= 1 && gb <= 10_000)) return res.status(400).json({ error: 'Keep at least 1 GB free' });
    setSetting('camera_min_free_gb', String(Math.round(gb * 10) / 10));
  }
  if (b.smb_share !== undefined) setSetting('camera_smb_share', String(b.smb_share).trim() ? normalShare(String(b.smb_share)) : '');
  if (b.smb_folder !== undefined) setSetting('camera_smb_folder', String(b.smb_folder).trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''));
  if (b.smb_user !== undefined) setSetting('camera_smb_user', String(b.smb_user).trim());
  if (b.smb_domain !== undefined) setSetting('camera_smb_domain', String(b.smb_domain).trim());
  // Only changed when a new one is typed (it's never sent back to the page).
  if (typeof b.smb_pass === 'string' && b.smb_pass) setSetting('camera_smb_pass', b.smb_pass);
  if (b.smb_clear_pass) setSetting('camera_smb_pass', '');
  if (b.smb_auto !== undefined) setSetting('camera_smb_auto', b.smb_auto ? '1' : '');
  if (b.compress !== undefined) setSetting('camera_compress_off', b.compress ? '' : '1');
  res.json({ ok: true });
});

camerasRouter.post('/storage/test-smb', async (req, res) => {
  if (!requireParent(req, res)) return;
  try {
    res.json({ message: await testSmb() });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

camerasRouter.post('/storage/backup-now', async (req, res) => {
  if (!requireParent(req, res)) return;
  const r = await backupClips();
  res.json({ ...r, message: r.error ? `Sent ${r.sent}. Problem: ${r.error}` : r.sent ? `Backed up ${r.sent} clip${r.sent === 1 ? '' : 's'} ✓` : 'Nothing new to back up ✓' });
});

/** POST /storage/check-now — compress what's due and check free space right away. */
camerasRouter.post('/storage/check-now', async (req, res) => {
  if (!requireParent(req, res)) return;
  await cameraStorageTick();
  res.json({ ok: true });
});

/** `before` from the page (a date, or "days" back) → an ISO time. Default: older than 7 days. */
function beforeOf(req: Request): string {
  const raw = (req.query.before ?? req.body?.before) as string | undefined;
  if (raw && /^\d{4}-\d\d-\d\d/.test(raw)) return new Date(raw.length === 10 ? `${raw}T00:00:00` : raw).toISOString();
  const days = Number(req.query.days ?? req.body?.days);
  return new Date(Date.now() - (days >= 0 ? days : 7) * 86400_000).toISOString();
}

/** GET /storage/download-parts?before=YYYY-MM-DD — the zips it would take (each under 3.5 GB). */
camerasRouter.get('/storage/download-parts', (req, res) => {
  if (!requireParent(req, res)) return;
  const parts = downloadParts(beforeOf(req), ZIP_PART_MAX_BYTES, ZIP_PART_MAX_FILES);
  res.json(parts.map(({ clips, ...p }) => ({ ...p, clip_count: clips.length })));
});

/** GET /storage/download.zip?before=YYYY-MM-DD&part=1 — one zip of older clips; marks them downloaded once it's all sent. */
camerasRouter.get('/storage/download.zip', async (req, res) => {
  if (!requireParent(req, res)) return;
  const before = beforeOf(req);
  const part = downloadParts(before, ZIP_PART_MAX_BYTES, ZIP_PART_MAX_FILES).find((p) => p.part === (Number(req.query.part) || 1));
  if (!part) return res.status(404).json({ error: 'Nothing to download' });
  const names = db.prepare('SELECT id, name FROM camera_devices').all() as Array<{ id: string; name: string }>;
  const files = part.clips.flatMap((id) => {
    const c = db.prepare('SELECT * FROM camera_clips WHERE id = ?').get(id) as ClipRow;
    return clipFiles(c, names.find((n) => n.id === c.device_id)?.name ?? 'Camera');
  });
  const label = (iso: string) => iso.slice(0, 10);
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="camera-clips_${label(part.first)}_to_${label(part.last)}${part.part > 1 ? `_part${part.part}` : ''}.zip"`,
    'Cache-Control': 'no-store',
  });
  let closed = false;
  req.on('close', () => (closed = !res.writableFinished));
  try {
    await writeZip(res, files, () => closed);
    if (!closed) {
      const mark = db.prepare('UPDATE camera_clips SET downloaded_at = ? WHERE id = ?');
      const at = new Date().toISOString();
      db.transaction(() => part.clips.forEach((id) => mark.run(at, id)))();
      console.log(`[cameras] Downloaded a zip of ${part.clips.length} clip(s).`);
    }
    res.end();
  } catch (err) {
    console.error('[cameras] Zip download failed:', err);
    res.destroy();
  }
});

/** POST /storage/remove { before | days, only_saved, dry_run } — a parent frees space (never automatic); dry_run just counts. */
camerasRouter.post('/storage/remove', (req, res) => {
  if (!requireParent(req, res)) return;
  const by = (db.prepare('SELECT name FROM family_members WHERE id = ?').get(acting(req)) as { name: string } | undefined)?.name ?? 'a parent';
  try {
    const r = removeClips(beforeOf(req), req.body?.only_saved !== false, by, Boolean(req.body?.dry_run));
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
