import { Router, type Request, type Response } from 'express';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  cancel,
  destSpace,
  enqueue,
  ensureRepo,
  find,
  isBusy,
  isRemote,
  jobPassword,
  list,
  newPassword,
  nextDue,
  nowRunning,
  OLDER,
  parseSources,
  presets,
  problems,
  queued,
  waitingForPi,
  resolveSources,
  restoreTarget,
  saveKey,
  snapshots,
  tools,
  type JobRow,
  type RunRow,
  type SourceSpec,
} from '../services/backupJobs.js';
import { isParentRequest, sessionActor } from '../services/rewards.js';
import { setSystemTime, startSystem, systemBackupInfo } from '../services/systemBackup.js';

/**
 * 💾 /api/backups (parents only): the 📦 photo & movie backups the app runs (services/backupJobs.ts)
 * and the controls for the Pi's own nightly backup (services/systemBackup.ts).
 */
export const backupsRouter = Router();
backupsRouter.use(requireAdmin);
const acting = (req: Request) => req.body?.acting_member_id ?? req.query.acting_member_id;
backupsRouter.use((req, res, next) => (isParentRequest(req, acting(req)) ? next() : res.status(403).json({ error: 'For parents only' })));

const jobOf = (id: string) => db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(id) as JobRow | undefined;
const runRow = (r: RunRow) => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null });

/** A run with no result that isn't running or waiting was cut short (the app restarted). */
function shown(r: RunRow) {
  const live = nowRunning()?.run_id === r.id || queued().some((q) => q.run_id === r.id);
  return runRow(!r.result && !live ? { ...r, result: 'interrupted', message: r.message ?? 'Stopped part way (the app or the Pi restarted)' } : r);
}

async function view(j: JobRow) {
  const last = (kind: string) => db.prepare('SELECT * FROM backup_runs WHERE job_id = ? AND kind = ? ORDER BY started_at DESC LIMIT 1').get(j.id, kind) as RunRow | undefined;
  const lastOk = db.prepare("SELECT finished_at FROM backup_runs WHERE job_id = ? AND kind = 'backup' AND result IN ('ok', 'warning') ORDER BY started_at DESC LIMIT 1").get(j.id) as { finished_at: string } | undefined;
  // after_pi: shown next to the Pi backup's own next time in the card
  const next = j.schedule === 'after_pi' ? null : nextDue(j.schedule, j.at_time, j.weekday);
  return {
    ...j,
    sources: parseSources(j.sources),
    resolved: resolveSources(parseSources(j.sources)),
    remote: isRemote(j.dest),
    older_versions: j.method === 'copy' ? path.join(j.dest, OLDER) : null,
    restore_root: j.restore_dir || (isRemote(j.dest) ? null : path.join(path.dirname(j.dest), 'fhc-restored')),
    has_password: Boolean(jobPassword(j.id)),
    problems: await problems(j),
    space: await destSpace(j.dest),
    next_run: next?.toISOString() ?? null,
    last_backup: last('backup') ? shown(last('backup')!) : null,
    last_check: last('check') ? shown(last('check')!) : null,
    last_ok_at: lastOk?.finished_at ?? null,
  };
}

/** GET / — everything for the Settings card. */
backupsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const jobs = db.prepare(`SELECT * FROM backup_jobs ${req.query.all === '1' ? '' : 'WHERE archived = 0'} ORDER BY created_at`).all() as JobRow[];
    const [t, system] = await Promise.all([tools(), systemBackupInfo()]);
    res.json({ tools: t, presets: presets(), jobs: await Promise.all(jobs.map(view)), running: nowRunning(), queue: queued(), waiting_for_pi: waitingForPi(), system });
  })
);

