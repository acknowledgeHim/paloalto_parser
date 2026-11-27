import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db } from '../db.js';
import { libraryDir } from './movieLibrary.js';
import { videosDir } from './videoFiling.js';
import { piBackupRun } from './systemBackup.js';
const RESTIC = process.env.RESTIC_BIN || 'restic';
const RSYNC = process.env.RSYNC_BIN || 'rsync';
const HOST = 'familyhomecenter';
/** restic repository locations that aren't a folder on the Pi */
const REMOTE = /^(sftp|rest|s3|b2|azure|gs|swift|rclone):/i;
export const isRemote = (dest) => REMOTE.test(dest);
export const OLDER = '.fhc-older-versions';
// ---- sources ----
export const SOURCE_LABELS = {
    photos: '📷 Photo library',
    videos: '🎬 Home videos',
    movies: '🎞️ Movie library',
};
function presetPath(key) {
    if (key === 'photos')
        return config.photosDir;
    if (key === 'videos')
        return videosDir();
    if (key === 'movies')
        return libraryDir();
    return null;
}
export function presets() {
    return Object.keys(SOURCE_LABELS).map((key) => {
        const p = presetPath(key);
        return { key, label: SOURCE_LABELS[key], path: p, exists: isDir(p) };
    });
}
function isDir(p) {
    try {
        return fsSync.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
const inside = (child, parent) => {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};
const real = (p) => {
    try {
        return fsSync.realpathSync(p);
    }
    catch {
        return path.resolve(p);
    }
};
export function parseSources(raw) {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
/** The folders a job backs up, in order, with one inside another left out (it's already included). */
export function resolveSources(specs) {
    const all = specs
        .map((s) => {
        const p = s.key === 'folder' ? s.path ?? '' : presetPath(s.key) ?? '';
        return { label: s.key === 'folder' ? p : SOURCE_LABELS[s.key], path: p ? real(p) : '', name: s.key === 'folder' ? path.basename(p) || 'folder' : s.key };
    })
        .filter((s) => s.path);
    const kept = all.filter((s, i) => !all.some((o, j) => j !== i && o.path !== s.path && inside(s.path, o.path)) && all.findIndex((o) => o.path === s.path) === i);
    // unique folder names on a plain copy
    const used = new Set();
    for (const s of kept) {
        let n = s.name.replace(/[^\p{L}\p{N} ._-]/gu, '_') || 'folder';
        for (let i = 2; used.has(n); i++)
            n = `${s.name}-${i}`;
        used.add(n);
        s.name = n;
    }
    return kept;
}
// ---- checks before anything runs ----
/** The nearest folder of `p` (or `p` itself) that exists. */
function existingAncestor(p) {
    let cur = path.resolve(p);
    while (!fsSync.existsSync(cur)) {
        const up = path.dirname(cur);
        if (up === cur)
            break;
        cur = up;
    }
    return cur;
}
const devOf = (p) => {
    try {
        return fsSync.statSync(p).dev;
    }
    catch {
        return null;
    }
};
/** Is this folder on the Pi's own disk (the same drive as / or the app's data)? */
export function onPiDisk(p) {
    const d = devOf(existingAncestor(p));
    return d !== null && (d === devOf('/') || d === devOf(config.dataDir));
}
/** Everything wrong with a job before it can run (empty = OK). */
export async function problems(job) {
    const out = [];
    const srcs = resolveSources(parseSources(job.sources));
    if (!srcs.length)
        out.push('Pick at least one folder to back up.');
    for (const s of srcs) {
        if (!isDir(s.path))
            out.push(`${s.label}: ${s.path} isn’t there (is the drive or share connected?).`);
        else if (!(await fsp.readdir(s.path).catch(() => [])).length)
            out.push(`${s.label}: ${s.path} is empty (is the drive or share connected?). Not backing up an empty folder.`);
    }
    const dest = job.dest.trim();
    if (!dest)
        out.push('Say where the backup goes.');
    else if (isRemote(dest)) {
        if (job.method === 'copy')
            out.push('A plain copy needs a folder on the Pi (a drive, or a mounted share). Use 🕰️ With history for sftp:/rest: locations.');
    }
    else if (!path.isAbsolute(dest))
        out.push('The backup folder needs a full path, like /mnt/backup/photos.');
    else {
        const d = real(dest);
        for (const s of srcs) {
            if (inside(d, s.path))
                out.push(`The backup can’t go inside what it’s backing up (${s.path}).`);
            if (inside(s.path, d))
                out.push(`${s.path} is inside the backup folder — pick a different one.`);
        }
        if (!isDir(path.dirname(d)))
            out.push(`${path.dirname(d)} isn’t there (is the backup drive plugged in?).`);
        else if (!job.same_disk_ok && onPiDisk(d))
            out.push('That folder is on the Pi’s own disk, not a separate drive (is the backup drive plugged in and mounted?). If that’s on purpose, tick “It’s OK that it’s on the Pi’s own disk”.');
    }
    return out;
}
const hasIonice = fsSync.existsSync('/usr/bin/ionice');
function launch(cmd, args, env, low) {
    const [c, a] = low ? ['nice', ['-n', '10', ...(hasIonice ? ['ionice', '-c3'] : []), cmd, ...args]] : [cmd, args];
    return spawn(c, a, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
}
/** Runs a command to the end; `onLine` sees each stdout line (and \r-separated progress). */
function exec(cmd, args, opts = {}) {
    return new Promise((resolve) => {
        let child;
        try {
            child = launch(cmd, args, opts.env ?? {}, Boolean(opts.low));
        }
        catch (e) {
            return resolve({ code: -1, stdout: '', stderr: e.message });
        }
        opts.onChild?.(child);
        let stdout = '';
        let stderr = '';
        let buf = '';
        const max = opts.maxOut ?? 200_000;
        const keep = (s, add, m = max) => (s + add).slice(-m);
        child.stdout.on('data', (d) => {
            const t = d.toString();
            stdout = keep(stdout, t);
            if (!opts.onLine)
                return;
            buf += t;
            const parts = buf.split(/[\r\n]/);
            buf = parts.pop() ?? '';
            for (const l of parts)
                if (l.trim())
                    opts.onLine(l);
        });
        child.stderr.on('data', (d) => (stderr = keep(stderr, d.toString(), 200_000)));
        const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs) : null;
        child.on('error', (e) => {
            if (timer)
                clearTimeout(timer);
            resolve({ code: -1, stdout, stderr: stderr + e.message });
        });
        child.on('close', (code) => {
            if (timer)
                clearTimeout(timer);
            if (buf.trim() && opts.onLine)
                opts.onLine(buf);
            resolve({ code, stdout, stderr });
        });
    });
}
const keyOf = (jobId) => db.prepare('SELECT password FROM backup_job_keys WHERE job_id = ?').get(jobId)?.password ?? null;
export const newPassword = () => crypto.randomBytes(24).toString('base64url');
export function saveKey(jobId, password) {
    db.prepare('INSERT INTO backup_job_keys (job_id, password, created_at) VALUES (?, ?, ?) ON CONFLICT(job_id) DO UPDATE SET password = excluded.password').run(jobId, password, new Date().toISOString());
}
export const jobPassword = keyOf;
function resticEnv(job) {
    const pw = keyOf(job.id);
    if (!pw)
        throw new Error('This backup has no password saved');
    return { RESTIC_REPOSITORY: job.dest, RESTIC_PASSWORD: pw, RESTIC_PROGRESS_FPS: '0.5' };
}
const lastLines = (s, n = 6) => s.trim().split('\n').filter(Boolean).slice(-n).join('\n').slice(0, 2000);
/** Is restic / rsync installed? (restic's version line, or null) */
export async function tools() {
    const [r, s] = await Promise.all([exec(RESTIC, ['version'], { timeoutMs: 10_000 }), exec(RSYNC, ['--version'], { timeoutMs: 10_000 })]);
    return { restic: r.code === 0 ? r.stdout.trim().split('\n')[0] : null, rsync: s.code === 0 };
}
/**
 * Makes sure a history job's repository is there and opens with its password, creating it only in
 * a folder that's new or empty. Returns an error message, or null when it's ready.
 */
export async function ensureRepo(job) {
    const env = resticEnv(job);
    const probe = await exec(RESTIC, ['cat', 'config', '--no-lock'], { env, timeoutMs: 120_000 });
    if (probe.code === 0)
        return null;
    const err = probe.stderr;
    if (probe.code === 12 || /wrong password|no key found/i.test(err))
        return 'That folder is a restic backup with a different password. Put its password in 🔑 (edit the backup).';
    const missing = probe.code === 10 || /does not exist|unable to open config file|Is there a repository at/i.test(err);
    if (!missing)
        return `Couldn’t open the backup: ${lastLines(err, 3) || `restic exited ${probe.code}`}`;
    if (!isRemote(job.dest)) {
        const d = job.dest;
        if (fsSync.existsSync(d) && (await fsp.readdir(d)).length)
            return `${d} already has other files in it. Pick an empty folder, or a new one (e.g. ${path.join(d, 'fhc-backup')}).`;
    }
    const init = await exec(RESTIC, ['init'], { env, timeoutMs: 300_000 });
    return init.code === 0 ? null : `Couldn’t create the backup: ${lastLines(init.stderr, 3)}`;
}
const queue = [];
let running = null;
export const nowRunning = () => running?.progress ?? null;
export const queued = () => queue.map((t) => ({ run_id: t.runId, job_id: t.job.id, kind: t.kind }));
const busy = (jobId, kind) => (running?.task.job.id === jobId && (!kind || running.task.kind === kind)) || queue.some((t) => t.job.id === jobId && (!kind || t.kind === kind));
export const isBusy = busy;
function finish(runId, result, message, stats) {
    db.prepare('UPDATE backup_runs SET finished_at = ?, result = ?, message = ?, stats = ? WHERE id = ?').run(new Date().toISOString(), result, message.slice(0, 4000), stats ? JSON.stringify(stats) : null, runId);
}
/** Adds a run to the queue (or says why not). */
export function enqueue(job, kind, by, trigger, restore) {
    if (kind !== 'restore' && busy(job.id, kind))
        return { error: 'It’s already running or waiting to run' };
    if (kind !== 'backup' && job.method !== 'history')
        return { error: 'Only a 🕰️ With history backup can do that' };
    const runId = uuidv4();
    db.prepare('INSERT INTO backup_runs (id, job_id, kind, started_at, by_member_id, trigger, stats) VALUES (?, ?, ?, ?, ?, ?, ?)').run(runId, job.id, kind, new Date().toISOString(), by, trigger, restore ? JSON.stringify({ target: restore.target, snapshot: restore.snapshot, paths: restore.paths }) : null);
    queue.push({ runId, job, kind, restore });
    void pump();
    return { run_id: runId };
}
export function cancel(runId) {
    const i = queue.findIndex((t) => t.runId === runId);
    if (i >= 0) {
        queue.splice(i, 1);
        finish(runId, 'cancelled', 'Cancelled before it started', null);
        return true;
    }
    if (running?.task.runId === runId) {
        running.cancelled = true;
        // restic stops cleanly on SIGINT (the snapshot just isn't made); rsync keeps what it copied
        running.child?.kill('SIGINT');
        return true;
    }
    return false;
}
// The Pi's own nightly backup goes first: while it runs, 📦 backups and checks wait (restores don't).
// Looked at every minute by tick(); readPi can be swapped in tests.
let readPi = piBackupRun;
export const setPiReader = (f) => (readPi = f);
let piActive = false;
export const waitingForPi = () => piActive && queue.some((t) => t.kind !== 'restore');
async function pump() {
    if (running || !queue.length)
        return;
    const at = queue.findIndex((t) => !piActive || t.kind === 'restore');
    if (at < 0)
        return;
    const task = queue.splice(at, 1)[0];
    // re-read the job: it may have been edited while waiting
    const job = db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(task.job.id) ?? task.job;
    running = {
        task: { ...task, job },
        child: null,
        cancelled: false,
        progress: { run_id: task.runId, job_id: job.id, kind: task.kind, started_at: new Date().toISOString(), percent: null, files_done: null, total_files: null, bytes_done: null, total_bytes: null, current: null },
    };
    db.prepare('UPDATE backup_runs SET started_at = ? WHERE id = ?').run(running.progress.started_at, task.runId);
    try {
        const r = task.kind === 'backup' ? await (job.method === 'copy' ? doCopy(job) : doHistory(job)) : task.kind === 'check' ? await doCheck(job) : await doRestore(job, task.restore);
        finish(task.runId, running.cancelled ? 'cancelled' : r.result, running.cancelled ? `Cancelled. ${r.message}` : r.message, r.stats);
    }
    catch (e) {
        finish(task.runId, 'failed', e.message, null);
    }
    finally {
        running = null;
        setImmediate(() => void pump());
    }
}
const setChild = (c) => {
    if (running)
        running.child = c;
};
/** 🕰️ A restic snapshot of the sources. */
async function doHistory(job) {
    const p = await problems(job);
    if (p.length)
        return { result: 'failed', message: p.join(' '), stats: null };
    const repoErr = await ensureRepo(job);
    if (repoErr)
        return { result: 'failed', message: repoErr, stats: null };
    const srcs = resolveSources(parseSources(job.sources));
    let summary = null;
    const errors = [];
    const r = await exec(RESTIC, ['backup', '--json', '--host', HOST, '--tag', `fhc-job-${job.id}`, ...srcs.map((s) => s.path)], {
        env: resticEnv(job),
        low: true,
        onChild: setChild,
        onLine: (l) => {
            let m;
            try {
                m = JSON.parse(l);
            }
            catch {
                return;
            }
            if (m.message_type === 'status' && running) {
                const pr = running.progress;
                pr.percent = typeof m.percent_done === 'number' ? Math.round(m.percent_done * 1000) / 10 : pr.percent;
                pr.files_done = m.files_done ?? pr.files_done;
                pr.total_files = m.total_files ?? pr.total_files;
                pr.bytes_done = m.bytes_done ?? pr.bytes_done;
                pr.total_bytes = m.total_bytes ?? pr.total_bytes;
                pr.current = Array.isArray(m.current_files) ? String(m.current_files[0] ?? '') : pr.current;
            }
            else if (m.message_type === 'summary')
                summary = m;
            else if (m.message_type === 'error' && errors.length < 20) {
                const e = m.error;
                errors.push(`${m.item ?? ''} ${e?.message ?? ''}`.trim());
            }
        },
    });
    const s = summary;
    const stats = s
        ? {
            snapshot_id: s.snapshot_id,
            files_new: s.files_new,
            files_changed: s.files_changed,
            files_unmodified: s.files_unmodified,
            bytes_added: s.data_added,
            total_files: s.total_files_processed,
            total_bytes: s.total_bytes_processed,
        }
        : null;
    if (r.code === 0)
        return { result: 'ok', message: s ? `${s.files_new} new, ${s.files_changed} changed, ${size(Number(s.data_added))} added` : 'Done', stats };
    if (r.code === 3)
        return { result: 'warning', message: `Snapshot made, but some files couldn’t be read: ${errors.slice(0, 5).join('; ') || lastLines(r.stderr, 3)}`, stats };
    return { result: 'failed', message: lastLines(r.stderr) || `restic exited ${r.code}`, stats };
}
/** 📁 A plain copy: changed files are copied, replaced ones keep their old version aside, nothing is deleted. */
async function doCopy(job) {
    const p = await problems(job);
    if (p.length)
        return { result: 'failed', message: p.join(' '), stats: null };
    const srcs = resolveSources(parseSources(job.sources));
    await fsp.mkdir(job.dest, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    let copied = 0;
    let bytes = 0;
    const msgs = [];
    let worst = 'ok';
    for (const [i, s] of srcs.entries()) {
        if (running?.cancelled)
            break;
        const to = path.join(job.dest, s.name);
        await fsp.mkdir(to, { recursive: true });
        // -rt: folders and times (works on shares that don't keep owners/permissions); no --delete, ever.
        const r = await exec(RSYNC, ['-rt', '--modify-window=2', '--backup', `--backup-dir=${path.join(job.dest, OLDER, stamp, s.name)}`, '--info=progress2,stats2', `${s.path}/`, `${to}/`], {
            low: true,
            onChild: setChild,
            onLine: (l) => {
                const m = /^\s*([\d,]+)\s+(\d+)%/.exec(l);
                if (m && running) {
                    running.progress.percent = Math.round(((i + Number(m[2]) / 100) / srcs.length) * 1000) / 10;
                    running.progress.bytes_done = Number(m[1].replace(/,/g, ''));
                    running.progress.current = s.label;
                }
            },
        });
        const n = /Number of regular files transferred: ([\d,]+)/.exec(r.stdout);
        const b = /Total transferred file size: ([\d,]+)/.exec(r.stdout);
        copied += n ? Number(n[1].replace(/,/g, '')) : 0;
        bytes += b ? Number(b[1].replace(/,/g, '')) : 0;
        if (r.code === 0)
            continue;
        // 23/24: some files couldn't be copied, or vanished while copying — the rest is there
        const partial = r.code === 23 || r.code === 24;
        if (!partial || worst === 'ok')
            worst = partial ? 'warning' : 'failed';
        msgs.push(`${s.label}: ${lastLines(r.stderr, 3) || `rsync exited ${r.code}`}`);
    }
    return { result: worst, message: [`${copied} files copied (${size(bytes)})`, ...msgs].join('. '), stats: { files_new: copied, bytes_added: bytes } };
}
/** 🩺 restic check: can the backup be read back? (reads the index and structure, not every byte) */
async function doCheck(job) {
    const r = await exec(RESTIC, ['check'], { env: resticEnv(job), low: true, onChild: setChild });
    return r.code === 0 ? { result: 'ok', message: 'No errors were found', stats: null } : { result: 'failed', message: lastLines(r.stdout + '\n' + r.stderr) || `restic exited ${r.code}`, stats: null };
}
/** ⤵️ Restore into a new folder — never over anything that's there. */
async function doRestore(job, rs) {
    if (fsSync.existsSync(rs.target))
        return { result: 'failed', message: `${rs.target} already exists; not restoring over it`, stats: null };
    await fsp.mkdir(rs.target, { recursive: true });
    const args = ['restore', rs.snapshot, '--target', rs.target, '--json', ...rs.paths.flatMap((p) => ['--include', p])];
    const r = await exec(RESTIC, args, {
        env: resticEnv(job),
        low: true,
        onChild: setChild,
        onLine: (l) => {
            try {
                const m = JSON.parse(l);
                if (m.message_type === 'status' && running) {
                    running.progress.percent = typeof m.percent_done === 'number' ? Math.round(m.percent_done * 1000) / 10 : null;
                    running.progress.files_done = m.files_restored ?? null;
                    running.progress.total_files = m.total_files ?? null;
                    running.progress.bytes_done = m.bytes_restored ?? null;
                    running.progress.total_bytes = m.total_bytes ?? null;
                }
            }
            catch {
                /* not JSON */
            }
        },
    });
    const stats = { target: rs.target, snapshot: rs.snapshot, paths: rs.paths };
    return r.code === 0 ? { result: 'ok', message: `Restored into ${rs.target}`, stats } : { result: 'failed', message: lastLines(r.stderr) || `restic exited ${r.code}`, stats };
}
export async function snapshots(job) {
    const r = await exec(RESTIC, ['snapshots', '--json', '--no-lock'], { env: resticEnv(job), timeoutMs: 120_000, maxOut: 50_000_000 });
    if (r.code !== 0)
        throw new Error(lastLines(r.stderr, 3) || 'Couldn’t read the backup');
    const list = JSON.parse(r.stdout || '[]');
    return list.map((s) => ({ id: s.id, short_id: s.short_id ?? s.id.slice(0, 8), time: s.time, paths: s.paths ?? [], hostname: s.hostname, tags: s.tags ?? [] })).sort((a, b) => b.time.localeCompare(a.time));
}
/** What's in one folder of a snapshot (just that folder, not everything below it). */
export async function list(job, snapshot, dir) {
    const out = [];
    const norm = dir.replace(/\/+$/, '') || '/';
    // read line by line (a big folder's listing is too long to keep whole)
    const r = await exec(RESTIC, ['ls', '--json', '--no-lock', snapshot, norm], {
        env: resticEnv(job),
        timeoutMs: 180_000,
        maxOut: 20_000,
        onLine: (l) => {
            try {
                const n = JSON.parse(l);
                if ((n.struct_type ?? n.message_type) !== 'node' || path.posix.dirname(n.path) !== norm || out.length >= 5000)
                    return;
                out.push({ name: n.name, path: n.path, type: n.type, size: n.size ?? null, mtime: n.mtime ?? null });
            }
            catch {
                /* not JSON */
            }
        },
    });
    if (r.code !== 0)
        throw new Error(lastLines(r.stderr, 3) || 'Couldn’t read the backup');
    return out.sort((a, b) => (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
/** Files and folders whose name matches, in one snapshot (or all). */
export async function find(job, q, snapshot) {
    const pattern = /[*?[]/.test(q) ? q : `*${q}*`;
    const r = await exec(RESTIC, ['find', '--json', '--no-lock', '--ignore-case', ...(snapshot ? ['--snapshot', snapshot] : []), pattern], { env: resticEnv(job), timeoutMs: 300_000, maxOut: 50_000_000 });
    if (r.code !== 0)
        throw new Error(lastLines(r.stderr, 3) || 'Couldn’t search the backup');
    const groups = JSON.parse(r.stdout || '[]');
    const out = [];
    for (const g of groups ?? [])
        for (const m of g.matches ?? []) {
            out.push({ snapshot: g.snapshot, name: path.posix.basename(m.path), path: m.path, type: m.type, size: m.size ?? null, mtime: m.mtime ?? null });
            if (out.length >= 300)
                return out;
        }
    return out;
}
/** Where a restore goes: a new folder under the job's restore folder (default: next to a local backup). */
export function restoreTarget(job, snapshotShort) {
    const root = job.restore_dir?.trim() || (isRemote(job.dest) ? '' : path.join(path.dirname(job.dest), 'fhc-restored'));
    if (!root || !path.isAbsolute(root))
        return { error: 'Set a “Restore into” folder for this backup first (edit it).' };
    const r = real(root);
    for (const s of resolveSources(parseSources(job.sources)))
        if (inside(r, s.path))
            return { error: `Restores can’t go inside ${s.path} (it’s being backed up). Pick another “Restore into” folder.` };
    if (!isRemote(job.dest) && inside(r, real(job.dest)))
        return { error: 'Restores can’t go inside the backup itself.' };
    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    return path.join(root, `${stamp}_${snapshotShort.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`);
}
// ---- free space on a local backup ----
export async function destSpace(dest) {
    if (isRemote(dest))
        return null;
    const statfs = fsp.statfs;
    if (!statfs)
        return null;
    try {
        const s = await statfs(existingAncestor(dest));
        return { free_bytes: s.bavail * s.bsize, size_bytes: s.blocks * s.bsize };
    }
    catch {
        return null;
    }
}
export function size(n) {
    if (!Number.isFinite(n))
        return '?';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i && n < 10 ? 1 : 0)} ${u[i]}`;
}
// ---- schedule ----
/** The most recent time this schedule was due, at or before `now` (local time); null when off. */
export function lastDue(schedule, atTime, weekday, now = new Date()) {
    if (schedule === 'off')
        return null;
    if (schedule === 'after_pi')
        schedule = 'daily'; // only used when the Pi's backup isn't set up
    const [h, m] = atTime.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    if (schedule === 'daily') {
        if (d > now)
            d.setDate(d.getDate() - 1);
        return d;
    }
    d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
    if (d > now)
        d.setDate(d.getDate() - 7);
    return d;
}
export function nextDue(schedule, atTime, weekday, now = new Date()) {
    const last = lastDue(schedule, atTime, weekday, now);
    if (!last)
        return null;
    const n = new Date(last);
    n.setDate(n.getDate() + (schedule === 'daily' ? 1 : 7));
    return n;
}
const ranSince = (jobId, kind, since) => Boolean(db.prepare('SELECT 1 FROM backup_runs WHERE job_id = ? AND kind = ? AND started_at >= ? LIMIT 1').get(jobId, kind, since.toISOString()));
/** Each minute: start any backup that's due (or was missed while the Pi was off), and the weekly 🩺 check. */
export async function tick(now = new Date()) {
    const jobs = db.prepare("SELECT * FROM backup_jobs WHERE archived = 0 AND schedule != 'off'").all();
    const pi = await readPi().catch(() => ({ installed: false, active: false, last_end: null }));
    piActive = pi.active;
    for (const j of jobs) {
        if (j.schedule === 'after_pi' && pi.installed) {
            // right after the Pi's backup finishes (whether it went well or not); a new schedule waits for the next one
            const end = pi.last_end ? new Date(pi.last_end) : null;
            if (!pi.active && end && pi.last_end >= j.schedule_set_at && !ranSince(j.id, 'backup', end) && !busy(j.id, 'backup'))
                enqueue(j, 'backup', null, 'after the Pi’s backup');
        }
        else {
            // (after_pi without the Pi's backup set up: every night at its time instead)
            const due = lastDue(j.schedule, j.at_time, j.weekday, now);
            if (due && due.toISOString() >= j.schedule_set_at && !ranSince(j.id, 'backup', due) && !busy(j.id, 'backup'))
                enqueue(j, 'backup', null, 'schedule');
        }
        if (j.method === 'history' && j.check_weekly) {
            // Sundays, an hour and a half after the backup time
            const [h, m] = j.at_time.split(':').map(Number);
            const t = (h * 60 + m + 90) % 1440;
            const c = lastDue('weekly', `${Math.floor(t / 60)}:${t % 60}`, 0, now);
            if (c && c.toISOString() >= j.schedule_set_at && !ranSince(j.id, 'check', c) && !busy(j.id, 'check'))
                enqueue(j, 'check', null, 'schedule');
        }
    }
    // anything held while the Pi's backup ran can go now
    void pump();
}
let started = false;
export function startBackupJobs() {
    if (started)
        return;
    started = true;
    cron.schedule('* * * * *', () => {
        tick().catch((e) => console.error('[backups] schedule check failed', e));
    });
}
