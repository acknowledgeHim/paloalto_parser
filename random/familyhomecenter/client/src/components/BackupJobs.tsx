import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useActing } from '../pages/CamerasPage.js';

/**
 * 💾 Settings → Backups, the parts you can press:
 * - SystemBackupControls: ▶ run the Pi's own nightly backup (or 🩺 its check) now, and change its time.
 * - BackupJobsSettings: 📦 photo & movie backups the app runs itself — what, where, when, and
 *   🕰️ history to browse and restore from (server: routes/backups.ts, services/backupJobs.ts).
 * Nothing here deletes anything: backups only add, and restores go to a new folder.
 */

type SourceKey = 'photos' | 'videos' | 'movies' | 'folder';
interface SourceSpec {
  key: SourceKey;
  path?: string;
}
interface Run {
  id: string;
  kind: 'backup' | 'check' | 'restore';
  started_at: string;
  finished_at: string | null;
  result: string | null;
  message: string | null;
  stats: Record<string, unknown> | null;
  trigger: string | null;
}
interface Job {
  id: string;
  name: string;
  sources: SourceSpec[];
  resolved: Array<{ label: string; path: string; name: string }>;
  dest: string;
  method: 'history' | 'copy';
  schedule: 'off' | 'daily' | 'weekly';
  at_time: string;
  weekday: number;
  check_weekly: number;
  restore_dir: string | null;
  restore_root: string | null;
  same_disk_ok: number;
  archived: number;
  remote: boolean;
  older_versions: string | null;
  has_password: boolean;
  problems: string[];
  space: { free_bytes: number; size_bytes: number } | null;
  next_run: string | null;
  last_backup: Run | null;
  last_check: Run | null;
  last_ok_at: string | null;
}
interface Progress {
  run_id: string;
  job_id: string;
  kind: Run['kind'];
  started_at: string;
  percent: number | null;
  files_done: number | null;
  total_files: number | null;
  bytes_done: number | null;
  total_bytes: number | null;
  current: string | null;
}
interface SystemInfo {
  installed: boolean;
  time: string | null;
  next_run: string | null;
  last_trigger: string | null;
  backup_state: string | null;
  check_state: string | null;
}
interface State {
  tools: { restic: string | null; rsync: boolean };
  presets: Array<{ key: Exclude<SourceKey, 'folder'>; label: string; path: string; exists: boolean }>;
  jobs: Job[];
  running: Progress | null;
  queue: Array<{ run_id: string; job_id: string; kind: string }>;
  system: SystemInfo;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
function size(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '?';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i && n < 10 ? 1 : 0)} ${u[i]}`;
}
const resultIcon = (r: string | null | undefined) => (r === 'ok' ? '✅' : r === 'warning' ? '⚠️' : r === 'failed' || r === 'interrupted' ? '❌' : r === 'cancelled' ? '⏹️' : '⏳');
const resultCls = (r: string | null | undefined) => (r === 'ok' ? 'is-ok' : r === 'warning' || r === 'cancelled' ? 'is-warn' : r === 'failed' || r === 'interrupted' ? 'is-bad' : '');
const scheduleText = (j: Pick<Job, 'schedule' | 'at_time' | 'weekday'>) =>
  j.schedule === 'off' ? 'Only when you press ▶' : j.schedule === 'daily' ? `Every night at ${j.at_time}` : `Every ${DAYS[j.weekday]} at ${j.at_time}`;

/** One GET /backups shared by both parts of the card, polled while something runs. */
function useBackups() {
  const acting = useActing();
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () =>
    api
      .get<State>(`/backups?${acting.q}`)
      .then((x) => {
        setS(x);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting.id]);
  const busy = Boolean(s?.running || s?.queue.length || s?.system.backup_state === 'activating' || s?.system.backup_state === 'active' || s?.system.check_state === 'activating' || s?.system.check_state === 'active');
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  return { s, err, load, acting };
}

const SUDOERS = `sudo tee /etc/sudoers.d/fhc-backup >/dev/null <<'EOF'
pi ALL=(root) NOPASSWD: /usr/bin/systemctl start --no-block fhc-backup.service, /usr/bin/systemctl start --no-block fhc-backup-check.service, /usr/local/sbin/fhc-backup-schedule
EOF
sudo chmod 440 /etc/sudoers.d/fhc-backup && sudo visudo -c`;

/** ▶ / 🩺 / ⏰ for the Pi's own nightly backup. Shown inside the 💾 Backups status card. */
export function SystemBackupControls({ onChanged }: { onChanged?: () => void }) {
  const { s, err, load, acting } = useBackups();
  const [time, setTime] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    if (s?.system.time) setTime(s.system.time);
  }, [s?.system.time]);
  if (err) return null;
  if (!s) return null;
  const sys = s.system;
  if (!sys.installed) return null;
  const go = async (f: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    setSetup(false);
    try {
      await f();
      setMsg(ok);
      await load();
      onChanged?.();
    } catch (e) {
      const m = (e as Error).message;
      // the server says 409 when the sudo line isn't set up yet
      if (/password is required|sudoers|not allowed|command not found|No such file|terminal is required/i.test(m)) setSetup(true);
      setMsg(m);
    }
  };
  const runningNow = sys.backup_state === 'active' || sys.backup_state === 'activating';
  const checking = sys.check_state === 'active' || sys.check_state === 'activating';
  return (
    <div className="backup-status__row backup-controls">
      <strong>🎛️ The Pi’s nightly backup</strong>
      <span>
        {runningNow ? '⏳ Backing up now…' : checking ? '⏳ Checking now…' : `Next: ${when(sys.next_run)}`}
        {sys.last_trigger && <span className="hint"> · last started {when(sys.last_trigger)}</span>}
      </span>
      <div className="backup-controls__row">
        <button type="button" disabled={runningNow} onClick={() => void go(() => api.post('/backups/system/run', { what: 'backup', acting_member_id: acting.id || null }), 'Started — it runs in the background.')}>
          ▶ Back up now
        </button>
        <button type="button" className="secondary" disabled={checking} onClick={() => void go(() => api.post('/backups/system/run', { what: 'check', acting_member_id: acting.id || null }), 'Check started.')}>
          🩺 Check now
        </button>
        <label className="backup-controls__time">
          ⏰ Every night at
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={!time || time === sys.time}
          onClick={() => void go(() => api.put('/backups/system/time', { time, acting_member_id: acting.id || null }), `Now runs every night at ${time}.`)}
        >
          Save time
        </button>
      </div>
      {msg && <span className={setup ? 'settings-login__error' : 'hint'}>{msg}</span>}
      {setup && (
        <details open className="backup-controls__setup">
          <summary>One-time setup on the Pi (lets the app press these buttons, and nothing else)</summary>
          <pre>{SUDOERS}</pre>
          <span className="hint">
            Plus the small <code>/usr/local/sbin/fhc-backup-schedule</code> script for changing the time — both are in docs/STORAGE_DRIVES.md §9f. Change <code>pi</code> if the app runs as another user.
          </span>
        </details>
      )}
    </div>
  );
}

/** 📦 Photo & movie backups the app runs itself. */
export function BackupJobsSettings() {
  const { s, err, load, acting } = useBackups();
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [browsing, setBrowsing] = useState<Job | null>(null);
  const [runsOf, setRunsOf] = useState<Job | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pw, setPw] = useState<{ id: string; password: string } | null>(null);
  const body = (b: Record<string, unknown> = {}) => ({ ...b, acting_member_id: acting.id || null });
  const act = async (f: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await f();
    } catch (e) {
      setMsg((e as Error).message);
    }
    await load();
  };

  return (
    <section className="panel backup-jobs">
      <h2>📦 Photo &amp; movie backups</h2>
      <p className="hint">
        Back up the photos, home videos, the movie library or any folder — from the Pi or a share — to another drive or folder, on a schedule. 🕰️ <b>With history</b> keeps a dated
        snapshot each time, so you can get back any file as it was on any day. 📁 <b>Plain copy</b> is ordinary folders you can open anywhere. Neither ever deletes anything, and a
        restore always goes into a new folder.
      </p>
      {err && <div className="settings-login__error">{err}</div>}
      {msg && <div className="settings-login__error">{msg}</div>}
      {!s && !err && <p className="hint">Loading…</p>}
      {s && (
        <>
          {!s.tools.restic && (
            <p className="hint">
              ⚠️ restic isn’t installed, so 🕰️ With history backups can’t run yet: <code>sudo apt install -y restic</code>
            </p>
          )}
          {!s.tools.rsync && (
            <p className="hint">
              ⚠️ rsync isn’t installed, so 📁 Plain copy backups can’t run yet: <code>sudo apt install -y rsync</code>
            </p>
          )}
          {s.jobs.filter((j) => showArchived || !j.archived).length === 0 && <p className="empty-state">No backups set up here yet.</p>}
          {s.jobs
            .filter((j) => showArchived || !j.archived)
            .map((j) => {
              const live = s.running?.job_id === j.id ? s.running : null;
              const waiting = s.queue.filter((q) => q.job_id === j.id);
              const lb = j.last_backup;
              return (
                <div key={j.id} className={`backup-status__row backup-job ${live ? '' : resultCls(lb?.result)}${j.archived ? ' is-archived' : ''}`}>
                  <div className="backup-job__head">
                    <strong>
                      {j.method === 'history' ? '🕰️' : '📁'} {j.name}
                    </strong>
                    <span className="hint">{scheduleText(j)}</span>
                    {j.archived ? <span className="badge">archived</span> : null}
                  </div>
                  <span className="hint">
                    {j.resolved.map((r) => r.label).join(' + ') || '—'} → <code>{j.dest}</code>
                    {j.space && ` · ${size(j.space.free_bytes)} free of ${size(j.space.size_bytes)}`}
                  </span>
                  {live ? (
                    <span>
                      ⏳ {live.kind === 'backup' ? 'Backing up' : live.kind === 'check' ? 'Checking' : 'Restoring'}…{' '}
                      {live.percent != null && `${live.percent}%`} {live.files_done != null && `· ${live.files_done}${live.total_files ? ` of ${live.total_files}` : ''} files`}{' '}
                      {live.bytes_done != null && `· ${size(live.bytes_done)}${live.total_bytes ? ` of ${size(live.total_bytes)}` : ''}`}
                      {live.percent != null && <meter min={0} max={100} value={live.percent} />}
                      <button type="button" className="link-button" onClick={() => void act(() => api.post(`/backups/runs/${live.run_id}/cancel`, body()))}>
                        ⏹ Cancel
                      </button>
                    </span>
                  ) : waiting.length ? (
                    <span>⏳ Waiting its turn ({waiting.map((w) => w.kind).join(', ')})</span>
                  ) : (
                    <span>
                      {lb ? (
                        <>
                          {resultIcon(lb.result)} Last backup {when(lb.finished_at ?? lb.started_at)}: {lb.message}
                        </>
                      ) : (
                        '⚪ Not backed up yet'
                      )}
                    </span>
                  )}
                  {j.last_check && !live && (
                    <span className="hint">
                      {resultIcon(j.last_check.result)} Last 🩺 check {when(j.last_check.finished_at ?? j.last_check.started_at)}: {j.last_check.message}
                    </span>
                  )}
                  {j.next_run && !j.archived && <span className="hint">Next: {when(j.next_run)}</span>}
                  {j.problems.length > 0 && !j.archived && (
                    <ul className="backup-job__problems">
                      {j.problems.map((p) => (
                        <li key={p}>⚠️ {p}</li>
                      ))}
                    </ul>
                  )}
                  {j.older_versions && <span className="hint">Files that were replaced keep their old version in <code>{j.older_versions}</code>.</span>}
                  <div className="backup-controls__row">
                    {!j.archived && (
                      <button type="button" disabled={Boolean(live) || waiting.length > 0} onClick={() => void act(() => api.post(`/backups/jobs/${j.id}/run`, body({ kind: 'backup' })))}>
                        ▶ Back up now
                      </button>
                    )}
                    {j.method === 'history' && (
                      <button type="button" className="secondary" onClick={() => setBrowsing(j)}>
                        🕰️ History &amp; restore
                      </button>
                    )}
                    {j.method === 'history' && !j.archived && (
                      <button type="button" className="secondary" disabled={Boolean(live)} onClick={() => void act(() => api.post(`/backups/jobs/${j.id}/run`, body({ kind: 'check' })))}>
                        🩺 Check
                      </button>
                    )}
                    <button type="button" className="link-button" onClick={() => setRunsOf(j)}>
                      📜 Past runs
                    </button>
                    <button type="button" className="link-button" onClick={() => setEditing(j)}>
                      ✏️ Edit
                    </button>
                    {j.has_password && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void act(async () => setPw({ id: j.id, ...(await api.get<{ password: string }>(`/backups/jobs/${j.id}/password?${acting.q}`)) }))}
                      >
                        🔑 Password
                      </button>
                    )}
                    <button type="button" className="link-button" onClick={() => void act(() => api.put(`/backups/jobs/${j.id}`, body({ archived: !j.archived })))}>
                      {j.archived ? '↩︎ Bring back' : '🗄️ Archive'}
                    </button>
                  </div>
                  {pw?.id === j.id && (
                    <div className="backup-job__pw">
                      <span>
                        🔑 <code>{pw.password}</code>
                      </span>
                      <span className="hint">
                        Without this nobody can read this backup — save a copy somewhere other than the Pi (a password manager, or on paper). It’s also in the app’s own database backup.
                      </span>
                      <button type="button" className="link-button" onClick={() => setPw(null)}>
                        Hide
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          <div className="backup-controls__row">
            <button type="button" onClick={() => setEditing('new')}>
              ＋ New backup
            </button>
            {s.jobs.some((j) => j.archived) && (
              <label className="relatives__check">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
              </label>
            )}
          </div>
          <p className="hint">🗄️ Archive only takes a backup off this list and stops its schedule — what it already backed up stays where it is.</p>
        </>
      )}
      {editing && s && (
        <JobForm
          job={editing === 'new' ? null : editing}
          presets={s.presets}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {browsing && <HistoryBrowser job={browsing} onClose={() => setBrowsing(null)} onStarted={() => void load()} />}
      {runsOf && <RunsList job={runsOf} onClose={() => setRunsOf(null)} />}
    </section>
  );
}

function JobForm({ job, presets, onClose, onSaved }: { job: Job | null; presets: State['presets']; onClose: () => void; onSaved: () => void }) {
  const acting = useActing();
  const [d, setD] = useState(() => ({
    name: job?.name ?? 'Photos & home videos',
    method: job?.method ?? ('history' as Job['method']),
    keys: new Set<SourceKey>(job ? job.sources.filter((x) => x.key !== 'folder').map((x) => x.key) : ['photos', 'videos']),
    folders: job ? job.sources.filter((x) => x.key === 'folder').map((x) => x.path ?? '') : [],
    dest: job?.dest ?? '',
    schedule: job?.schedule ?? ('daily' as Job['schedule']),
    at_time: job?.at_time ?? '03:00',
    weekday: job?.weekday ?? 0,
    check_weekly: job ? Boolean(job.check_weekly) : true,
    restore_dir: job?.restore_dir ?? '',
    same_disk_ok: Boolean(job?.same_disk_ok),
    password: '',
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const b = {
      name: d.name,
      method: d.method,
      sources: [...[...d.keys].map((key) => ({ key })), ...d.folders.filter((f) => f.trim()).map((path) => ({ key: 'folder', path: path.trim() }))],
      dest: d.dest,
      schedule: d.schedule,
      at_time: d.at_time,
      weekday: d.weekday,
      check_weekly: d.check_weekly,
      restore_dir: d.restore_dir || null,
      same_disk_ok: d.same_disk_ok,
      ...(d.password.trim() ? { password: d.password.trim() } : {}),
      acting_member_id: acting.id || null,
    };
    try {
      if (job) await api.put(`/backups/jobs/${job.id}`, b);
      else await api.post('/backups/jobs', b);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form backup-form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{job ? `Edit “${job.name}”` : '＋ New backup'}</h2>
        <label>
          Name
          <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={80} required />
        </label>
        <fieldset>
          <legend>How</legend>
          <label className="relatives__check">
            <input type="radio" checked={d.method === 'history'} onChange={() => set('method', 'history')} disabled={Boolean(job && job.method !== 'history')} /> 🕰️ With history
            (restic) — a dated snapshot each time; browse and restore any day. Unchanged files take no extra space. Locked with a password.
          </label>
          <label className="relatives__check">
            <input type="radio" checked={d.method === 'copy'} onChange={() => set('method', 'copy')} disabled={Boolean(job && job.method !== 'copy')} /> 📁 Plain copy (rsync) —
            ordinary folders. New and changed files are copied; nothing is removed from the backup; a replaced file keeps its old version aside.
          </label>
          {job && <span className="hint">To switch how, make a new backup (to a new folder) and archive this one.</span>}
        </fieldset>
        <fieldset>
          <legend>What to back up</legend>
          {presets.map((p) => (
            <label key={p.key} className="relatives__check">
              <input
                type="checkbox"
                checked={d.keys.has(p.key)}
                onChange={(e) => {
                  const k = new Set(d.keys);
                  if (e.target.checked) k.add(p.key);
                  else k.delete(p.key);
                  set('keys', k);
                }}
              />{' '}
              {p.label} <code>{p.path}</code>
              {!p.exists && <span className="hint"> (not found right now)</span>}
            </label>
          ))}
          {d.folders.map((f, i) => (
            <div key={i} className="backup-form__folder">
              <input value={f} placeholder="/path/to/folder" aria-label="Another folder" onChange={(e) => set('folders', d.folders.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="link-button" onClick={() => set('folders', d.folders.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => set('folders', [...d.folders, ''])}>
            ＋ Another folder
          </button>
          <span className="hint">Shares work too: use the folder they’re mounted at on the Pi (e.g. /mnt/family-photos). They’re only read.</span>
        </fieldset>
        <label>
          Where it goes
          <input
            value={d.dest}
            onChange={(e) => set('dest', e.target.value)}
            required
            placeholder={d.method === 'history' ? 'e.g. /mnt/backup/photos-history' : 'e.g. /mnt/backup/photos-copy'}
            disabled={Boolean(job && (job.last_backup || job.last_check))}
          />
          <span className="hint">
            A folder on a backup drive or a mounted share.{' '}
            {d.method === 'history' && 'A new or empty folder (it’s set up the first time), or one that already has a restic backup. Also sftp:user@host:/path or rest:http://… .'}
            {job && (job.last_backup || job.last_check) && ' It can’t change after the first backup — make a new one instead.'}
          </span>
        </label>
        <label className="relatives__check">
          <input type="checkbox" checked={d.same_disk_ok} onChange={(e) => set('same_disk_ok', e.target.checked)} /> It’s OK that it’s on the Pi’s own disk (normally it refuses, so a
          backup drive that isn’t plugged in doesn’t fill up the Pi)
        </label>
        <fieldset>
          <legend>When</legend>
          <div className="backup-form__when">
            <select value={d.schedule} onChange={(e) => set('schedule', e.target.value as Job['schedule'])} aria-label="How often">
              <option value="daily">Every night</option>
              <option value="weekly">Once a week</option>
              <option value="off">Only when I press ▶</option>
            </select>
            {d.schedule === 'weekly' && (
              <select value={d.weekday} onChange={(e) => set('weekday', Number(e.target.value))} aria-label="Day">
                {DAYS.map((x, i) => (
                  <option key={x} value={i}>
                    {x}
                  </option>
                ))}
              </select>
            )}
            {d.schedule !== 'off' && <input type="time" value={d.at_time} onChange={(e) => set('at_time', e.target.value)} aria-label="Time" required />}
          </div>
          <span className="hint">If the Pi is off then, it runs as soon as it’s back on. Pick a different time from the Pi’s own nightly backup.</span>
          {d.method === 'history' && (
            <label className="relatives__check">
              <input type="checkbox" checked={d.check_weekly} onChange={(e) => set('check_weekly', e.target.checked)} /> 🩺 Check the backup can be read back every Sunday
            </label>
          )}
        </fieldset>
        {d.method === 'history' && (
          <>
            <label>
              Restore into
              <input value={d.restore_dir} onChange={(e) => set('restore_dir', e.target.value)} placeholder={d.dest && !/^[a-z0-9]+:/i.test(d.dest) ? `${d.dest.replace(/\/[^/]*$/, '')}/fhc-restored` : '/mnt/backup/fhc-restored'} />
              <span className="hint">Each restore makes a new dated folder in here — nothing is restored over existing files. Move things back yourself once you’ve looked.</span>
            </label>
            <label>
              🔑 Password of an existing restic backup there (optional)
              <input value={d.password} onChange={(e) => set('password', e.target.value)} autoComplete="off" placeholder={job?.has_password ? 'leave empty to keep the one it has' : 'leave empty to make a new one'} />
            </label>
          </>
        )}
        {error && <div className="settings-login__error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface Snapshot {
  id: string;
  short_id: string;
  time: string;
  paths: string[];
}
interface Entry {
  name: string;
  path: string;
  type: string;
  size: number | null;
  mtime: string | null;
  snapshot?: string;
}

/** 🕰️ Pick a day, look around, and restore what you need into a new folder. */
function HistoryBrowser({ job, onClose, onStarted }: { job: Job; onClose: () => void; onStarted: () => void }) {
  const acting = useActing();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    api
      .get<Snapshot[]>(`/backups/jobs/${job.id}/snapshots?${acting.q}`)
      .then((l) => {
        setSnaps(l);
        if (l[0]) setSnap(l[0]);
      })
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  useEffect(() => {
    setPicked(new Set());
    if (!snap || !dir) return setEntries(null);
    const n = ++seq.current;
    setLoading(true);
    setEntries(null);
    api
      .get<Entry[]>(`/backups/jobs/${job.id}/ls?snapshot=${snap.id}&path=${encodeURIComponent(dir)}&${acting.q}`)
      .then((l) => n === seq.current && setEntries(l))
      .catch((e) => n === seq.current && setError((e as Error).message))
      .finally(() => n === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.id, dir]);

  const restore = async (paths: string[], snapshotId = snap?.id) => {
    if (!snapshotId) return;
    setError(null);
    setDone(null);
    try {
      const r = await api.post<{ target: string }>(`/backups/jobs/${job.id}/restore`, { snapshot: snapshotId, paths, acting_member_id: acting.id || null });
      setDone(`⤵️ Restoring into ${r.target} — it runs in the background; see 📜 Past runs for when it’s done.`);
      onStarted();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setError(null);
    setFound(null);
    setLoading(true);
    try {
      setFound(await api.get<Entry[]>(`/backups/jobs/${job.id}/find?q=${encodeURIComponent(q.trim())}&${acting.q}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const root = snap?.paths.find((p) => dir && (dir === p || dir.startsWith(`${p}/`)));
  const up = dir && root && dir !== root ? dir.replace(/\/[^/]+$/, '') || '/' : null;
  const snapTime = (id: string) => snaps?.find((x) => x.id === id || x.id.startsWith(id))?.time ?? null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel backup-history" onClick={(e) => e.stopPropagation()}>
        <h2>🕰️ {job.name}: history</h2>
        {error && <div className="settings-login__error">{error}</div>}
        {done && <p className="backup-history__done">{done}</p>}
        {!snaps && !error && <p className="hint">Reading the backup…</p>}
        {snaps && snaps.length === 0 && <p className="hint">No snapshots yet.</p>}
        {snaps && snaps.length > 0 && (
          <>
            <form className="backup-history__search" onSubmit={search}>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Find a file or folder by name in every snapshot (e.g. IMG_1234, *.mov)" aria-label="Find by name" />
              <button type="submit" className="secondary">
                Find
              </button>
            </form>
            {found && (
              <div className="backup-history__list">
                <p className="hint">
                  {found.length === 0 ? 'Nothing by that name.' : `${found.length}${found.length >= 300 ? '+' : ''} found`}{' '}
                  <button type="button" className="link-button" onClick={() => setFound(null)}>
                    close
                  </button>
                </p>
                {found.map((f) => (
                  <div key={`${f.snapshot}:${f.path}`} className="backup-history__entry">
                    <span>
                      {f.type === 'dir' ? '📁' : '📄'} <code>{f.path}</code>
                      <span className="hint"> · {when(snapTime(f.snapshot!))}</span>
                    </span>
                    <button type="button" className="link-button" onClick={() => void restore([f.path], f.snapshot)}>
                      ⤵️ Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label>
              As it was on
              <select
                value={snap?.id ?? ''}
                onChange={(e) => {
                  const s = snaps.find((x) => x.id === e.target.value) ?? null;
                  setSnap(s);
                  if (s && dir && !s.paths.some((p) => dir === p || dir.startsWith(`${p}/`))) setDir(null);
                }}
              >
                {snaps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {when(s.time)} · {s.short_id}
                  </option>
                ))}
              </select>
            </label>
            {snap && (
              <div className="backup-history__list">
                <div className="backup-history__crumbs">
                  <button type="button" className="link-button" onClick={() => setDir(null)}>
                    📦 Everything
                  </button>
                  {dir && <code>{dir}</code>}
                  {up && (
                    <button type="button" className="link-button" onClick={() => setDir(up)}>
                      ⬆ Up
                    </button>
                  )}
                </div>
                {!dir &&
                  snap.paths.map((p) => (
                    <div key={p} className="backup-history__entry">
                      <button type="button" className="link-button" onClick={() => setDir(p)}>
                        📁 {p}
                      </button>
                    </div>
                  ))}
                {dir && loading && <p className="hint">Loading…</p>}
                {dir && entries && entries.length === 0 && <p className="hint">Empty.</p>}
                {dir &&
                  entries?.map((e) => (
                    <div key={e.path} className="backup-history__entry">
                      <label className="relatives__check">
                        <input
                          type="checkbox"
                          checked={picked.has(e.path)}
                          onChange={(ev) => {
                            const n = new Set(picked);
                            if (ev.target.checked) n.add(e.path);
                            else n.delete(e.path);
                            setPicked(n);
                          }}
                          aria-label={`Pick ${e.name}`}
                        />
                      </label>
                      {e.type === 'dir' ? (
                        <button type="button" className="link-button" onClick={() => setDir(e.path)}>
                          📁 {e.name}
                        </button>
                      ) : (
                        <span>📄 {e.name}</span>
                      )}
                      <span className="hint">
                        {e.type !== 'dir' && size(e.size)} {e.mtime && new Date(e.mtime).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                <div className="backup-controls__row">
                  {picked.size > 0 && <button type="button" onClick={() => void restore([...picked])}>⤵️ Restore {picked.size} picked</button>}
                  {dir && (
                    <button type="button" className="secondary" onClick={() => void restore([dir])}>
                      ⤵️ Restore this whole folder
                    </button>
                  )}
                  {!dir && (
                    <button type="button" className="secondary" onClick={() => void restore([])}>
                      ⤵️ Restore everything from this day
                    </button>
                  )}
                </div>
                <p className="hint">
                  Restores go into a new folder in <code>{job.restore_root ?? '(set “Restore into” in ✏️ Edit)'}</code>, keeping the full path (…/share/photos/2019/…). Nothing existing is
                  overwritten.
                </p>
              </div>
            )}
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RunsList({ job, onClose }: { job: Job; onClose: () => void }) {
  const acting = useActing();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<Run[]>(`/backups/jobs/${job.id}/runs?${acting.q}`)
      .then(setRuns)
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  const label = { backup: '💾 Backup', check: '🩺 Check', restore: '⤵️ Restore' } as const;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel backup-history" onClick={(e) => e.stopPropagation()}>
        <h2>📜 {job.name}: past runs</h2>
        {error && <div className="settings-login__error">{error}</div>}
        {runs && runs.length === 0 && <p className="hint">Nothing yet.</p>}
        {runs?.map((r) => (
          <div key={r.id} className={`backup-status__row ${resultCls(r.result)}`}>
            <strong>
              {resultIcon(r.result)} {label[r.kind]} · {when(r.started_at)}
              {r.trigger === 'schedule' ? ' (scheduled)' : ''}
            </strong>
            {r.message && <span className="hint">{r.message}</span>}
            {r.kind === 'restore' && typeof r.stats?.target === 'string' && (
              <span className="hint">
                Into <code>{r.stats.target}</code>
              </span>
            )}
          </div>
        ))}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