interface Body {
  name?: string;
  sources?: SourceSpec[];
  dest?: string;
  method?: string;
  schedule?: string;
  at_time?: string;
  weekday?: number;
  check_weekly?: boolean;
  restore_dir?: string | null;
  same_disk_ok?: boolean;
  archived?: boolean;
  password?: string;
}
/** The job's fields from a request (only what was sent), or an error message. */
function clean(b: Body, base: Partial<JobRow>): Partial<JobRow> | string {
  const out: Partial<JobRow> = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim().slice(0, 80);
    if (!n) return 'Give it a name';
    out.name = n;
  }
  if (b.sources !== undefined) {
    if (!Array.isArray(b.sources)) return 'sources must be a list';
    const s: SourceSpec[] = [];
    for (const x of b.sources.slice(0, 20)) {
      if (x?.key === 'folder') {
        const p = String(x.path ?? '').trim();
        if (!p) continue;
        if (!path.isAbsolute(p)) return `Folders need a full path (${p})`;
        s.push({ key: 'folder', path: path.normalize(p) });
      } else if (x?.key === 'photos' || x?.key === 'videos' || x?.key === 'movies') s.push({ key: x.key });
    }
    if (!s.length) return 'Pick at least one folder to back up';
    out.sources = JSON.stringify(s);
  }
  if (b.dest !== undefined) {
    const d = String(b.dest).trim();
    if (!d) return 'Say where the backup goes';
    if (!isRemote(d) && !path.isAbsolute(d)) return 'The backup folder needs a full path, like /mnt/backup/photos';
    out.dest = isRemote(d) ? d : path.normalize(d).replace(/\/+$/, '') || '/';
  }
  if (b.method !== undefined) {
    if (b.method !== 'history' && b.method !== 'copy') return 'method: history or copy';
    out.method = b.method;
  }
  if (b.schedule !== undefined) {
    if (!['off', 'daily', 'weekly', 'after_pi'].includes(b.schedule)) return 'schedule: off, daily, weekly or after_pi';
    out.schedule = b.schedule as JobRow['schedule'];
  }
  if (b.at_time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.at_time))) return 'Use a time like 03:00';
    out.at_time = String(b.at_time);
  }
  if (b.weekday !== undefined) {
    const w = Number(b.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6) return 'weekday: 0 (Sunday) to 6';
    out.weekday = w;
  }
  if (b.check_weekly !== undefined) out.check_weekly = b.check_weekly ? 1 : 0;
  if (b.same_disk_ok !== undefined) out.same_disk_ok = b.same_disk_ok ? 1 : 0;
  if (b.archived !== undefined) out.archived = b.archived ? 1 : 0;
  if (b.restore_dir !== undefined) {
    const r = b.restore_dir ? String(b.restore_dir).trim() : '';
    if (r && !path.isAbsolute(r)) return 'The restore folder needs a full path';
    out.restore_dir = r ? path.normalize(r) : null;
  }
  const method = out.method ?? base.method;
  const dest = out.dest ?? base.dest;
  if (method === 'copy' && dest && isRemote(dest)) return 'A plain copy needs a folder on the Pi. Use 🕰️ With history for sftp:/rest: locations.';
  return out;
}

/** POST /jobs { name, sources, dest, method, schedule, at_time, weekday, …, password? } */
backupsRouter.post(
  '/jobs',
  asyncHandler(async (req, res) => {
    const b = req.body as Body;
    const v = clean({ name: 'Photos & movies', method: 'history', schedule: 'daily', at_time: '03:00', weekday: 0, ...b }, {});
    if (typeof v === 'string') return res.status(400).json({ error: v });
    if (!v.sources || !v.dest) return res.status(400).json({ error: 'Pick what to back up and where it goes' });
    const id = uuidv4();
    const now = new Date().toISOString();
    const cols = Object.keys(v) as Array<keyof JobRow>;
    db.prepare(`INSERT INTO backup_jobs (id, ${cols.join(', ')}, schedule_set_at, created_at, updated_at, updated_by) VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?, ?, ?)`).run(
      id,
      ...cols.map((c) => v[c]),
      now,
      now,
      now,
      sessionActor(req, acting(req))
    );
    if (v.method === 'history') saveKey(id, b.password?.trim() || newPassword());
    res.status(201).json(await view(jobOf(id)!));
  })
);

/** PUT /jobs/:id { …fields, archived, password } — nothing that was backed up is touched. */
backupsRouter.put(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    const j = jobOf(req.params.id);
    if (!j) return res.status(404).json({ error: 'not found' });
    const b = req.body as Body;
    const v = clean(b, j);
    if (typeof v === 'string') return res.status(400).json({ error: v });
    if (isBusy(j.id) && (v.dest || v.method || v.sources)) return res.status(409).json({ error: 'Wait until it’s finished (or cancel it) to change what or where' });
    const cols = Object.keys(v) as Array<keyof JobRow>;
    // a new schedule doesn't run for times that already went by
    const sched = v.schedule !== undefined || v.at_time !== undefined || v.weekday !== undefined;
    const now = new Date().toISOString();
    if (cols.length)
      db.prepare(`UPDATE backup_jobs SET ${cols.map((c) => `${c} = ?`).join(', ')}${sched ? ', schedule_set_at = ?' : ''}, updated_at = ?, updated_by = ? WHERE id = ?`).run(
        ...cols.map((c) => v[c]),
        ...(sched ? [now] : []),
        now,
        sessionActor(req, acting(req)),
        j.id
      );
    const after = jobOf(j.id)!;
    if (b.password?.trim()) saveKey(j.id, b.password.trim());
    else if (after.method === 'history' && !jobPassword(j.id)) saveKey(j.id, newPassword());
    res.json(await view(after));
  })
);

/** GET /jobs/:id/password — 🔑 to save somewhere safe (without it a 🕰️ backup can't be read). */
backupsRouter.get('/jobs/:id/password', (req, res) => {
  const pw = jobPassword(req.params.id);
  if (!pw) return res.status(404).json({ error: 'No password for this one' });
  res.json({ password: pw });
});

/** POST /jobs/:id/run { kind: 'backup' | 'check' } — start now (after anything already running). */
backupsRouter.post('/jobs/:id/run', (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  const kind = req.body?.kind === 'check' ? 'check' : 'backup';
  const r = enqueue(j, kind, sessionActor(req, acting(req)), 'by hand');
  if ('error' in r) return res.status(409).json(r);
  res.status(202).json(r);
});

/** POST /runs/:rid/cancel */
backupsRouter.post('/runs/:rid/cancel', (req, res) => {
  res.json({ ok: cancel(req.params.rid) });
});

/** GET /jobs/:id/runs — the last 50. */
backupsRouter.get('/jobs/:id/runs', (req, res) => {
  const rows = db.prepare('SELECT * FROM backup_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 50').all(req.params.id) as RunRow[];
  res.json(rows.map(shown));
});

const historyJob = (req: Request, res: Response): JobRow | null => {
  const j = jobOf(req.params.id);
  if (!j) {
    res.status(404).json({ error: 'not found' });
    return null;
  }
  if (j.method !== 'history') {
    res.status(400).json({ error: 'A plain copy is just folders — open them on the backup drive' });
    return null;
  }
  return j;
};
const safeId = (s: unknown) => (typeof s === 'string' && /^(latest|[0-9a-f]{6,64})$/.test(s) ? s : null);
const safePath = (s: unknown) => (typeof s === 'string' && s.startsWith('/') && !s.includes('\0') && s.length < 4000 ? s : null);

/** GET /jobs/:id/snapshots — 🕰️ every dated snapshot, newest first. */
backupsRouter.get(
  '/jobs/:id/snapshots',
  asyncHandler(async (req, res) => {
    const j = historyJob(req, res);
    if (!j) return;
    try {
      res.json(await snapshots(j));
    } catch (e) {
      const setup = await ensureRepoReadOnly(j);
      res.status(400).json({ error: setup ?? (e as Error).message });
    }
  })
);
/** Says "no backup yet" instead of restic's error when the repository was never made. */
async function ensureRepoReadOnly(j: JobRow): Promise<string | null> {
  const last = db.prepare("SELECT 1 FROM backup_runs WHERE job_id = ? AND kind = 'backup' AND result IN ('ok', 'warning') LIMIT 1").get(j.id);
  return last ? null : 'No backup yet — press ▶ Back up now.';
}

/** GET /jobs/:id/ls?snapshot=&path= — one folder of a snapshot. */
backupsRouter.get(
  '/jobs/:id/ls',
  asyncHandler(async (req, res) => {
    const j = historyJob(req, res);
    if (!j) return;
    const snap = safeId(req.query.snapshot);
    const p = safePath(req.query.path);
    if (!snap || !p) return res.status(400).json({ error: 'snapshot and path, please' });
    try {
      res.json(await list(j, snap, p));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  })
);

/** GET /jobs/:id/find?q=&snapshot= — 🔎 by name (* and ? work). */
backupsRouter.get(
  '/jobs/:id/find',
  asyncHandler(async (req, res) => {
    const j = historyJob(req, res);
    if (!j) return;
    const q = String(req.query.q ?? '').trim().slice(0, 200);
    if (!q || q.startsWith('-')) return res.status(400).json({ error: 'What are you looking for?' });
    const snap = req.query.snapshot ? safeId(req.query.snapshot) : undefined;
    if (snap === null) return res.status(400).json({ error: 'bad snapshot' });
    try {
      res.json(await find(j, q, snap));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  })
);

/** POST /jobs/:id/restore { snapshot, paths?: [] } — into a new folder, never over what's there. */
backupsRouter.post('/jobs/:id/restore', (req, res) => {
  const j = historyJob(req, res);
  if (!j) return;
  const snap = safeId(req.body?.snapshot);
  if (!snap) return res.status(400).json({ error: 'Which snapshot?' });
  const raw = Array.isArray(req.body?.paths) ? (req.body.paths as unknown[]).slice(0, 200) : [];
  const paths = raw.map(safePath);
  if (paths.some((p) => !p)) return res.status(400).json({ error: 'bad path' });
  const target = restoreTarget(j, snap);
  if (typeof target !== 'string') return res.status(400).json(target);
  const r = enqueue(j, 'restore', sessionActor(req, acting(req)), 'by hand', { snapshot: snap, paths: paths as string[], target });
  if ('error' in r) return res.status(409).json(r);
  res.status(202).json({ ...r, target });
});

// ---- the Pi's own nightly backup ----
/** POST /system/run { what: 'backup' | 'check' } */
backupsRouter.post(
  '/system/run',
  asyncHandler(async (req, res) => {
    const r = await startSystem(req.body?.what === 'check' ? 'check' : 'backup');
    if (!r.ok) return res.status(r.setup ? 409 : 500).json(r);
    res.json({ ok: true, system: await systemBackupInfo() });
  })
);
/** PUT /system/time { time: 'HH:MM' } */
backupsRouter.put(
  '/system/time',
  asyncHandler(async (req, res) => {
    const r = await setSystemTime(String(req.body?.time ?? ''));
    if (!r.ok) return res.status(r.setup ? 409 : 400).json(r);
    res.json({ ok: true, system: await systemBackupInfo() });
  })
);
